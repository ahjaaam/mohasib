import { NextResponse } from "next/server";
import { Resend } from "resend";
import { requireAdminApi, logAdminAudit } from "@/lib/admin-api";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user: adminUser, admin, response } = await requireAdminApi();
  if (response) return response;
  const { action } = await request.json();
  const current = await admin!.auth.admin.getUserById(id);
  const target = current.data.user;
  if (current.error || !target?.email) return NextResponse.json({ message: "Utilisateur introuvable." }, { status: 404 });

  if (action === "verify_email") {
    const result = await admin!.auth.admin.updateUserById(id, { email_confirm: true });
    if (result.error) return NextResponse.json({ message: result.error.message }, { status: 400 });
  } else if (action === "suspend" || action === "reactivate") {
    const previousMemberships = await admin!.from("user_memberships").select("id,status").eq("user_id", id).neq("status", "revoked");
    if (previousMemberships.error) return NextResponse.json({ message: previousMemberships.error.message }, { status: 400 });
    const membershipUpdate = await admin!.from("user_memberships").update({ status: action === "suspend" ? "suspended" : "active" }).eq("user_id", id).neq("status", "revoked");
    if (membershipUpdate.error) return NextResponse.json({ message: membershipUpdate.error.message }, { status: 400 });
    const result = await admin!.auth.admin.updateUserById(id, { ban_duration: action === "suspend" ? "876000h" : "none" });
    if (result.error) {
      const rollbackErrors: string[] = [];
      for (const previous of previousMemberships.data ?? []) {
        const rollback = await admin!.from("user_memberships").update({ status: previous.status }).eq("id", previous.id);
        if (rollback.error) rollbackErrors.push(rollback.error.message);
      }
      return NextResponse.json({
        message: `${result.error.message}${rollbackErrors.length ? `; restauration des accès incomplète (${rollbackErrors.join("; ")})` : ""}`,
      }, { status: 400 });
    }
  } else if (action === "password_reset") {
    const generated = await admin!.auth.admin.generateLink({ type: "recovery", email: target.email });
    const actionLink = generated.data.properties?.action_link;
    if (generated.error || !actionLink) return NextResponse.json({ message: generated.error?.message || "Lien impossible à générer." }, { status: 400 });
    if (!process.env.RESEND_API_KEY) return NextResponse.json({ message: "RESEND_API_KEY n’est pas configurée." }, { status: 503 });
    const sent = await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: process.env.RESEND_FROM_EMAIL || "Mohasib <noreply@mohasibai.com>",
      to: target.email,
      subject: "Réinitialisation de votre mot de passe Mohasib",
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto"><h2>Réinitialisez votre mot de passe</h2><p>Un administrateur Mohasib a demandé l’envoi de ce lien sécurisé.</p><p><a href="${actionLink}">Choisir un nouveau mot de passe</a></p><p>Ignorez cet email si vous n’attendiez pas cette demande.</p></div>`,
    });
    if (sent.error) return NextResponse.json({ message: sent.error.message }, { status: 502 });
  } else {
    return NextResponse.json({ message: "Action invalide." }, { status: 400 });
  }

  await logAdminAudit({ adminEmail: adminUser!.email!, action: `USER_${String(action).toUpperCase()}`, entityType: "auth_user", entityId: id, entityLabel: target.email });
  return NextResponse.json({ ok: true });
}
