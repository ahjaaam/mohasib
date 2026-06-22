import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAdminAudit } from "@/lib/admin-api";
import { validatePassword } from "@/lib/password-policy";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = await request.json();
  const password = String(body.password ?? "");
  const fullName = String(body.full_name ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const passwordError = validatePassword(password);
  if (passwordError) return NextResponse.json({ message: passwordError }, { status: 400 });
  if (!phone) return NextResponse.json({ message: "Le numéro de téléphone est obligatoire." }, { status: 400 });

  const admin = createAdminClient();
  const { data: membership, error: membershipError } = await admin.from("user_memberships")
    .select("id,user_email,company_id,status,invitation_expires_at,companies(raison_sociale,user_type)")
    .eq("invitation_token", token)
    .eq("status", "invited")
    .maybeSingle();

  if (membershipError || !membership) return NextResponse.json({ message: "Cette invitation est invalide ou a déjà été utilisée." }, { status: 404 });
  if (!membership.invitation_expires_at || new Date(membership.invitation_expires_at) < new Date()) {
    return NextResponse.json({ message: "Cette invitation a expiré." }, { status: 410 });
  }

  const email = membership.user_email?.toLowerCase();
  if (!email) return NextResponse.json({ message: "L'invitation ne contient pas d'adresse e-mail." }, { status: 400 });
  const company = Array.isArray(membership.companies) ? membership.companies[0] : membership.companies;
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, phone, user_type: company?.user_type ?? "entrepreneur", invited_member: true },
  });
  if (created.error || !created.data.user) {
    const exists = created.error?.message?.toLowerCase().includes("already") || created.error?.code === "email_exists";
    return NextResponse.json({ message: exists ? "Un compte existe déjà avec cet email. Connectez-vous puis acceptez l'invitation." : created.error?.message || "Impossible de créer le compte." }, { status: exists ? 409 : 400 });
  }

  const authUser = created.data.user;
  const activated = await admin.from("user_memberships").update({
    user_id: authUser.id,
    role_name: "manager",
    dossier_scope: null,
    status: "active",
    accepted_at: new Date().toISOString(),
    invitation_token: null,
    invitation_expires_at: null,
  }).eq("id", membership.id);
  if (activated.error) {
    await admin.auth.admin.deleteUser(authUser.id);
    return NextResponse.json({ message: `Impossible d'activer l'accès Collaborateur : ${activated.error.message}` }, { status: 400 });
  }

  await admin.from("users").upsert({ id: authUser.id, email, full_name: fullName, phone, company: company?.raison_sociale ?? null });
  await logAdminAudit({
    adminEmail: email,
    action: "MEMBER_ACCEPT_INVITATION",
    entityType: "user_membership",
    entityId: membership.id,
    entityLabel: email,
    companyId: membership.company_id,
    newValues: { user_id: authUser.id, role_name: "manager", status: "active" },
  });

  return NextResponse.json({
    success: true,
    email,
    redirect: company?.user_type === "fiduciaire" ? "/comptable-pro" : "/tableau-de-bord",
  });
}
