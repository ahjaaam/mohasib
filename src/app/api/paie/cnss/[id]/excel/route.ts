import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import * as XLSX from "xlsx";
import { requirePlanFeature } from "@/lib/api-plan";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const plan = await requirePlanFeature("paie");
    if (plan.response) return plan.response;
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: decl } = await supabase.from("cnss_declarations").select("*").eq("id", id).single();
    if (!decl) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

    const { data: bulletins } = await supabase
      .from("bulletins_paie")
      .select("*, employees(nom, prenom, numero_cnss, cin)")
      .eq("mois", decl.mois).eq("annee", decl.annee).eq("statut", "validé");

    const wb = XLSX.utils.book_new();

    // Sheet 1: Récapitulatif
    const recap = [
      ["DÉCLARATION CNSS — " + decl.period_label],
      [],
      ["Nombre d'employés", decl.nombre_employes],
      [],
      ["PART SALARIALE"],
      ["CNSS court terme (0.52%)", Math.round(decl.total_salaires_bruts * 0.0052 * 100) / 100],
      ["CNSS long terme (3.96%)", Math.round(decl.total_salaires_bruts * 0.0396 * 100) / 100],
      ["IPE salarié (0.19%)", decl.total_ipe],
      ["AMO salarié (2.26%)", decl.total_amo_salarie],
      ["Total part salariale", Math.round((decl.total_cnss_salarie + decl.total_amo_salarie) * 100) / 100],
      [],
      ["PART PATRONALE"],
      ["Allocations familiales (6.40%)", Math.round(decl.total_salaires_bruts * 0.064 * 100) / 100],
      ["Prestations sociales (8.98%)", Math.round(decl.total_salaires_bruts * 0.0898 * 100) / 100],
      ["IPE patronal (0.67%)", Math.round(decl.total_salaires_bruts * 0.0067 * 100) / 100],
      ["AMO patronal (4.11%)", decl.total_amo_patronal],
      ["Formation professionnelle (1.60%)", decl.total_formation_pro],
      ["Total part patronale", Math.round((decl.total_cnss_patronal + decl.total_amo_patronal + decl.total_formation_pro) * 100) / 100],
      [],
      ["TOTAL À PAYER À CNSS (MAD)", decl.total_a_payer],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(recap);
    ws1["!cols"] = [{ wch: 40 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws1, "Récapitulatif");

    // Sheet 2: Détail par employé
    const headers = ["N° CNSS","CIN","Nom","Prénom","Salaire brut","CNSS sal.","CNSS pat.","AMO sal.","AMO pat.","Formation","Total"];
    const rows = (bulletins ?? []).map((b: any) => [
      b.employees?.numero_cnss ?? "",
      b.employees?.cin ?? "",
      b.employees?.nom ?? "",
      b.employees?.prenom ?? "",
      Number(b.salaire_brut),
      Number(b.cnss_salarie),
      Number(b.cnss_patronal),
      Number(b.amo_salarie),
      Number(b.amo_patronal),
      Number(b.taxe_formation_pro),
      Number(b.cnss_salarie) + Number(b.cnss_patronal) + Number(b.amo_salarie) + Number(b.amo_patronal),
    ]);
    const ws2 = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws2["!cols"] = headers.map((_, i) => ({ wch: i < 4 ? 18 : 14 }));
    XLSX.utils.book_append_sheet(wb, ws2, "Détail employés");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="CNSS_${decl.period_label?.replace(/\s/g,"_")}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
