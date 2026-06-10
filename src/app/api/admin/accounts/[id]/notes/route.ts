import { NextResponse } from "next/server";
import { logAdminAudit, requireAdminApi } from "@/lib/admin-api";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, admin, response } = await requireAdminApi();
  if (response) return response;
  const { notes } = await request.json();
  const { data: company } = await admin!.from("companies").select("raison_sociale, admin_notes").eq("id", id).maybeSingle();
  if (!company) return NextResponse.json({ message: "Compte introuvable" }, { status: 404 });
  await admin!.from("companies").update({ admin_notes: notes || null }).eq("id", id);
  await logAdminAudit({ adminEmail: user!.email!, action: "NOTES_UPDATE", entityType: "company", entityId: id, entityLabel: company.raison_sociale, companyId: id, oldValues: { notes: company.admin_notes }, newValues: { notes: notes || null } });
  return NextResponse.json({ ok: true });
}
