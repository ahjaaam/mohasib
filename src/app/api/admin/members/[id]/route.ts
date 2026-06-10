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
  await admin!.from("user_memberships").update({ status }).eq("id", id);
  await logAdminAudit({ adminEmail: user!.email!, action: suspended ? "MEMBER_SUSPEND" : "MEMBER_REACTIVATE", entityType: "user_membership", entityId: id, entityLabel: member.user_email, companyId: member.company_id, oldValues: { status: member.status }, newValues: { status } });
  return NextResponse.json({ ok: true });
}
