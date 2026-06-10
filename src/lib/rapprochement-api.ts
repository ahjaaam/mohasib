import { createClient } from "@/lib/supabase/server";

export async function getRapprochementContext(companyId?: string | null, dossierId?: string | null) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, companyId: null, dossierId: null, error: "Unauthorized" };

  if (dossierId) {
    const { data: dossier } = await supabase
      .from("dossiers")
      .select("id")
      .eq("id", dossierId)
      .eq("fiduciaire_user_id", user.id)
      .single();
    if (!dossier) return { supabase, user, companyId: null, dossierId: null, error: "Dossier not found" };
    return { supabase, user, companyId: null, dossierId: dossier.id as string, error: null };
  }

  if (companyId) {
    const { data: company } = await supabase
      .from("companies")
      .select("id")
      .eq("id", companyId)
      .eq("user_id", user.id)
      .single();
    if (!company) return { supabase, user, companyId: null, dossierId: null, error: "Company not found" };
    return { supabase, user, companyId: company.id as string, dossierId: null, error: null };
  }

  const { data: company } = await supabase
    .from("companies")
    .select("id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return { supabase, user, companyId: (company?.id as string | undefined) ?? null, dossierId: null, error: null };
}

export async function recomputeRapprochementSession(supabase: any, sessionId: string) {
  const { data: session } = await supabase
    .from("rapprochement_sessions")
    .select("id, solde_initial_comptable, solde_final_banque")
    .eq("id", sessionId)
    .single();
  if (!session) return null;

  const { data: lignes } = await supabase
    .from("rapprochement_lignes")
    .select("statut")
    .eq("session_id", sessionId);

  const { data: matched } = await supabase
    .from("rapprochement_lignes")
    .select("ecriture_id,dossier_ecriture_id")
    .eq("session_id", sessionId)
    .eq("statut", "rapproché")
    .or("ecriture_id.not.is.null,dossier_ecriture_id.not.is.null");

  const ecritureIds = [...new Set((matched ?? []).map((item: any) => item.ecriture_id).filter(Boolean))];
  let soldeComptable = Number(session.solde_initial_comptable ?? 0);
  if (ecritureIds.length) {
    const { data: ecritures } = await supabase
      .from("ecritures_comptables")
      .select("debit, credit")
      .in("id", ecritureIds);
    soldeComptable += (ecritures ?? []).reduce((sum: number, item: any) => sum + Number(item.debit ?? 0) - Number(item.credit ?? 0), 0);
  }
  const dossierEcritureIds = [...new Set((matched ?? []).map((item: any) => item.dossier_ecriture_id).filter(Boolean))];
  if (dossierEcritureIds.length) {
    const { data: dossierEcritures } = await supabase
      .from("dossier_ecritures")
      .select("debit, credit")
      .in("id", dossierEcritureIds);
    soldeComptable += (dossierEcritures ?? []).reduce((sum: number, item: any) => sum + Number(item.debit ?? 0) - Number(item.credit ?? 0), 0);
  }

  const ecart = Number(session.solde_final_banque ?? 0) - soldeComptable;
  const isBalanced = Math.abs(ecart) < 0.01 && (lignes ?? []).every((line: any) => ["rapproché", "ignoré"].includes(line.statut));

  await supabase
    .from("rapprochement_sessions")
    .update({
      solde_final_comptable: soldeComptable,
      ecart,
      is_balanced: isBalanced,
    })
    .eq("id", sessionId);

  return { soldeComptable, ecart, isBalanced };
}
