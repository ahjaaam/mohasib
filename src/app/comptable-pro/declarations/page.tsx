export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import type { DossierTva } from "@/types/fiduciaire";
import DeclarationsClient from "./DeclarationsClient";

export default async function DeclarationsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const { year: yearStr, month: monthStr } = await searchParams;
  const now = new Date();
  const year = parseInt(yearStr ?? String(now.getFullYear()));
  const month = parseInt(monthStr ?? String(now.getMonth() + 1));

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const periode = `${year}-${String(month).padStart(2, "0")}`;

  const [dossiersRes, tvaRes] = await Promise.all([
    supabase.from("dossiers").select("id, raison_sociale, forme_juridique, regime_tva, statut, ice, if_fiscal")
      .eq("fiduciaire_user_id", user!.id).eq("statut", "actif").order("raison_sociale"),
    supabase.from("dossier_tva").select("*").eq("fiduciaire_user_id", user!.id).eq("periode", periode),
  ]);

  const dossiers = (dossiersRes.data ?? []) as Array<{ id: string; raison_sociale: string; forme_juridique: string | null; regime_tva: string | null; statut: string; ice: string | null; if_fiscal: string | null; }>;
  const tvaDecls: DossierTva[] = tvaRes.data ?? [];

  return (
    <DeclarationsClient
      dossiers={dossiers}
      tvaDecls={tvaDecls}
      year={year}
      month={month}
    />
  );
}
