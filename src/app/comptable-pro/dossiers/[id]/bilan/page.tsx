export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import BilanClient from "./BilanClient";
import { resolveAccountOwnerId } from "@/lib/account-owner";
import { requirePlanFeature } from "@/lib/api-plan";
import { FEATURES } from "@/lib/features";

export default async function BilanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!FEATURES.BILAN_ENABLED) redirect(`/comptable-pro/dossiers/${id}/export`);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");
  const plan = await requirePlanFeature("bilan");
  if (plan.response) redirect("/tarifs?feature=bilan");
  const ownerId = await resolveAccountOwnerId(user.id);

  const [dossierRes, ecrRes, invRes, txRes, cabinetRes] = await Promise.all([
    supabase.from("dossiers")
      .select("id, raison_sociale, forme_juridique, ice, rc, if_fiscal, capital_social, solde_banque_initial, solde_caisse_initial, dettes_fournisseurs_initiales, creances_clients_initiales, date_debut_exercice, contact_email")
      .eq("id", id).eq("fiduciaire_user_id", ownerId).single(),
    supabase.from("dossier_ecritures").select("*").eq("dossier_id", id).order("date"),
    supabase.from("invoices").select("id, issue_date, total, status").eq("dossier_id", id).order("issue_date"),
    supabase.from("transactions").select("id, date, amount, type, category").eq("dossier_id", id).order("date"),
    supabase.from("cabinets").select("nom_cabinet, ice, rc, if_fiscal, email").eq("user_id", ownerId).maybeSingle(),
  ]);

  if (!dossierRes.data) notFound();

  return (
    <BilanClient
      dossier={dossierRes.data}
      ecritures={ecrRes.data ?? []}
      invoices={(invRes.data ?? []) as any[]}
      transactions={(txRes.data ?? []) as any[]}
      cabinet={cabinetRes.data ?? null}
    />
  );
}
