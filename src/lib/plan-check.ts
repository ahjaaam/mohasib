import { createAdminClient } from "@/lib/supabase/admin";

type PlanLimitResult = {
  allowed: boolean;
  limit?: number;
  used?: number;
  reason?: "suspended" | "expired";
  overridden?: boolean;
};

const FEATURE_COLUMNS: Record<string, string> = {
  bank_import: "has_bank_import",
  saisie: "has_saisie",
  paie: "has_paie",
  export_fiduciaire: "has_export_fiduciaire",
  avoirs: "has_avoirs",
  bilan: "has_bilan",
  mass_declarations: "has_mass_declarations",
  whatsapp_agent: "has_whatsapp_agent",
  multi_users: "users_limit",
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

  if (!limits) return { allowed: true };
  const { data: override } = await supabase
    .from("company_limit_overrides")
    .select("*")
    .eq("company_id", companyId)
    .or(`expires_at.is.null,expires_at.gte.${new Date().toISOString().slice(0, 10)}`)
    .maybeSingle();

  const effective = (column: string) => override?.[column] ?? limits[column];
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
