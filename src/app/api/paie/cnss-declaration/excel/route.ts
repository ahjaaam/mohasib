import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildCnssDeclaration } from "@/lib/paie/cnss-declaration";
import { requirePlanFeature } from "@/lib/api-plan";
import * as XLSX from "xlsx";

function safeName(value: string) {
  return (value || "Entreprise").replace(/[^\w.-]+/g, "_");
}

export async function GET(req: NextRequest) {
  try {
    const plan = await requirePlanFeature("paie");
    if (plan.response) return plan.response;
    const { searchParams } = new URL(req.url);
    const mois = Number(searchParams.get("mois"));
    const annee = Number(searchParams.get("annee"));
    const dossierId = searchParams.get("dossierId");
    if (!mois || !annee) return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const data = await buildCnssDeclaration({ supabase, userId: user.id, mois, annee, dossierId });
    const wb = XLSX.utils.book_new();
    const title = `Déclaration CNSS ${data.period.label}`;
    const headers = [
      "N°", "Matricule CNSS", "Nom", "Prénom", "Jours déclarés", "Salaire brut",
      "Salaire plafonné", "CNSS salarié (4.48%)", "CNSS patronal (21.09%)",
      "AMO salarié (2.26%)", "AMO patronal (4.11%)", "Total cotisations",
    ];
    const rows = data.employees.map((e: any) => [
      e.n, e.matricule_cnss, e.nom, e.prenom, e.jours_declares, e.salaire_brut,
      e.salaire_plafonne, e.cnss_salarie, e.cnss_patronal, e.amo_salarie,
      e.amo_patronal, e.total_cotisations,
    ]);
    const totals = data.totals;
    const ws = XLSX.utils.aoa_to_sheet([
      [data.company.name || "Entreprise"],
      [`Période: ${data.period.label}`],
      [],
      headers,
      ...rows,
      ["TOTAL", "", "", "", totals.total_jours, totals.total_brut, totals.total_plafonne,
        totals.total_cnss_salarie, totals.total_cnss_patronal, totals.total_amo_salarie,
        totals.total_amo_patronal, totals.total_cotisations],
    ]);
    ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 11 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 11 } }];
    ws["!cols"] = headers.map((_, i) => ({ wch: i < 4 ? 18 : 16 }));
    XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 31));

    const recap = XLSX.utils.aoa_to_sheet([
      ["Company", data.company.name],
      ["ICE", data.company.ice],
      ["CNSS N°", data.company.cnss_number],
      ["Période", data.period.label],
      ["Total employés déclarés", data.employees.length],
      ["Total jours déclarés", totals.total_jours],
      ["Total salaires bruts", totals.total_brut],
      ["Total cotisations", totals.total_cotisations],
      ["Date génération", new Date().toLocaleDateString("fr-MA")],
    ]);
    recap["!cols"] = [{ wch: 28 }, { wch: 32 }];
    XLSX.utils.book_append_sheet(wb, recap, "Récapitulatif");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="CNSS-${annee}-${String(mois).padStart(2, "0")}-${safeName(data.company.name)}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
