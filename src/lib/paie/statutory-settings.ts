import type { PayrollAmoRegime } from "@/lib/payroll";

export interface PayrollStatutorySettings {
  amo_regime: PayrollAmoRegime;
  tfp_exempt: boolean;
}

type QueryResult = {
  data: { payroll_amo_regime?: unknown; payroll_tfp_exempt?: unknown } | null;
  error: { message: string } | null;
};

export async function loadPayrollStatutorySettings(
  supabase: any,
  scope: { companyId?: string | null; dossierId?: string | null },
): Promise<PayrollStatutorySettings> {
  let result: QueryResult;
  if (scope.dossierId) {
    result = await supabase
      .from("dossiers")
      .select("payroll_amo_regime, payroll_tfp_exempt")
      .eq("id", scope.dossierId)
      .single();
  } else if (scope.companyId) {
    result = await supabase
      .from("companies")
      .select("payroll_amo_regime, payroll_tfp_exempt")
      .eq("id", scope.companyId)
      .single();
  } else {
    throw new Error("Périmètre employeur introuvable");
  }

  if (result.error || !result.data) {
    throw new Error(result.error?.message ?? "Configuration sociale employeur introuvable");
  }

  return {
    amo_regime: result.data.payroll_amo_regime === "solidarity_only" ? "solidarity_only" : "standard",
    tfp_exempt: result.data.payroll_tfp_exempt === true,
  };
}
