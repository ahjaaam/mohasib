export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import ExportClient from "./ExportClient";
import { resolveAccountOwnerId } from "@/lib/account-owner";

export default async function ExportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");
  const ownerId = await resolveAccountOwnerId(user.id);

  const { data: dossier } = await supabase
    .from("dossiers")
    .select("id, raison_sociale")
    .eq("id", id)
    .eq("fiduciaire_user_id", ownerId)
    .single();

  if (!dossier) notFound();

  return <ExportClient dossier={dossier} />;
}
