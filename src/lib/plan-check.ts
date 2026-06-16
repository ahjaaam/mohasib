import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_PLAN_LIMITS, FEATURE_COLUMNS } from "@/lib/plan-features";
import { TRIAL_LIMITS, TRIAL_USAGE_COLUMNS, type TrialFeature } from "@/lib/trial-limits";

type PlanLimitResult = {
  allowed: boolean;
  limit?: number;
  used?: number;
  reason?: "suspended" | "expired";
  overridden?: boolean;
};

export async function checkPlanLimit(companyId: string, feature: string): Promise<PlanLimitResult> {
  const supabase = createAdminClient();
  const { data: company } = await supabase
    .from("companies")
    .select("plan, ocr_used_this_month, is_suspended, subscription_status")
    .eq("id", companyId)
    .single();

  if (!company) return { allowed: false };
  if (company.is_suspended) return { allowed: false, reason: "suspended" };

  const { data: limits } = await supabase
    .from("plan_limits")
    .select("*")
    .eq("plan", company.plan ?? "trial")
    .single();

  const planLimits = limits ?? DEFAULT_PLAN_LIMITS[company.plan ?? "starter"] ?? DEFAULT_PLAN_LIMITS.starter;
  const { data: override } = await supabase
    .from("company_limit_overrides")
    .select("*")
    .eq("company_id", companyId)
    .or(`expires_at.is.null,expires_at.gte.${new Date().toISOString().slice(0, 10)}`)
    .maybeSingle();

  const effective = (column: string) => override?.[column] ?? planLimits[column];
  const premiumWriteBlocked = company.subscription_status === "expired";

  if (feature === "ocr") {
    const limit = Number(effective("ocr_limit") ?? 0);
    const used = Number(company.ocr_used_this_month ?? 0);
    return { allowed: !premiumWriteBlocked && (limit < 0 || used < limit), limit, used, reason: premiumWriteBlocked ? "expired" : undefined, overridden: override?.ocr_limit != null };
  }

  if (feature === "dossiers") {
    const limit = Number(effective("dossiers_limit") ?? 0);
    if (limit < 0) return { allowed: true, limit, used: 0 };
    const { data: owner } = await supabase.from("companies").select("user_id").eq("id", companyId).maybeSingle();
    const { count } = await supabase
      .from("dossiers")
      .select("id", { count: "exact", head: true })
      .eq("fiduciaire_user_id", owner?.user_id ?? "");
    return { allowed: !premiumWriteBlocked && (count ?? 0) < limit, limit, used: count ?? 0, reason: premiumWriteBlocked ? "expired" : undefined, overridden: override?.dossiers_limit != null };
  }

  if (feature === "multi_users") {
    const limit = Number(effective("users_limit") ?? 0);
    return { allowed: !premiumWriteBlocked && limit > 1, limit, reason: premiumWriteBlocked ? "expired" : undefined, overridden: override?.users_limit != null };
  }

  if (feature === "employees") {
    const limit = Number(effective("employee_limit") ?? 0);
    return { allowed: !premiumWriteBlocked && limit !== 0, limit, reason: premiumWriteBlocked ? "expired" : undefined, overridden: override?.employee_limit != null };
  }

  const column = FEATURE_COLUMNS[feature];
  if (!column) return { allowed: true };
  return { allowed: !premiumWriteBlocked && !!effective(column), reason: premiumWriteBlocked ? "expired" : undefined, overridden: override?.[column] != null };
}

export async function incrementOCRUsage(companyId: string): Promise<void> {
  const supabase = createAdminClient();
  const { data: company } = await supabase
    .from("companies")
    .select("ocr_used_this_month")
    .eq("id", companyId)
    .single();

  await supabase
    .from("companies")
    .update({ ocr_used_this_month: Number(company?.ocr_used_this_month ?? 0) + 1 })
    .eq("id", companyId);
}

export async function checkTrialLimit(companyId: string, feature: TrialFeature): Promise<{
  allowed: boolean;
  used: number;
  limit: number;
  isTrial: boolean;
}> {
  const supabase = createAdminClient();
  type TrialUsageCompany = {
    subscription_status: string | null;
    trial_invoices_used: number | null;
    trial_ocr_used: number | null;
    trial_bank_statements_used: number | null;
    trial_employees_used: number | null;
    trial_tva_declarations_used: number | null;
    trial_dossiers_used: number | null;
  };
  const { data } = await supabase
    .from("companies")
    .select([
      "subscription_status",
      "trial_invoices_used",
      "trial_ocr_used",
      "trial_bank_statements_used",
      "trial_employees_used",
      "trial_tva_declarations_used",
      "trial_dossiers_used",
    ].join(","))
    .eq("id", companyId)
    .single();
  const company = data as unknown as TrialUsageCompany | null;

  const isTrial = company?.subscription_status === "trial";
  if (!isTrial) return { allowed: true, used: 0, limit: -1, isTrial: false };

  const column = TRIAL_USAGE_COLUMNS[feature];
  const used = Number((company as any)?.[column] ?? 0);
  const limit = TRIAL_LIMITS[feature];
  return { allowed: used < limit, used, limit, isTrial: true };
}

export async function incrementTrialUsage(companyId: string, feature: TrialFeature): Promise<void> {
  const supabase = createAdminClient();
  await supabase.rpc("increment_trial_usage", {
    company_id_arg: companyId,
    feature_arg: feature,
  });
}
