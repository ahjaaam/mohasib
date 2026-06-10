import { NextResponse } from "next/server";
import { logAdminAudit, requireAdminApi } from "@/lib/admin-api";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, admin, response } = await requireAdminApi();
  if (response) return response;
  const body = await request.json();
  if (body.suspended && !body.reason) return NextResponse.json({ message: "Le motif est obligatoire" }, { status: 400 });
  const { data: company } = await admin!.from("companies").select("*").eq("id", id).maybeSingle();
  if (!company) return NextResponse.json({ message: "Compte introuvable" }, { status: 404 });
  await admin!.from("companies").update({ is_suspended: !!body.suspended, suspended_reason: body.suspended ? body.reason : null }).eq("id", id);
  await logAdminAudit({ adminEmail: user!.email!, action: body.suspended ? "ACCOUNT_SUSPEND" : "ACCOUNT_REACTIVATE", entityType: "company", entityId: id, entityLabel: company.raison_sociale, companyId: id, oldValues: { is_suspended: company.is_suspended }, newValues: { is_suspended: !!body.suspended, reason: body.reason || null } });
  return NextResponse.json({ ok: true });
}
