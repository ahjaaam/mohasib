import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkPlanLimit } from "@/lib/plan-check";
import { getActiveUserCount, requirePermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { resolveTeamContext, ROLE_LABELS } from "@/lib/team";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

function teamDatabaseMessage(message?: string) {
  if (message?.includes("schema cache") || message?.includes("does not exist")) {
    return "Le schéma multi-utilisateurs Supabase n'est pas à jour. Appliquez la migration 040_multi_user_access.sql puis réessayez.";
  }
  return message || "Impossible de créer l'invitation.";
}

async function authContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const context = await resolveTeamContext(user.id);
  return context ? { user, context } : null;
}

export async function GET() {
  const auth = await authContext();
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { user, context } = auth;
  const denied = await requirePermission({ userId: user.id, companyId: context.companyId }, "settings", "manage_team");
  if (denied) return denied;

  const admin = createAdminClient();
  await admin.from("user_memberships")
    .update({ role_name: "manager", dossier_scope: null })
    .eq("company_id", context.companyId)
    .in("role_name", ["employee", "collaborateur", "read_auditor"]);
  const [{ data: memberships }, { data: owner }, planCheck] = await Promise.all([
    admin.from("user_memberships")
      .select("id,user_id,user_email,first_name,last_name,role_name,dossier_scope,status,invitation_token,invited_at,accepted_at,created_at")
      .eq("company_id", context.companyId)
      .neq("status", "revoked")
      .order("created_at"),
    admin.from("users").select("full_name,email").eq("id", context.ownerId).maybeSingle(),
    checkPlanLimit(context.companyId, "multi_users"),
  ]);
  const membershipIds = (memberships ?? []).map(membership => membership.id);
  if (membershipIds.length) {
    await admin.from("membership_permissions").delete().in("membership_id", membershipIds);
  }

  const members = (memberships ?? []).map(membership => ({
    ...membership,
    invitation_url: membership.invitation_token
      ? `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/invitations/${membership.invitation_token}`
      : null,
    invitation_token: undefined,
    role_label: ROLE_LABELS[membership.role_name] ?? membership.role_name,
  }));

  return NextResponse.json({
    context,
    plan: { allowed: planCheck.allowed, limit: planCheck.limit ?? 1 },
    count: await getActiveUserCount(context.companyId),
    owner: {
      id: context.ownerId,
      email: owner?.email ?? context.ownerEmail,
      full_name: owner?.full_name ?? context.ownerName,
      role_label: "Propriétaire",
    },
    members,
  });
}

export async function POST(req: NextRequest) {
  const auth = await authContext();
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { user, context } = auth;
  const denied = await requirePermission({ userId: user.id, companyId: context.companyId }, "settings", "manage_team");
  if (denied) return denied;

  const planCheck = await checkPlanLimit(context.companyId, "multi_users");
  if (!planCheck.allowed) {
    return NextResponse.json({
      error: "upgrade_required",
      message: "La gestion d'équipe est disponible à partir du plan Business Pro (449 MAD/mois) ou Comptable Pro (599 MAD/mois).",
    }, { status: 403 });
  }

  const activeCount = await getActiveUserCount(context.companyId);
  if (activeCount >= Number(planCheck.limit ?? 1)) {
    return NextResponse.json({
      error: "limit_reached",
      message: `Vous avez atteint la limite de ${planCheck.limit} utilisateurs de votre plan.`,
    }, { status: 409 });
  }

  const body = await req.json();
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "invalid_email", message: "Adresse e-mail invalide." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: existing } = await admin.from("user_memberships")
    .select("id").eq("company_id", context.companyId).eq("user_email", email).neq("status", "revoked").maybeSingle();
  if (existing) return NextResponse.json({ error: "already_member", message: "Cette adresse fait déjà partie de l'équipe." }, { status: 409 });

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: membership, error } = await admin.from("user_memberships").insert({
    user_id: null,
    user_email: email,
    company_id: context.companyId,
    role_name: "manager",
    dossier_scope: null,
    status: "invited",
    invitation_token: token,
    invitation_expires_at: expiresAt,
    invited_by: user.id,
    invited_at: new Date().toISOString(),
    first_name: body.first_name || null,
    last_name: body.last_name || null,
  }).select("id").single();

  if (error || !membership) return NextResponse.json({ error: "create_failed", message: teamDatabaseMessage(error?.message) }, { status: 500 });

  const invitationUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/invitations/${token}`;
  if (resend) {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "Mohasib <noreply@mohasibai.com>",
      to: email,
      subject: `${context.ownerName} vous invite à rejoindre Mohasib`,
      html: `<p>${context.ownerName} vous invite à rejoindre <strong>${context.accountName}</strong> sur Mohasib.</p><p>Rôle : Collaborateur</p><p><a href="${invitationUrl}">Accepter l'invitation</a></p><p>Ce lien expire dans 7 jours.</p>`,
    });
  }

  void logAudit({
    action: "CREATE",
    entityType: "membership",
    entityId: membership.id,
    entityLabel: email,
    companyId: context.companyId,
    newValues: { email, role_name: "manager", dossier_scope: null },
  });

  return NextResponse.json({ success: true, membershipId: membership.id, invitationUrl });
}
