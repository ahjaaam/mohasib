import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { authorizePermission } from "@/lib/api-permissions";
import { requirePlanFeature } from "@/lib/api-plan";

const MONTHS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const mois = Number(body.mois);
    const annee = Number(body.annee);
    const dossierId = body.dossierId ?? null;
    if (!Number.isInteger(mois) || mois < 1 || mois > 12 || !Number.isInteger(annee) || annee < 1900 || annee > 9999) return NextResponse.json({ error: "Période CNSS invalide" }, { status: 400 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    const permission = await authorizePermission("bulletin_paie", "validate", { dossierId });
    if (permission.response) return permission.response;
    const plan = await requirePlanFeature("paie");
    if (plan.response) return plan.response;

    // Only validated bulletins count
    let bulletinQuery = supabase
      .from("bulletins_paie")
      .select("*")
      .eq("mois", mois).eq("annee", annee).in("statut", ["validé", "payé"]);
    bulletinQuery = dossierId ? bulletinQuery.eq("dossier_id", dossierId) : bulletinQuery.is("dossier_id", null);
    const { data: bulletins, error: bErr } = await bulletinQuery;

    if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 });
    if (!bulletins?.length) return NextResponse.json({ error: "Aucun bulletin validé pour cette période" }, { status: 400 });

    const total_salaires_bruts  = bulletins.reduce((s, b) => s + Number(b.salaire_brut), 0);
    const total_cnss_salarie    = bulletins.reduce((s, b) => s + Number(b.cnss_salarie), 0);
    const total_cnss_patronal   = bulletins.reduce((s, b) => s + Number(b.cnss_patronal), 0);
    const total_amo_salarie     = bulletins.reduce((s, b) => s + Number(b.amo_salarie), 0);
    const total_amo_patronal    = bulletins.reduce((s, b) => s + Number(b.amo_patronal), 0);
    const total_formation_pro   = bulletins.reduce((s, b) => s + Number(b.taxe_formation_pro), 0);
    // IPE is already included in the 4.48%/8.98% social-benefit branches.
    const total_ipe             = 0;
    const total_a_payer         = Math.round((total_cnss_salarie + total_cnss_patronal + total_amo_salarie + total_amo_patronal + total_formation_pro) * 100) / 100;

    const period_label = `${MONTHS[mois - 1]} ${annee}`;

    const { data: decl, error: dErr } = await supabase
      .from("cnss_declarations")
      .upsert({
        company_id: dossierId ? null : bulletins[0]?.company_id ?? null,
        ...(dossierId ? { dossier_id: dossierId } : {}),
        user_id: user.id,
        mois, annee, period_label,
        total_salaires_bruts,
        total_cnss_salarie,
        total_cnss_patronal,
        total_amo_salarie,
        total_amo_patronal,
        total_ipe,
        total_formation_pro,
        total_a_payer,
        nombre_employes: bulletins.length,
        statut: "generee",
      }, { onConflict: dossierId ? "dossier_id,mois,annee" : "company_id,mois,annee" })
      .select().single();

    if (dErr) return NextResponse.json({ error: dErr.message }, { status: 500 });
    return NextResponse.json({ ...decl, total_a_payer });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
