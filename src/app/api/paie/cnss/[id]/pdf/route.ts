import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { jsPDF } from "jspdf";
import { applyPlugin } from "jspdf-autotable";

applyPlugin(jsPDF);

function fmtAmt(n: number) {
  return new Intl.NumberFormat("fr-MA", { minimumFractionDigits: 2 }).format(n) + " MAD";
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [{ data: decl }, { data: company }] = await Promise.all([
      supabase.from("cnss_declarations").select("*").eq("id", id).single(),
      supabase.from("companies").select("*").eq("user_id", user.id).single(),
    ]);
    if (!decl) return NextResponse.json({ error: "Déclaration introuvable" }, { status: 404 });

    const { data: bulletins } = await supabase
      .from("bulletins_paie")
      .select("*, employees(nom, prenom, numero_cnss)")
      .eq("mois", decl.mois).eq("annee", decl.annee).eq("statut", "validé");

    const NAVY: [number,number,number] = [13,21,38];
    const GOLD: [number,number,number] = [200,146,74];
    const MUTED: [number,number,number] = [107,114,128];
    const CREAM: [number,number,number] = [250,250,246];
    const WHITE: [number,number,number] = [255,255,255];

    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pw = 210; const ml = 14; const mr = 14; const cw = pw - ml - mr;

    // Header
    doc.setFillColor(...NAVY); doc.rect(0, 0, pw, 36, "F");
    doc.setFont("helvetica","bold"); doc.setFontSize(16); doc.setTextColor(...WHITE);
    doc.text("DÉCLARATION CNSS", ml, 18);
    doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(...GOLD);
    doc.text(decl.period_label, ml, 25);
    doc.setTextColor(200,200,200); doc.setFontSize(8);
    doc.text(company?.raison_sociale ?? "", pw - mr, 14, { align: "right" });
    doc.text(`ICE : ${company?.ice ?? "—"}`, pw - mr, 20, { align: "right" });
    doc.text(`Nb employés : ${decl.nombre_employes}`, pw - mr, 26, { align: "right" });

    let y = 44;

    // Part salariale
    (doc as any).autoTable({
      startY: y,
      margin: { left: ml, right: mr },
      head: [["PART SALARIALE", "Taux", "Base", "Montant"]],
      body: [
        ["CNSS court terme", "0.52%", fmtAmt(decl.total_salaires_bruts), fmtAmt(decl.total_salaires_bruts * 0.0052)],
        ["CNSS long terme", "3.96%", fmtAmt(decl.total_salaires_bruts), fmtAmt(decl.total_salaires_bruts * 0.0396)],
        ["IPE salarié", "0.19%", fmtAmt(decl.total_salaires_bruts), fmtAmt(decl.total_ipe)],
        ["AMO salarié", "2.26%", fmtAmt(decl.total_salaires_bruts), fmtAmt(decl.total_amo_salarie)],
        ["Total part salariale", "", "", fmtAmt(decl.total_cnss_salarie + decl.total_amo_salarie)],
      ],
      headStyles: { fillColor: [59,130,246], textColor: WHITE, fontStyle: "bold", fontSize: 7.5 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 2: { halign: "right" }, 3: { halign: "right", fontStyle: "bold" } },
      didParseCell: (data: any) => {
        if (data.row.index === 4 && data.section === "body") data.cell.styles.fontStyle = "bold";
      },
      theme: "striped",
    });

    y = (doc as any).lastAutoTable.finalY + 6;

    // Part patronale
    (doc as any).autoTable({
      startY: y,
      margin: { left: ml, right: mr },
      head: [["PART PATRONALE", "Taux", "Base", "Montant"]],
      body: [
        ["Allocations familiales", "6.40%", fmtAmt(decl.total_salaires_bruts), fmtAmt(decl.total_salaires_bruts * 0.064)],
        ["Prestations sociales", "8.98%", fmtAmt(decl.total_salaires_bruts), fmtAmt(decl.total_salaires_bruts * 0.0898)],
        ["IPE patronal", "0.67%", fmtAmt(decl.total_salaires_bruts), fmtAmt(decl.total_salaires_bruts * 0.0067)],
        ["AMO patronal", "4.11%", fmtAmt(decl.total_salaires_bruts), fmtAmt(decl.total_amo_patronal)],
        ["Formation professionnelle", "1.60%", fmtAmt(decl.total_salaires_bruts), fmtAmt(decl.total_formation_pro)],
        ["Total part patronale", "", "", fmtAmt(decl.total_cnss_patronal + decl.total_amo_patronal + decl.total_formation_pro)],
      ],
      headStyles: { fillColor: NAVY, textColor: WHITE, fontStyle: "bold", fontSize: 7.5 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 2: { halign: "right" }, 3: { halign: "right" } },
      didParseCell: (data: any) => {
        if (data.row.index === 5 && data.section === "body") data.cell.styles.fontStyle = "bold";
      },
      theme: "striped",
    });

    y = (doc as any).lastAutoTable.finalY + 6;

    // Total
    doc.setFillColor(...CREAM); doc.roundedRect(ml, y, cw, 16, 2, 2, "F");
    doc.setFont("helvetica","bold"); doc.setFontSize(12); doc.setTextColor(...NAVY);
    doc.text("TOTAL À PAYER À CNSS :", ml + 4, y + 10);
    doc.setTextColor(...GOLD);
    doc.text(fmtAmt(decl.total_a_payer), pw - mr, y + 10, { align: "right" });
    y += 22;

    // Employee breakdown
    if (bulletins?.length) {
      (doc as any).autoTable({
        startY: y,
        margin: { left: ml, right: mr },
        head: [["Employé","N° CNSS","Brut","CNSS sal.","CNSS pat.","AMO sal.","AMO pat.","Total"]],
        body: bulletins.map((b: any) => [
          `${b.employees?.prenom} ${b.employees?.nom}`,
          b.employees?.numero_cnss ?? "—",
          fmtAmt(Number(b.salaire_brut)),
          fmtAmt(Number(b.cnss_salarie)),
          fmtAmt(Number(b.cnss_patronal)),
          fmtAmt(Number(b.amo_salarie)),
          fmtAmt(Number(b.amo_patronal)),
          fmtAmt(Number(b.cnss_salarie)+Number(b.cnss_patronal)+Number(b.amo_salarie)+Number(b.amo_patronal)),
        ]),
        headStyles: { fillColor: GOLD, textColor: WHITE, fontStyle: "bold", fontSize: 7 },
        bodyStyles: { fontSize: 7 },
        theme: "striped",
      });
    }

    // Footer
    const footY = 285;
    doc.setFont("helvetica","normal"); doc.setFontSize(7); doc.setTextColor(...MUTED);
    doc.text("À déposer sur damancom.cnss.ma avant le 15 du mois suivant.", ml, footY);
    doc.setFont("helvetica","bold"); doc.setTextColor(...GOLD);
    doc.text("Généré par Mohasib — mohasibai.com", pw - mr, footY, { align: "right" });

    const buf = doc.output("arraybuffer");
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="CNSS_${decl.period_label?.replace(/\s/g,"_")}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
