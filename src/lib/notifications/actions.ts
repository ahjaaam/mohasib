"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createHash } from "node:crypto";
import { resolveAccountOwnerId } from "@/lib/account-owner";
import { getAttentionItems } from "@/lib/attention-center";
import { periodForPreset } from "@/lib/global-period";

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  is_dismissed: boolean;
  priority: "high" | "normal";
  unique_key: string | null;
  created_at: string;
}

const ACCOUNTING_AUTOMATION_GUIDE_NOTIFICATION = {
  type: "accounting_automation_guide",
  title: "Découvrez les écritures automatiques",
  message: "Consultez le PDF des écritures générées automatiquement pour les ventes, achats, reçus et mouvements bancaires.",
  link: "/documents/carte-ecritures-automatiques-mohasib.pdf",
  priority: "normal" as const,
  unique_key: "accounting_automation_guide",
};

function accountingAutomationGuideId(userId: string) {
  const hash = createHash("sha256")
    .update(`${userId}:${ACCOUNTING_AUTOMATION_GUIDE_NOTIFICATION.unique_key}`)
    .digest("hex")
    .slice(0, 32)
    .split("");

  hash[12] = "5";
  hash[16] = ((Number.parseInt(hash[16], 16) & 0x3) | 0x8).toString(16);
  const value = hash.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

/**
 * Ensure the accounting automation guide is available from the notification
 * bell. The unique key makes this safe to call whenever the app shell mounts.
 */
export async function ensureAccountingAutomationGuideNotification() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const admin = createAdminClient();
  const { error } = await admin
    .from("notifications")
    .upsert({
      id: accountingAutomationGuideId(user.id),
      user_id: user.id,
      ...ACCOUNTING_AUTOMATION_GUIDE_NOTIFICATION,
    }, {
      onConflict: "id",
      ignoreDuplicates: true,
    });

  if (error) throw error;
}

// ─── Generate + upsert notifications based on current data ────────────────────

