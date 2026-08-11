import { NextResponse } from "next/server";
import { requireAdminApi, logAdminAudit } from "@/lib/admin-api";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, admin, response } = await requireAdminApi();
  if (response) return response;
  const body = await request.json();
  const { data: company } = await admin!.from("companies").select("raison_sociale,admin_tags,admin_owner_email,lifecycle_stage,archived_at").eq("id", id).maybeSingle();
  if (!company) return NextResponse.json({ message: "Compte introuvable." }, { status: 404 });
  const lifecycle = ["lead", "onboarding", "active", "at_risk", "churned", "archived"].includes(String(body.lifecycle_stage)) ? String(body.lifecycle_stage) : "active";
  const tags = Array.isArray(body.admin_tags) ? body.admin_tags : String(body.admin_tags ?? "").split(",");
  const values = {
    admin_tags: [...new Set(tags.map((tag: unknown) => String(tag).trim().toLowerCase()).filter(Boolean))].slice(0, 20),
    admin_owner_email: String(body.admin_owner_email ?? "").trim().toLowerCase() || null,
    lifecycle_stage: lifecycle,
    archived_at: lifecycle === "archived" ? company.archived_at || new Date().toISOString() : null,
  };
  const result = await admin!.from("companies").update(values).eq("id", id);
  if (result.error) return NextResponse.json({ message: result.error.message }, { status: 400 });
  await logAdminAudit({ adminEmail: user!.email!, action: "ACCOUNT_METADATA", entityType: "company", entityId: id, entityLabel: company.raison_sociale, companyId: id, oldValues: company, newValues: values });
  return NextResponse.json({ ok: true });
}
