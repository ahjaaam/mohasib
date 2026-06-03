export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import SaisieClient from "./SaisieClient";

export default async function SaisiePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  const [dossierRes, ecrRes] = await Promise.all([
    supabase.from("dossiers").select("id, raison_sociale").eq("id", id).eq("fiduciaire_user_id", user.id).single(),
    supabase.from("dossier_ecritures").select("*").eq("dossier_id", id).order("date").order("created_at"),
  ]);

  if (!dossierRes.data) notFound();

  return <SaisieClient dossier={dossierRes.data} initialEcritures={ecrRes.data ?? []} />;
}