export async function generateNotifications() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const now = new Date();
  const today = now.toISOString().split("T")[0];

  // Fetch company
  const { data: company } = await supabase
    .from("companies")
    .select("*")
    .eq("user_id", user.id)
    .single();

  const upserts: any[] = [];

  // ── 1. Welcome notification ────────────────────────────────────────────────
  upserts.push({
    user_id: user.id,
    type: "welcome",
    title: "Bienvenue sur Mohasib !",
    message: "Commencez par configurer votre entreprise et créer votre première facture.",
    link: "/parametres",
    priority: "normal",
    unique_key: "welcome",
  });

  upserts.push({
    user_id: user.id,
    ...ACCOUNTING_AUTOMATION_GUIDE_NOTIFICATION,
  });

  // ── 2. Missing company ICE ─────────────────────────────────────────────────
  if (company) {
    const createdAt = new Date(user.created_at ?? now);
    const daysSinceSignup = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
    if (!company.ice && daysSinceSignup >= 3) {
      upserts.push({
        user_id: user.id,
        type: "missing_info",
        title: "Complétez votre profil",
        message: "Votre ICE et informations légales sont manquants. Ils sont requis sur vos factures.",
        link: "/parametres",
        priority: "normal",
        unique_key: "missing_ice",
      });
    }
  }

  // ── 3. TVA deadline ────────────────────────────────────────────────────────
  const tvaRegime = (company as any)?.tva_regime ?? "Mensuel";
  let tvaDeadline: Date;
  if (tvaRegime === "Trimestriel") {
    const month = now.getMonth(); // 0-indexed
    const quarterEndMonth = Math.floor(month / 3) * 3 + 2; // last month of quarter
    tvaDeadline = new Date(now.getFullYear(), quarterEndMonth + 1, 20);
  } else {
    tvaDeadline = new Date(now.getFullYear(), now.getMonth() + 1, 20);
  }

  const daysUntilTVA = Math.ceil((tvaDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const tvaKey = `tva_${tvaDeadline.toISOString().split("T")[0]}`;

  if (daysUntilTVA <= 30 && daysUntilTVA >= 0) {
    const { data: invoices } = await supabase
      .from("invoices")
      .select("tax_amount, status")
      .eq("user_id", user.id)
      .in("status", ["paid", "sent"]);
    const tvaEstimate = (invoices ?? []).reduce((s: number, i: any) => s + Number(i.tax_amount ?? 0), 0);
    const deadline = tvaDeadline.toLocaleDateString("fr-MA", { day: "numeric", month: "long", year: "numeric" });
    upserts.push({
      user_id: user.id,
      type: "tva_deadline",
      title: `Déclaration TVA due le ${deadline}`,
      message: `Votre TVA estimée est ~${Math.round(tvaEstimate / 100) * 100} MAD. Ne manquez pas la date limite DGI.`,
      link: "/tableau-de-bord",
      priority: daysUntilTVA <= 10 ? "high" : "normal",
      unique_key: tvaKey,
    });
  }

  // ── 4. Monthly summary (1st of month) ─────────────────────────────────────
  if (now.getDate() === 1 || true) { // always check, unique_key prevents dup
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    const prevStart = prevMonth.toISOString().split("T")[0];
    const prevEnd = prevMonthEnd.toISOString().split("T")[0];
    const monthKey = `monthly_summary_${prevMonth.getFullYear()}_${String(prevMonth.getMonth() + 1).padStart(2, "0")}`;
    const monthLabel = prevMonth.toLocaleDateString("fr-MA", { month: "long", year: "numeric" });

    const { data: prevInvoices } = await supabase
      .from("invoices")
      .select("total, tax_amount, status, issue_date")
      .eq("user_id", user.id)
      .gte("issue_date", prevStart)
      .lte("issue_date", prevEnd);

    const { data: prevTxs } = await supabase
      .from("transactions")
      .select("amount, type, date")
      .eq("user_id", user.id)
      .gte("date", prevStart)
      .lte("date", prevEnd);

    if ((prevInvoices ?? []).length > 0 || (prevTxs ?? []).length > 0) {
      const ca = (prevInvoices ?? []).filter((i: any) => i.status !== "draft")
        .reduce((s: number, i: any) => s + Number(i.total), 0);
      const deps = (prevTxs ?? []).filter((t: any) => t.type === "expense")
        .reduce((s: number, t: any) => s + Number(t.amount), 0);
      const net = ca - deps;
      const count = (prevInvoices ?? []).length;
      const fmt = (n: number) => n.toLocaleString("fr-MA", { maximumFractionDigits: 0 });
      upserts.push({
        user_id: user.id,
        type: "monthly_summary",
        title: `Résumé de ${monthLabel}`,
        message: `CA: ${fmt(ca)} MAD | Factures émises: ${count} | Dépenses: ${fmt(deps)} MAD | Résultat net: ${fmt(net)} MAD`,
        link: "/tableau-de-bord",
        priority: "normal",
        unique_key: monthKey,
      });
    }
  }

  // ── 5. Overdue invoices ────────────────────────────────────────────────────
  const { data: overdueInvs } = await supabase
    .from("invoices")
    .select("id, invoice_number, total, due_date, clients(name)")
    .eq("user_id", user.id)
    .lt("due_date", today)
    .not("status", "in", '("paid","cancelled","draft")');

  for (const inv of overdueInvs ?? []) {
    const daysOverdue = Math.floor(
      (now.getTime() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24)
    );
    const clientName = (inv as any).clients?.name ?? "Client inconnu";
    const amount = Number((inv as any).total ?? 0).toLocaleString("fr-MA", { maximumFractionDigits: 0 });
    const isLarge = Number((inv as any).total ?? 0) > 10000 && daysOverdue >= 45;

    upserts.push({
      user_id: user.id,
      type: isLarge ? "large_invoice_unpaid" : "invoice_overdue",
      title: isLarge
        ? `Facture importante en attente`
        : `Facture en retard — ${clientName}`,
      message: isLarge
        ? `${clientName} vous doit ${amount} MAD depuis ${daysOverdue} jours. Pensez à relancer.`
        : `${(inv as any).invoice_number} de ${amount} MAD est en retard de ${daysOverdue} jour${daysOverdue > 1 ? "s" : ""}. Envoyez une relance à votre client.`,
      link: `/factures/${inv.id}`,
      priority: "high",
      unique_key: `overdue_${inv.id}`,
    });
  }

  // ── CNSS: last day of month ────────────────────────────────────────────────
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  if (now.getDate() >= lastDayOfMonth - 2) {
    const cnssKey = `cnss_${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, "0")}`;
    upserts.push({
      user_id: user.id,
      type: "cnss_reminder",
      title: "Rappel CNSS",
      message: "N'oubliez pas votre déclaration CNSS mensuelle avant la fin du mois.",
      link: "/tableau-de-bord",
      priority: "normal",
      unique_key: cnssKey,
    });
  }

  // ── Bulk upsert (unique_key guards duplicates) ─────────────────────────────
  if (upserts.length > 0) {
    const admin = createAdminClient();
    await admin
      .from("notifications")
      .upsert(upserts, {
        onConflict: "user_id,unique_key",
        ignoreDuplicates: true,
      });
  }
}

// ─── Fetch notifications for current user ─────────────────────────────────────

export async function fetchNotifications(limit = 10): Promise<Notification[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_dismissed", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []) as Notification[];
}

export async function fetchAllNotifications(): Promise<Notification[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (data ?? []) as Notification[];
}

export async function fetchInboxNotifications(): Promise<Notification[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const ownerId = await resolveAccountOwnerId(user.id);
  const [notifications, attentionItems] = await Promise.all([
    fetchAllNotifications(),
    getAttentionItems(ownerId, periodForPreset("all")),
  ]);
  const attentionMessages: Notification[] = attentionItems
    .filter((item) => item.count > 0)
    .map((item) => ({
      id: `attention-${item.id}`,
      user_id: user.id,
      type: "attention_action",
      title: `${item.title} · ${item.count}`,
      message: `${item.description}\n${item.count} action${item.count > 1 ? "s" : ""} à traiter.`,
      link: item.href,
      is_read: true,
      is_dismissed: false,
      priority: item.severity === "critical" ? "high" : "normal",
      unique_key: `attention-${item.id}`,
      created_at: new Date().toISOString(),
    }));

  return [...attentionMessages, ...notifications];
}

export async function markAllRead() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const now = new Date().toISOString();
  const { data: campaignNotifications } = await supabase
    .from("notifications")
    .select("campaign_id")
    .eq("user_id", user.id)
    .eq("is_read", false)
    .not("campaign_id", "is", null);
  await supabase.from("notifications").update({ is_read: true, read_at: now }).eq("user_id", user.id);
  const campaignIds = [...new Set((campaignNotifications ?? []).map(item => item.campaign_id).filter(Boolean))];
  if (campaignIds.length) {
    const admin = createAdminClient();
    await admin.from("notification_deliveries").update({ read_at: now })
      .eq("user_id", user.id).eq("channel", "in_app").in("campaign_id", campaignIds);
  }
}

