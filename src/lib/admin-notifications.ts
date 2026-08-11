import "server-only";
import type { User } from "@supabase/supabase-js";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";

export type NotificationAudience = {
  type: "all" | "users" | "companies" | "segment";
  user_ids?: string[];
  company_ids?: string[];
  user_type?: string;
  plan?: string;
  status?: string;
  inactive_days?: number;
  trial_expiring_days?: number;
};

type Recipient = { userId: string; email: string; companyId: string | null };

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character] ?? character);
}

async function allAuthUsers(): Promise<User[]> {
  const admin = createAdminClient();
  const users: User[] = [];
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...(data.users ?? []));
    if ((data.users ?? []).length < 1000) break;
  }
  return users;
}

export async function resolveNotificationRecipients(audience: NotificationAudience): Promise<Recipient[]> {
  const admin = createAdminClient();
  const [users, companiesRes, membershipsRes] = await Promise.all([
    allAuthUsers(),
    admin.from("companies").select("id,user_id,user_type,plan,subscription_status,trial_ends_at,is_suspended"),
    admin.from("user_memberships").select("user_id,company_id,status").neq("status", "revoked"),
  ]);
  const companies = companiesRes.data ?? [];
  const memberships = membershipsRes.data ?? [];
  const companyByOwner = new Map(companies.map(company => [company.user_id, company]));
  const companyByMember = new Map(memberships.filter(item => item.user_id).map(item => [item.user_id, companies.find(company => company.id === item.company_id)]));
  const selectedUserIds = new Set(audience.user_ids ?? []);
  const selectedCompanyIds = new Set(audience.company_ids ?? []);
  const now = Date.now();

  return users.flatMap(user => {
    if (!user.email) return [];
    const company = companyByOwner.get(user.id) ?? companyByMember.get(user.id);
    const companyId = company?.id ?? null;
    let included = audience.type === "all";
    if (audience.type === "users") included = selectedUserIds.has(user.id);
    if (audience.type === "companies") included = !!companyId && selectedCompanyIds.has(companyId);
    if (audience.type === "segment") {
      included = !!company;
      if (included && audience.user_type) included = company?.user_type === audience.user_type;
      if (included && audience.plan) included = company?.plan === audience.plan;
      if (included && audience.status) {
        const status = company?.is_suspended ? "suspended" : company?.subscription_status;
        included = status === audience.status;
      }
      if (included && audience.inactive_days) {
        const lastSignIn = user.last_sign_in_at ? new Date(user.last_sign_in_at).getTime() : 0;
        included = !lastSignIn || lastSignIn <= now - audience.inactive_days * 86_400_000;
      }
      if (included && audience.trial_expiring_days) {
        const trialEnd = company?.trial_ends_at ? new Date(company.trial_ends_at).getTime() : 0;
        included = company?.subscription_status === "trial" && trialEnd >= now && trialEnd <= now + audience.trial_expiring_days * 86_400_000;
      }
    }
    return included ? [{ userId: user.id, email: user.email, companyId }] : [];
  });
}

export async function dispatchNotificationCampaign(campaignId: string) {
  const admin = createAdminClient();
  const { data: campaign, error } = await admin.from("notification_campaigns")
    .update({ status: "sending", updated_at: new Date().toISOString() })
    .eq("id", campaignId)
    .in("status", ["draft", "scheduled", "failed"])
    .select("*")
    .maybeSingle();
  if (error) throw error;
  // Another worker already claimed this campaign, or it is terminal.
  if (!campaign) return;

  const recipients = await resolveNotificationRecipients(campaign.audience as NotificationAudience);
  const now = new Date().toISOString();

  if (campaign.channel === "in_app" || campaign.channel === "both") {
    const rows = recipients.map(recipient => ({
      user_id: recipient.userId,
      type: `admin_${campaign.category}`,
      title: campaign.title,
      message: campaign.message,
      link: campaign.link || null,
      priority: campaign.priority,
      unique_key: `campaign_${campaign.id}`,
      campaign_id: campaign.id,
    }));
    if (rows.length) {
      const result = await admin.from("notifications").upsert(rows, { onConflict: "user_id,unique_key", ignoreDuplicates: true });
      const status = result.error ? "failed" : "delivered";
      await admin.from("notification_deliveries").upsert(recipients.map(recipient => ({
        campaign_id: campaign.id, user_id: recipient.userId, company_id: recipient.companyId,
        channel: "in_app", status, sent_at: result.error ? null : now, error_message: result.error?.message ?? null,
      })), { onConflict: "campaign_id,user_id,channel" });
    }
  }

  if ((campaign.channel === "email" || campaign.channel === "both") && recipients.length) {
    const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
    const preferences = await admin.from("user_preferences").select("user_id,notif_tva_email,notif_overdue_email,notif_weekly_summary").in("user_id", recipients.map(item => item.userId));
    const preferencesByUser = new Map((preferences.data ?? []).map(item => [item.user_id, item]));
    const existingDeliveries = await admin.from("notification_deliveries")
      .select("user_id,status")
      .eq("campaign_id", campaign.id)
      .eq("channel", "email")
      .in("status", ["delivered", "skipped"]);
    const completedUsers = new Set((existingDeliveries.data ?? []).map(item => item.user_id));
    for (const recipient of recipients) {
      if (completedUsers.has(recipient.userId)) continue;
      const preference = preferencesByUser.get(recipient.userId);
      const optedOut = campaign.category === "marketing" && preference && !preference.notif_weekly_summary;
      let status: "delivered" | "failed" | "skipped" = "delivered";
      let errorMessage: string | null = null;
      if (optedOut) status = "skipped";
      else if (!resend) { status = "failed"; errorMessage = "RESEND_API_KEY non configurée"; }
      else {
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://mohasibai.com";
        const emailLink = campaign.link?.startsWith("/") ? `${baseUrl.replace(/\/$/, "")}${campaign.link}` : campaign.link;
        const response = await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || "Mohasib <noreply@mohasibai.com>",
          to: recipient.email,
          subject: campaign.title,
          html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto"><h2>${escapeHtml(campaign.title)}</h2><p style="line-height:1.6">${escapeHtml(campaign.message).replaceAll("\n", "<br>")}</p>${emailLink ? `<p><a href="${escapeHtml(emailLink)}">Ouvrir Mohasib</a></p>` : ""}</div>`,
        });
        if (response.error) { status = "failed"; errorMessage = response.error.message; }
      }
      await admin.from("notification_deliveries").upsert({
        campaign_id: campaign.id, user_id: recipient.userId, company_id: recipient.companyId,
        channel: "email", status, sent_at: status === "delivered" ? now : null, error_message: errorMessage,
      }, { onConflict: "campaign_id,user_id,channel" });
    }
  }

  const { data: deliveries } = await admin.from("notification_deliveries")
    .select("status")
    .eq("campaign_id", campaign.id);
  const delivered = (deliveries ?? []).filter(item => item.status === "delivered").length;
  const failed = (deliveries ?? []).filter(item => item.status === "failed").length;
  await admin.from("notification_campaigns").update({
    status: failed > 0 ? "failed" : "sent",
    sent_at: failed > 0 ? null : now,
    recipient_count: recipients.length,
    delivered_count: delivered,
    failed_count: failed,
    updated_at: now,
  }).eq("id", campaign.id);
}
