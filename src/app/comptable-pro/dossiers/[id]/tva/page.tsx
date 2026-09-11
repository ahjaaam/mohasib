export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import TvaClient from "./TvaClient";
import { resolveAccountOwnerId } from "@/lib/account-owner";
import { isMissingDatabaseColumn } from "@/lib/schema-compatibility";

export default async function TvaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");
  const ownerId = await resolveAccountOwnerId(user.id);

  let dossierRes = await supabase
    .from("dossiers")
    .select("id, raison_sociale, ice, if_fiscal, rc, regime_tva, tva_tax_point")
    .eq("id", id)
    .eq("fiduciaire_user_id", ownerId)
    .single();

  if (isMissingDatabaseColumn(dossierRes.error, "dossiers", "tva_tax_point")) {
    const legacyDossierRes = await supabase
      .from("dossiers")
      .select("id, raison_sociale, ice, if_fiscal, rc, regime_tva")
      .eq("id", id)
      .eq("fiduciaire_user_id", ownerId)
      .single();
    dossierRes = {
      ...legacyDossierRes,
      data: legacyDossierRes.data ? { ...legacyDossierRes.data, tva_tax_point: "cash" } : null,
    } as typeof dossierRes;
  }

  const dossier = dossierRes.data;

  if (!dossier) notFound();

  return <TvaClient dossier={dossier} />;
}
