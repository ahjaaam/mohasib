import { NextResponse } from "next/server";
import { logAdminAudit, requireAdminApi } from "@/lib/admin-api";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, admin, response } = await requireAdminApi();
  if (response) return response;
  const { days } = await request.json();
  const count = Math.max(1, Number(days ?? 7));
  const { data: company } = await admin!.from("companies").select("*").eq("id", id).maybeSingle();
  if (!company) return NextResponse.json({ message: "Compte introuvable" }, { status: 404 });
  const base = company.trial_ends_at && new Date(company.trial_ends_at) > new Date() ? new Date(company.trial_ends_at) : new Date();
  base.setDate(base.getDate() + count);
  await admin!.from("companies").update({ trial_ends_at: base.toISOString(), subscription_ends_at: base.toISOString().slice(0, 10), subscription_status: "trial" }).eq("id", id);
  await admin!.from("subscriptions").insert({ company_id: id, plan: company.plan || "trial", previous_plan: company.plan, change_type: "trial_extension", billing_period: "monthly", amount_mad: 0, payment_method: "gratuit", starts_at: new Date().toISOString().slice(0, 10), ends_at: base.toISOString().slice(0, 10), status: "active", created_by_email: user!.email });
  await logAdminAudit({ adminEmail: user!.email!, action: "TRIAL_EXTEND", entityType: "company", entityId: id, entityLabel: company.raison_sociale, companyId: id, oldValues: { trial_ends_at: company.trial_ends_at }, newValues: { trial_ends_at: base.toISOString(), days: count } });
  return NextResponse.json({ ok: true });
}
