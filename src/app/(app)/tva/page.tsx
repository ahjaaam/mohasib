import { createClient } from "@/lib/supabase/server";
import { resolveAccountOwnerId } from "@/lib/account-owner";
import { isMissingDatabaseColumn } from "@/lib/schema-compatibility";
import TVACalculator from "./TVACalculator";

export default async function TVAPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string | string[] }>;
}) {
  const query = await searchParams;
  const requestedPeriod = typeof query.period === "string" && /^\d{4}-\d{2}$/.test(query.period)
    ? query.period
    : undefined;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const ownerId = await resolveAccountOwnerId(user!.id);

  const [initialCompanyRes, profileRes] = await Promise.all([
    supabase
      .from("companies")
      .select("id, raison_sociale, ice, if_number, rc, address, city, tva_regime, tva_assujetti, tva_taux_defaut, tva_tax_point")
      .eq("user_id", ownerId)
      .single(),
    supabase
      .from("users")
      .select("full_name")
      .eq("id", user!.id)
      .single(),
  ]);
  let companyRes = initialCompanyRes;

  // Cash basis was the behavior before migration 104. Preserve it when code
  // reaches an environment whose schema deployment is temporarily behind.
  if (isMissingDatabaseColumn(companyRes.error, "companies", "tva_tax_point")) {
    const legacyCompanyRes = await supabase
      .from("companies")
      .select("id, raison_sociale, ice, if_number, rc, address, city, tva_regime, tva_assujetti, tva_taux_defaut")
      .eq("user_id", ownerId)
      .single();
    companyRes = {
      ...legacyCompanyRes,
      data: legacyCompanyRes.data ? { ...legacyCompanyRes.data, tva_tax_point: "cash" } : null,
    } as typeof companyRes;
  }

  const { data: lockedPeriods } = companyRes.data?.id
    ? await supabase
      .from("accounting_periods")
      .select("mois, annee, lock_type, lock_reason, locked_by_email, locked_at")
      .eq("company_id", companyRes.data.id)
      .eq("is_locked", true)
      .order("annee", { ascending: false })
      .order("mois", { ascending: false })
    : { data: [] };

  return (
    <TVACalculator
      company={companyRes.data}
      userName={profileRes.data?.full_name ?? user!.email ?? ""}
      lockedPeriods={lockedPeriods ?? []}
      initialPeriod={requestedPeriod}
    />
  );
}
