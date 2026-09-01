import { NextResponse } from "next/server";
import { logAdminAudit, requireAdminApi } from "@/lib/admin-api";
import {
  calculatePricing,
  normalizePricingConfiguration,
  pricingEntitlements,
} from "@/lib/pricing";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, admin, response } = await requireAdminApi();
  if (response) return response;

  const configuration = normalizePricingConfiguration(await request.json());
  if (!configuration) {
    return NextResponse.json({ message: "Configuration tarifaire invalide" }, { status: 400 });
  }

  const { data: company } = await admin!.from("companies").select("*").eq("id", id).maybeSingle();
  if (!company) return NextResponse.json({ message: "Compte introuvable" }, { status: 404 });

  const result = calculatePricing(configuration);
  const entitlements = pricingEntitlements(configuration);
  const pricingUpdate = await admin!.rpc("admin_save_company_pricing", {
    p_company_id: id,
    p_plan: configuration.audience,
    p_pricing_configuration: configuration,
    p_quoted_monthly_mad: result.monthlyTotal,
    p_ocr_limit: entitlements.ocrLimit,
    p_storage_gb: -1,
    p_dossiers_limit: entitlements.dossiersLimit,
    p_users_limit: entitlements.usersLimit,
    p_employee_limit: entitlements.employeeLimit,
    p_created_by_email: user!.email,
  });
  if (pricingUpdate.error) {
    const migrationHint = pricingUpdate.error.message.includes("admin_save_company_pricing")
      ? " Appliquez d’abord la migration 091_current_pricing_configuration.sql."
      : "";
    return NextResponse.json({ message: `${pricingUpdate.error.message}${migrationHint}` }, { status: 400 });
  }
  const pricingRow = Array.isArray(pricingUpdate.data) ? pricingUpdate.data[0] : pricingUpdate.data;
  const companyPlan = pricingRow?.company_plan ?? company.plan;
  const activeSubscriptionsUpdated = Number(pricingRow?.active_subscriptions_updated ?? 0);

  await logAdminAudit({
    adminEmail: user!.email!,
    action: "PRICING_CONFIGURATION_UPDATE",
    entityType: "company",
    entityId: id,
    entityLabel: company.raison_sociale,
    companyId: id,
    oldValues: {
      plan: company.plan,
      pricing_configuration: company.pricing_configuration,
      quoted_monthly_mad: company.quoted_monthly_mad,
    },
    newValues: {
      plan: companyPlan,
      pricing_configuration: configuration,
      quoted_monthly_mad: result.monthlyTotal,
      entitlements,
      active_subscriptions_updated: activeSubscriptionsUpdated,
    },
  });

  return NextResponse.json({ ok: true, configuration, result, entitlements });
}
