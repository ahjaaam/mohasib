import { NextResponse } from "next/server";
import { logAdminAudit, requireAdminApi } from "@/lib/admin-api";

const ORDER = ["trial", "starter", "business", "business_pro", "comptable_s", "comptable_pro", "comptable_inf"];

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, admin, response } = await requireAdminApi();
  if (response) return response;
  const body = await request.json();
  if (!ORDER.includes(body.plan)) return NextResponse.json({ message: "Plan invalide" }, { status: 400 });
  const { data: company } = await admin!.from("companies").select("*").eq("id", id).maybeSingle();
  if (!company) return NextResponse.json({ message: "Compte introuvable" }, { status: 404 });
  const period = body.billing_period === "annual" ? "annual" : "monthly";
  const starts = new Date();
  const ends = new Date(starts);
  ends.setMonth(ends.getMonth() + (period === "annual" ? 12 : 1));
  const downgrade = ORDER.indexOf(body.plan) < ORDER.indexOf(company.plan ?? "trial") && company.subscription_ends_at;
  if (downgrade) {
    await admin!.from("companies").update({ scheduled_plan: body.plan, scheduled_plan_date: company.subscription_ends_at }).eq("id", id);
    const scheduledEnd = new Date(company.subscription_ends_at);
    scheduledEnd.setMonth(scheduledEnd.getMonth() + (period === "annual" ? 12 : 1));
    await admin!.from("subscriptions").insert({ company_id: id, plan: body.plan, previous_plan: company.plan, change_type: "downgrade", billing_period: period, amount_mad: Number(body.amount_mad ?? 0), payment_method: body.payment_method || null, payment_reference: body.payment_reference || null, starts_at: company.subscription_ends_at, ends_at: scheduledEnd.toISOString().slice(0, 10), status: "scheduled", created_by_email: user!.email });
  } else {
    await admin!.from("companies").update({ plan: body.plan, subscription_status: "active", subscription_ends_at: ends.toISOString().slice(0, 10), scheduled_plan: null, scheduled_plan_date: null }).eq("id", id);
    await admin!.from("subscriptions").update({ status: "cancelled" }).eq("company_id", id).eq("status", "active");
    await admin!.from("subscriptions").insert({ company_id: id, plan: body.plan, previous_plan: company.plan, change_type: company.plan === body.plan ? "renewal" : "upgrade", billing_period: period, amount_mad: Number(body.amount_mad ?? 0), payment_method: body.payment_method || null, payment_reference: body.payment_reference || null, starts_at: starts.toISOString().slice(0, 10), ends_at: ends.toISOString().slice(0, 10), status: "active", created_by_email: user!.email });
  }
  await logAdminAudit({ adminEmail: user!.email!, action: downgrade ? "PLAN_SCHEDULE" : "PLAN_CHANGE", entityType: "company", entityId: id, entityLabel: company.raison_sociale, companyId: id, oldValues: { plan: company.plan }, newValues: { plan: body.plan, billing_period: period, scheduled: !!downgrade } });
  return NextResponse.json({ ok: true });
}
