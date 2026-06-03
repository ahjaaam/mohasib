import { createClient } from "@/lib/supabase/server";

type PlanLimitResult = {
  allowed: boolean;
  limit?: number;
  used?: number;
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
};

export async function checkPlanLimit(companyId: string, feature: string): Promise<PlanLimitResult> {
  const supabase = await createClient();
  const { data: company } = await supabase
    .from("companies")
    .select("plan, ocr_used_this_month")
    .eq("id", companyId)
    .single();

  if (!company) return { allowed: false };

  const { data: limits } = await supabase
    .from("plan_limits")
    .select("*")
    .eq("plan", company.plan ?? "trial")
    .single();

  if (!limits) return { allowed: true };

  if (feature === "ocr") {
    const limit = Number(limits.ocr_limit ?? 0);
    const used = Number(company.ocr_used_this_month ?? 0);
    return { allowed: limit < 0 || used < limit, limit, used };
  }

  if (feature === "dossiers") {
    const limit = Number(limits.dossiers_limit ?? 0);
    if (limit < 0) return { allowed: true, limit, used: 0 };
    const { count } = await supabase
      .from("dossiers")
      .select("id", { count: "exact", head: true })
      .eq("fiduciaire_user_id", (await supabase.auth.getUser()).data.user?.id ?? "");
    return { allowed: (count ?? 0) < limit, limit, used: count ?? 0 };
  }

  const column = FEATURE_COLUMNS[feature];
  if (!column) return { allowed: true };
  return { allowed: !!limits[column] };
}

export async function incrementOCRUsage(companyId: string): Promise<void> {
  const supabase = await createClient();
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
