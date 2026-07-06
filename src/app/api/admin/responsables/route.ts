import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { logAdminAudit, requireAdminApi } from "@/lib/admin-api";
import { appUrl } from "@/lib/public-urls";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const ACCESS_SCOPES = ["business_only", "comptable_pro_only", "both"] as const;
type AccessScope = typeof ACCESS_SCOPES[number];

function normalizeAccessScope(value: unknown): AccessScope {
  return ACCESS_SCOPES.includes(value as AccessScope) ? value as AccessScope : "both";
}

export async function POST(request: Request) {
  const { user, admin, response } = await requireAdminApi();
  if (response) return response;

  const body = await request.json();
  const companyId = String(body.company_id ?? "");
  const email = String(body.email ?? "").trim().toLowerCase();
  const firstName = String(body.first_name ?? "").trim();
  const lastName = String(body.last_name ?? "").trim();
  const accessScope = normalizeAccessScope(body.access_scope);
  if (!companyId) return NextResponse.json({ message: "Sélectionnez un compte." }, { status: 400 });
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ message: "Adresse e-mail invalide." }, { status: 400 });
  }
  if (!firstName || !lastName) {
    return NextResponse.json({ message: "Le prénom et le nom sont obligatoires." }, { status: 400 });
  }

  const { data: company } = await admin!.from("companies")
    .select("id,raison_sociale")
    .eq("id", companyId)
    .maybeSingle();
  if (!company) return NextResponse.json({ message: "Compte introuvable." }, { status: 404 });

  const { data: existing } = await admin!.from("user_memberships")
    .select("id")
    .eq("company_id", companyId)
    .eq("user_email", email)
    .neq("status", "revoked")
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ message: "Cette adresse fait déjà partie de ce compte." }, { status: 409 });
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: membership, error } = await admin!.from("user_memberships").insert({
    user_id: null,
    user_email: email,
    company_id: companyId,
    role_name: "manager",
    dossier_scope: null,
    access_scope: accessScope,
    status: "invited",
    invitation_token: token,
    invitation_expires_at: expiresAt,
    invited_by: user!.id,
    invited_at: new Date().toISOString(),
    first_name: firstName,
    last_name: lastName,
  }).select("id").single();
  if (error || !membership) {
    return NextResponse.json({ message: error?.message || "Impossible de créer l'invitation." }, { status: 400 });
  }

  const invitationUrl = appUrl(`/invitations/${token}`);
  let emailSent = false;
  if (resend) {
    const result = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "Mohasib <noreply@mohasibai.com>",
      to: email,
      subject: `Invitation à rejoindre ${company.raison_sociale || "Mohasib"}`,
      html: `<p>Bonjour ${firstName},</p><p>Vous êtes invité à rejoindre <strong>${company.raison_sociale || "ce compte"}</strong> sur Mohasib avec le rôle Collaborateur.</p><p><a href="${invitationUrl}">Accepter l'invitation</a></p><p>Ce lien expire dans 7 jours.</p>`,
    });
    emailSent = !result.error;
  }

  await logAdminAudit({
    adminEmail: user!.email!,
    action: "RESPONSABLE_INVITE",
    entityType: "user_membership",
    entityId: membership.id,
    entityLabel: email,
    companyId,
    newValues: { email, first_name: firstName, last_name: lastName, role_name: "manager", status: "invited", access_scope: accessScope, email_sent: emailSent },
  });

  return NextResponse.json({ ok: true, invitationUrl, emailSent });
}
