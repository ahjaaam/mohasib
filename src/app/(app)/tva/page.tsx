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

  return (
    <TVACalculator
      company={companyRes.data}
      userName={profileRes.data?.full_name ?? user!.email ?? ""}
    />
  );
}
