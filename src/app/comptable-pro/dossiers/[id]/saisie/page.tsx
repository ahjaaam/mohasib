export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import SaisieClient from "./SaisieClient";
import { resolveAccountOwnerId } from "@/lib/account-owner";
import { FEATURES } from "@/lib/features";

export default async function SaisiePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!FEATURES.SAISIE_ENABLED) redirect(`/comptable-pro/dossiers/${id}/ecritures`);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");
  const ownerId = await resolveAccountOwnerId(user.id);

  const [dossierRes, ecrRes] = await Promise.all([
    supabase.from("dossiers").select("id, raison_sociale").eq("id", id).eq("fiduciaire_user_id", ownerId).single(),
    supabase.from("dossier_ecritures").select("*").eq("dossier_id", id).order("date").order("created_at"),
  ]);

  if (!dossierRes.data) notFound();

  return <SaisieClient dossier={dossierRes.data} initialEcritures={ecrRes.data ?? []} />;
}
