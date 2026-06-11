import { NextResponse } from "next/server";
import { logAdminAudit, requireAdminApi } from "@/lib/admin-api";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, admin, response } = await requireAdminApi();
  if (response) return response;
  const { suspended } = await request.json();
  const { data: member } = await admin!.from("user_memberships").select("*").eq("id", id).maybeSingle();
  if (!member) return NextResponse.json({ message: "Membre introuvable" }, { status: 404 });
  const status = suspended ? "suspended" : "active";
  const membershipUpdate = await admin!.from("user_memberships").update({ status }).eq("id", id);
  if (membershipUpdate.error) return NextResponse.json({ message: membershipUpdate.error.message }, { status: 400 });

  if (!suspended && member.user_id) {
    const unban = await admin!.auth.admin.updateUserById(member.user_id, { ban_duration: "none" });
    if (unban.error) {
      return NextResponse.json({ message: `Accès réactivé, mais le blocage Auth n'a pas pu être retiré : ${unban.error.message}` }, { status: 400 });
    }
  }

  await logAdminAudit({ adminEmail: user!.email!, action: suspended ? "MEMBER_SUSPEND" : "MEMBER_REACTIVATE", entityType: "user_membership", entityId: id, entityLabel: member.user_email, companyId: member.company_id, oldValues: { status: member.status }, newValues: { status, auth_unbanned: !suspended && !!member.user_id } });
  return NextResponse.json({ ok: true });
}
