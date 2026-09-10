export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserAccessProfile, resolveClientPortalRedirect } from "@/lib/team";
import { resolveAccountOwnerId } from "@/lib/account-owner";

export default async function ComptableProEntryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  const clientRedirect = await resolveClientPortalRedirect(user.id);
  if (clientRedirect) redirect(clientRedirect);

  const [ownerId, access, cookieStore] = await Promise.all([
    resolveAccountOwnerId(user.id),
    getUserAccessProfile(user.id),
    cookies(),
  ]);

  let dossiersQuery = supabase
    .from("dossiers")
    .select("id")
    .eq("fiduciaire_user_id", ownerId)
    .eq("statut", "actif")
    .order("raison_sociale");

  if (access.dossierScope?.length) {
    dossiersQuery = dossiersQuery.in("id", access.dossierScope);
  }

  const { data: dossiers } = await dossiersQuery;
  if (!dossiers?.length) redirect("/comptable-pro/dossiers/nouveau");

  const lastDossierId = cookieStore.get("last_dossier_id")?.value;
  const destinationId = dossiers.some((dossier) => dossier.id === lastDossierId)
    ? lastDossierId
    : dossiers[0].id;

  redirect(`/comptable-pro/dossiers/${destinationId}/tableau-de-bord`);
}
