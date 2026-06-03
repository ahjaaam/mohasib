export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import TvaClient from "./TvaClient";

export default async function TvaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  const { data: dossier } = await supabase
    .from("dossiers")
    .select("id, raison_sociale, ice, if_fiscal, rc, regime_tva")
    .eq("id", id)
    .eq("fiduciaire_user_id", user.id)
    .single();

  if (!dossier) notFound();

  return <TvaClient dossier={dossier} />;
}
