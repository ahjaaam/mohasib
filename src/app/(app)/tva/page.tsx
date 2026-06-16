import { createClient } from "@/lib/supabase/server";
import { resolveAccountOwnerId } from "@/lib/account-owner";
import TVACalculator from "./TVACalculator";

export default async function TVAPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const ownerId = await resolveAccountOwnerId(user!.id);

  const [companyRes, profileRes] = await Promise.all([
    supabase
      .from("companies")
      .select("id, raison_sociale, ice, if_number, rc, address, city, tva_regime, tva_assujetti, tva_taux_defaut")
      .eq("user_id", ownerId)
      .single(),
    supabase
      .from("users")
      .select("full_name")
      .eq("id", user!.id)
      .single(),
  ]);

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
    />
  );
}
