import { NextResponse } from "next/server";
import { logAdminAudit, requireAdminApi } from "@/lib/admin-api";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const { user, admin, response } = await requireAdminApi();
  if (response) return response;
  const { status } = await request.json();
  if (!["nouveau", "contacté", "finalisé", "cancelled"].includes(status)) return NextResponse.json({ message: "Statut invalide" }, { status: 400 });
  const custom = rawId.startsWith("custom:");
  const id = rawId.replace("custom:", "");
  const table = custom ? "custom_requests" : "upgrade_requests";
  const { data: item } = await admin!.from(table).select("*").eq("id", id).maybeSingle();
  if (!item) return NextResponse.json({ message: "Demande introuvable" }, { status: 404 });
  await admin!.from(table).update({ status }).eq("id", id);
  await logAdminAudit({ adminEmail: user!.email!, action: "REQUEST_STATUS", entityType: table, entityId: id, entityLabel: item.email || item.requested_plan, companyId: item.company_id, oldValues: { status: item.status }, newValues: { status } });
  return NextResponse.json({ ok: true });
}
