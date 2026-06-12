export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import ExportsClient from "./ExportsClient";
import type { Dossier } from "@/types/fiduciaire";
import { resolveAccountOwnerId } from "@/lib/account-owner";

export default async function ExportsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const ownerId = await resolveAccountOwnerId(user!.id);
  const { data } = await supabase.from("dossiers").select("id, raison_sociale, forme_juridique, statut")
    .eq("fiduciaire_user_id", ownerId).order("raison_sociale");

  return <ExportsClient dossiers={data ?? []} />;
}
