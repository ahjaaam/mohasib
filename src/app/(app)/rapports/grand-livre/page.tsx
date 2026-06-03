export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import GrandLivreView from "@/components/GrandLivreView";

export default async function GrandLivrePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  const { data: company } = await supabase
    .from("companies")
    .select("id, raison_sociale")
    .eq("user_id", user.id)
    .single();

  return (
    <GrandLivreView
      companyId={company?.id ?? null}
      title={company?.raison_sociale ? `Grand Livre — ${company.raison_sociale}` : "Grand Livre"}
    />
  );
}
