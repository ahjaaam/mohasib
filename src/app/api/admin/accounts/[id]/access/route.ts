import { NextResponse } from "next/server";
import { logAdminAudit, requireAdminApi } from "@/lib/admin-api";
import { calculatePricing, normalizePricingConfiguration } from "@/lib/pricing";
import { nextSubscriptionEnd } from "@/lib/subscription-dates";

const STATUSES = ["free", "trial", "active", "grace", "expired"] as const;

function validIsoDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, admin, response } = await requireAdminApi();
  if (response) return response;

  const body = await request.json();
  if (!STATUSES.includes(body.status)) {
    return NextResponse.json({ message: "Statut invalide" }, { status: 400 });
  }

  const { data: company } = await admin!.from("companies").select("*").eq("id", id).maybeSingle();
  if (!company) return NextResponse.json({ message: "Compte introuvable" }, { status: 404 });

  const restarting = body.restart === true;
  const status = restarting ? "active" : body.status;
  const endDate = restarting ? nextSubscriptionEnd(body.billing_period) : body.ends_at || null;
  if (endDate && !validIsoDate(endDate)) {
    return NextResponse.json({ message: "Date de fin invalide" }, { status: 400 });
  }
  if (status === "active" && !endDate) {
    return NextResponse.json({ message: "La date de fin est obligatoire pour un accès actif" }, { status: 400 });
  }
  const today = new Date().toISOString().slice(0, 10);
  if (status === "active" && endDate! < today) {
    return NextResponse.json({ message: "La date de fin d’un accès actif ne peut pas être passée" }, { status: 400 });
  }
  const pricingConfiguration = normalizePricingConfiguration(company.pricing_configuration);
  if (status === "active" && !pricingConfiguration) {
    return NextResponse.json({ message: "Enregistrez d’abord la configuration tarifaire du compte." }, { status: 400 });
  }
  const pricing = pricingConfiguration ? calculatePricing(pricingConfiguration) : null;
  const billingPeriod = body.billing_period === "annual" ? "annual" : "monthly";
  const amountMad = status === "active" && pricing
    ? billingPeriod === "annual" ? pricing.annualTotal : pricing.monthlyTotal
    : 0;
  const paidPlan = pricingConfiguration?.audience ?? "custom";
  const updateValues = {
    plan: status === "free" ? "free" : status === "trial" ? "trial" : paidPlan,
    subscription_status: status,
    subscription_ends_at: status === "free" ? null : status === "trial" ? company.subscription_ends_at : endDate,
    trial_ends_at: status === "free" ? null : status === "trial" && endDate ? `${endDate}T23:59:59.999Z` : company.trial_ends_at,
    scheduled_plan: null,
    scheduled_plan_date: null,
  };
  const transition = await admin!.rpc("admin_set_company_access_priced", {
    p_company_id: id,
    p_status: status,
    p_end_date: endDate,
    p_billing_period: billingPeriod,
    p_amount_mad: amountMad,
    p_payment_method: body.payment_method || null,
    p_payment_reference: body.payment_reference || null,
    p_created_by_email: user!.email,
    p_restart: restarting,
    p_plan: paidPlan,
    p_pricing_configuration: pricingConfiguration,
    p_quoted_monthly_mad: pricing?.monthlyTotal ?? null,
  });
  if (transition.error) return NextResponse.json({ message: transition.error.message }, { status: 400 });

  await logAdminAudit({
    adminEmail: user!.email!,
    action: "ACCOUNT_ACCESS_UPDATE",
    entityType: "company",
    entityId: id,
    entityLabel: company.raison_sociale,
    companyId: id,
    oldValues: { plan: company.plan, subscription_status: company.subscription_status, subscription_ends_at: company.subscription_ends_at },
    newValues: updateValues,
  });
  return NextResponse.json({ ok: true, status, endsAt: endDate, amountMad, pricing });
}
