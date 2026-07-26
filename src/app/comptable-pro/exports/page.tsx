export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import ExportsClient from "./ExportsClient";
import { resolveAccountOwnerId } from "@/lib/account-owner";
import { requirePlanFeature } from "@/lib/api-plan";
import { redirect } from "next/navigation";
import { resolveClientPortalRedirect } from "@/lib/team";

export default async function ExportsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");
  const clientRedirect = await resolveClientPortalRedirect(user.id);
  if (clientRedirect) redirect(clientRedirect);
  const plan = await requirePlanFeature("export_fiduciaire");
  if (plan.response) redirect("/tarifs?feature=export_fiduciaire");
  const ownerId = await resolveAccountOwnerId(user.id);
  const { data } = await supabase.from("dossiers").select("id, raison_sociale, forme_juridique, statut")
    .eq("fiduciaire_user_id", ownerId).order("raison_sociale");

  return <ExportsClient dossiers={data ?? []} />;
}
