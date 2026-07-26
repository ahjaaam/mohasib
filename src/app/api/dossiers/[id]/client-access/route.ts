import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/rbac";
import { resolveTeamContext, ROLE_LABELS } from "@/lib/team";
import { logAudit } from "@/lib/audit";
import { appUrl } from "@/lib/public-urls";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

async function authorizedDossier(userId: string, dossierId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const context = await resolveTeamContext(user.id);
  if (!context) return null;
  const denied = await requirePermission(
    { userId: user.id, companyId: context.companyId, scope: "comptable_pro" },
    "settings", "manage_team",
  );
  if (denied) return { denied };

  const admin = createAdminClient();
  const { data: dossier } = await admin.from("dossiers")
    .select("id, raison_sociale")
    .eq("id", dossierId)
    .eq("fiduciaire_user_id", context.ownerId)
    .maybeSingle();
  if (!dossier) return { denied: NextResponse.json({ error: "not_found" }, { status: 404 }) };

  return { user, context, dossier };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const auth = await authorizedDossier(user.id, id);
  if (!auth || "denied" in auth) return auth?.denied ?? NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: memberships } = await admin.from("user_memberships")
    .select("id,user_email,first_name,last_name,status,invitation_token,invited_at,accepted_at,created_at")
    .eq("dossier_id", id)
    .eq("role_name", "client_portal")
    .neq("status", "revoked")
    .order("created_at");

  const members = (memberships ?? []).map(membership => ({
    ...membership,
    invitation_url: membership.invitation_token ? appUrl(`/invitations/${membership.invitation_token}`) : null,
    invitation_token: undefined,
    role_label: ROLE_LABELS.client_portal,
  }));

  return NextResponse.json({ members });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const auth = await authorizedDossier(user.id, id);
  if (!auth || "denied" in auth) return auth?.denied ?? NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { context, dossier } = auth;

  const body = await req.json();
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "invalid_email", message: "Adresse e-mail invalide." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: existing } = await admin.from("user_memberships")
    .select("id").eq("dossier_id", id).eq("user_email", email).neq("status", "revoked").maybeSingle();
  if (existing) return NextResponse.json({ error: "already_member", message: "Ce client a déjà accès à ce dossier." }, { status: 409 });

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: membership, error } = await admin.from("user_memberships").insert({
    user_id: null,
    user_email: email,
    company_id: context.companyId,
    dossier_id: id,
    dossier_scope: [id],
    role_name: "client_portal",
    access_scope: "comptable_pro_only",
    status: "invited",
    invitation_token: token,
    invitation_expires_at: expiresAt,
    invited_by: user.id,
    invited_at: new Date().toISOString(),
    first_name: body.first_name || null,
    last_name: body.last_name || null,
  }).select("id").single();

  if (error || !membership) {
    return NextResponse.json({ error: "create_failed", message: error?.message || "Impossible de créer l'invitation." }, { status: 500 });
  }

  const invitationUrl = appUrl(`/invitations/${token}`);
  if (resend) {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "Mohasib <noreply@mohasibai.com>",
      to: email,
      subject: `${context.ownerName} vous donne accès à votre dossier sur Mohasib`,
      html: `<p>${context.ownerName} vous donne accès à votre dossier <strong>${dossier.raison_sociale}</strong> sur Mohasib.</p><p>Vous pourrez y gérer vos factures, transactions et documents.</p><p><a href="${invitationUrl}">Créer mon accès</a></p><p>Ce lien expire dans 7 jours.</p>`,
    });
  }

  void logAudit({
    action: "CREATE",
    entityType: "membership",
    entityId: membership.id,
    entityLabel: email,
    companyId: context.companyId,
    newValues: { email, role_name: "client_portal", dossier_id: id },
  });

  return NextResponse.json({ success: true, membershipId: membership.id, invitationUrl });
}