export async function markRead(id: string) {
  const supabase = await createClient();
  const now = new Date().toISOString();
  const { data: notification } = await supabase.from("notifications").select("campaign_id,user_id").eq("id", id).maybeSingle();
  await supabase.from("notifications").update({ is_read: true, read_at: now }).eq("id", id);
  if (notification?.campaign_id) {
    const admin = createAdminClient();
    await admin.from("notification_deliveries").update({ read_at: now })
      .eq("campaign_id", notification.campaign_id).eq("user_id", notification.user_id).eq("channel", "in_app");
  }
}

export async function markClicked(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const now = new Date().toISOString();
  const { data: notification } = await supabase
    .from("notifications")
    .select("campaign_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  await supabase.from("notifications").update({ clicked_at: now }).eq("id", id).eq("user_id", user.id);
  if (notification?.campaign_id) {
    const admin = createAdminClient();
    await admin.from("notification_deliveries").update({ clicked_at: now })
      .eq("campaign_id", notification.campaign_id).eq("user_id", user.id).eq("channel", "in_app");
  }
}

export async function dismissNotification(id: string) {
  const supabase = await createClient();
  await supabase.from("notifications").update({ is_dismissed: true, is_read: true }).eq("id", id);
}

export async function deleteReadNotifications() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("notifications").delete().eq("user_id", user.id).eq("is_read", true);
}
