"use server";

import { createClient } from "@/lib/supabase/server";
import { DEFAULT_ENABLED_CODES, TVA_LINES, withAlwaysShown } from "@/lib/tva-lines-registry";

type TVALineConfigRow = {
  line_code: number;
  is_enabled: boolean;
  period: string | null;
};

function allCodes() {
  return TVA_LINES.map((line) => line.code);
}

function enabledFromRows(rows: TVALineConfigRow[]) {
  return rows.filter((row) => row.is_enabled).map((row) => row.line_code);
}

async function assertCompanyOwner(supabase: any, companyId: string, userId: string) {
  const { data } = await supabase
    .from("companies")
    .select("id")
    .eq("id", companyId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

export async function getTVAConfig(companyId: string, period?: string | null) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { enabledCodes: Array.from(DEFAULT_ENABLED_CODES), hasPeriodOverride: false, locked: false };

  const ownsCompany = await assertCompanyOwner(supabase, companyId, user.id);
  if (!ownsCompany) return { enabledCodes: Array.from(DEFAULT_ENABLED_CODES), hasPeriodOverride: false, locked: false };

  const { data: globalRows } = await supabase
    .from("tva_line_config")
    .select("line_code, is_enabled, period")
    .eq("company_id", companyId)
    .is("dossier_id", null)
    .is("period", null);

  let periodRows: TVALineConfigRow[] | null = null;
  if (period) {
    const { data } = await supabase
      .from("tva_line_config")
      .select("line_code, is_enabled, period")
      .eq("company_id", companyId)
      .is("dossier_id", null)
      .eq("period", period);
    periodRows = (data ?? []) as TVALineConfigRow[];
  }

  const globalEnabled = (globalRows?.length ?? 0) > 0
    ? enabledFromRows((globalRows ?? []) as TVALineConfigRow[])
    : Array.from(DEFAULT_ENABLED_CODES);
  const periodEnabled = periodRows && periodRows.length > 0 ? enabledFromRows(periodRows) : null;
  const enabledCodes = Array.from(withAlwaysShown(periodEnabled ?? globalEnabled)).sort((a, b) => a - b);

  let locked = false;
  if (period) {
    const [year, month] = period.split("-").map(Number);
    const endDay = new Date(year, month, 0).getDate();
    const { data: decl } = await supabase
      .from("tva_declarations")
      .select("id, statut, status")
      .eq("company_id", companyId)
      .gte("period_start", `${period}-01`)
      .lte("period_start", `${period}-${String(endDay).padStart(2, "0")}`)
      .maybeSingle();
    const status = String(decl?.statut ?? decl?.status ?? "").toLowerCase();
    locked = status === "validé" || status === "depose" || status === "déposé" || status === "filed";
  }

  return {
    enabledCodes,
    hasPeriodOverride: !!periodRows?.length,
    locked,
  };
}

export async function saveTVAConfig(companyId: string, enabledCodes: number[], period: string | null) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié" };

  const ownsCompany = await assertCompanyOwner(supabase, companyId, user.id);
  if (!ownsCompany) return { error: "Entreprise introuvable" };

  const enabled = withAlwaysShown(enabledCodes);
  const rows = allCodes().map((code) => ({
    company_id: companyId,
    dossier_id: null,
    period,
    line_code: code,
    is_enabled: enabled.has(code),
    updated_at: new Date().toISOString(),
  }));

  let deleteQuery = supabase
    .from("tva_line_config")
    .delete()
    .eq("company_id", companyId)
    .is("dossier_id", null);

  deleteQuery = period
    ? deleteQuery.eq("period", period)
    : deleteQuery.is("period", null);

  const { error: deleteError } = await deleteQuery;
  if (deleteError) return { error: deleteError.message };

  const { error: insertError } = await supabase.from("tva_line_config").insert(rows);
  if (insertError) return { error: insertError.message };

  return {
    enabled_count: enabled.size,
    metadata: { event: "TVA_CONFIG_UPDATED", period, enabled_count: enabled.size },
  };
}
