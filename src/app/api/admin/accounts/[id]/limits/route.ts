import { NextResponse } from "next/server";
import { logAdminAudit, requireAdminApi } from "@/lib/admin-api";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, admin, response } = await requireAdminApi();
  if (response) return response;
  const body = await request.json();
  if (body.reset) {
    const { data: old } = await admin!.from("company_limit_overrides").select("*").eq("company_id", id).maybeSingle();
    await admin!.from("company_limit_overrides").delete().eq("company_id", id);
    await logAdminAudit({ adminEmail: user!.email!, action: "LIMIT_OVERRIDE_RESET", entityType: "company_limit_override", entityId: old?.id, companyId: id, oldValues: old, newValues: null });
    return NextResponse.json({ ok: true });
  }
  if (!body.reason) return NextResponse.json({ message: "Le motif est obligatoire" }, { status: 400 });
  const numeric = (key: string) => body[key] === "" || body[key] == null ? null : Number(body[key]);
  const flag = (key: string) => body[key] === "" || body[key] == null ? null : body[key] === "true";
  const values = { company_id: id, ocr_limit: numeric("ocr_limit"), storage_gb: numeric("storage_gb"), dossiers_limit: numeric("dossiers_limit"), users_limit: numeric("users_limit"), has_paie: flag("has_paie"), has_bank_import: flag("has_bank_import"), has_saisie: flag("has_saisie"), has_export_fiduciaire: flag("has_export_fiduciaire"), has_avoirs: flag("has_avoirs"), has_bilan: flag("has_bilan"), has_mass_declarations: flag("has_mass_declarations"), has_whatsapp_agent: flag("has_whatsapp_agent"), reason: body.reason, expires_at: body.expires_at || null, created_by_email: user!.email, updated_at: new Date().toISOString() };
  const { data: old } = await admin!.from("company_limit_overrides").select("*").eq("company_id", id).maybeSingle();
  const { error } = await admin!.from("company_limit_overrides").upsert(values, { onConflict: "company_id" });
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  await logAdminAudit({ adminEmail: user!.email!, action: "LIMIT_OVERRIDE", entityType: "company_limit_override", entityId: old?.id, companyId: id, oldValues: old, newValues: values });
  return NextResponse.json({ ok: true });
}
