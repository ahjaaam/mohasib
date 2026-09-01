import { NextResponse } from "next/server";
import { logAdminAudit, requireAdminApi } from "@/lib/admin-api";

const ACCESS_SCOPES = ["business_only", "comptable_pro_only", "both"] as const;
type AccessScope = typeof ACCESS_SCOPES[number];

function isAccessScope(value: unknown): value is AccessScope {
  return ACCESS_SCOPES.includes(value as AccessScope);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, admin, response } = await requireAdminApi();
  if (response) return response;
  const body = await request.json();
  const { data: member } = await admin!.from("user_memberships").select("*").eq("id", id).maybeSingle();
  if (!member) return NextResponse.json({ message: "Membre introuvable" }, { status: 404 });

  if (body.access_scope !== undefined) {
    if (!isAccessScope(body.access_scope)) return NextResponse.json({ message: "Périmètre d'accès invalide." }, { status: 400 });
    const update = await admin!.from("user_memberships").update({ access_scope: body.access_scope }).eq("id", id);
    if (update.error) return NextResponse.json({ message: update.error.message }, { status: 400 });

    await logAdminAudit({
      adminEmail: user!.email!,
      action: "MEMBER_ACCESS_SCOPE_UPDATE",
      entityType: "user_membership",
      entityId: id,
      entityLabel: member.user_email,
      companyId: member.company_id,
      oldValues: { access_scope: member.access_scope ?? "both" },
      newValues: { access_scope: body.access_scope },
    });
    return NextResponse.json({ ok: true });
  }

  const { suspended } = body;
  const status = suspended ? "suspended" : "active";
  const membershipUpdate = await admin!.from("user_memberships").update({ status }).eq("id", id).select("id,status").maybeSingle();
  if (membershipUpdate.error) return NextResponse.json({ message: membershipUpdate.error.message }, { status: 400 });
  if (!membershipUpdate.data || membershipUpdate.data.status !== status) {
    return NextResponse.json({ message: "L’accès du membre n’a pas pu être modifié." }, { status: 409 });
  }

  if (!suspended && member.user_id) {
    const unban = await admin!.auth.admin.updateUserById(member.user_id, { ban_duration: "none" });
    if (unban.error) {
      const rollback = await admin!.from("user_memberships").update({ status: member.status }).eq("id", id);
      return NextResponse.json({
        message: `Le blocage Auth n'a pas pu être retiré : ${unban.error.message}${rollback.error ? `; restauration de l’accès incomplète (${rollback.error.message})` : ""}`,
      }, { status: 400 });
    }
  }

  await logAdminAudit({ adminEmail: user!.email!, action: suspended ? "MEMBER_SUSPEND" : "MEMBER_REACTIVATE", entityType: "user_membership", entityId: id, entityLabel: member.user_email, companyId: member.company_id, oldValues: { status: member.status }, newValues: { status, auth_unbanned: !suspended && !!member.user_id } });
  return NextResponse.json({ ok: true });
}
