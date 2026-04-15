import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { jsPDF } from "jspdf";
import { applyPlugin } from "jspdf-autotable";

applyPlugin(jsPDF);

function fmtAmt(n: number): string {
  return new Intl.NumberFormat("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}
function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-MA", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function hexToRgb(hex: string): [number, number, number] {
  if (!hex?.startsWith("#") || hex.length < 7) return [200, 146, 74];
  return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: bulletin, error: bErr } = await supabase
      .from("bulletins_paie")
      .select("*")
      .eq("id", id)
      .single();
    if (bErr || !bulletin)
      return NextResponse.json({ error: "Bulletin introuvable" }, { status: 404 });

    const [{ data: emp }, { data: company }] = await Promise.all([
      supabase.from("employees").select("*").eq("id", bulletin.employee_id).eq("user_id", user.id).single(),
      supabase.from("companies").select("*").eq("user_id", user.id).single(),
    ]);
    if (!emp) return NextResponse.json({ error: "Employé introuvable" }, { status: 404 });

    const accentRgb = hexToRgb(company?.invoice_color ?? "#C8924A");
    const NAVY: [number,number,number] = [13, 21, 38];
    const CREAM: [number,number,number] = [250, 250, 246];
    const MUTED: [number,number,number] = [107, 114, 128];
    const TEXT: [number,number,number] = [26, 26, 46];
    const WHITE: [number,number,number] = [255, 255, 255];

    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pw = 210; const ml = 14; const mr = 14; const cw = pw - ml - mr;

    // ── Header ────────────────────────────────────────────────────────────────
    doc.setFillColor(...WHITE); doc.rect(0, 0, pw, 38, "F");
    doc.setFont("helvetica","bold"); doc.setFontSize(9); doc.setTextColor(...NAVY);
    doc.text(company?.raison_sociale ?? "", ml, 12);
    doc.setFont("helvetica","normal"); doc.setFontSize(7.5); doc.setTextColor(...MUTED);
    if (company?.address) doc.text(company.address, ml, 17);
    if (company?.city) doc.text(company.city, ml, 21);
    if (company?.ice) doc.text(`ICE : ${company.ice}`, ml, 25);
    if (company?.numero_cnss || (company as any)?.cnss) doc.text(`CNSS : ${company?.numero_cnss ?? (company as any)?.cnss ?? ""}`, ml, 29);

    doc.setFont("helvetica","bold"); doc.setFontSize(18); doc.setTextColor(...NAVY);
    doc.text("BULLETIN DE PAIE", pw - mr, 14, { align: "right" });
    doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(...MUTED);
    doc.text(`Mois : ${bulletin.period_label ?? `${bulletin.mois}/${bulletin.annee}`}`, pw - mr, 21, { align: "right" });
    const firstDay = `01/${String(bulletin.mois).padStart(2,"0")}/${bulletin.annee}`;
    const lastDay  = `${new Date(bulletin.annee, bulletin.mois, 0).getDate()}/${String(bulletin.mois).padStart(2,"0")}/${bulletin.annee}`;
    doc.text(`Période : ${firstDay} – ${lastDay}`, pw - mr, 26, { align: "right" });

    doc.setFillColor(...accentRgb); doc.rect(0, 38, pw, 1, "F");

    // ── Employee info box ─────────────────────────────────────────────────────
    let y = 43;
    doc.setFillColor(...CREAM); doc.roundedRect(ml, y, cw, 30, 2, 2, "F");
    const nomComplet = `${emp.prenom} ${emp.nom}`;
    doc.setFont("helvetica","bold"); doc.setFontSize(9); doc.setTextColor(...TEXT);
    doc.text(nomComplet, ml + 4, y + 7);
    doc.setFont("helvetica","normal"); doc.setFontSize(7.5); doc.setTextColor(...MUTED);
    const half = cw / 2;
    const leftLines = [
      emp.poste ? `Poste : ${emp.poste}` : null,
      emp.cin   ? `CIN : ${emp.cin}` : null,
      emp.numero_cnss ? `N° CNSS : ${emp.numero_cnss}` : null,
    ].filter(Boolean) as string[];
    const rightLines = [
      `Date d'embauche : ${fmtDate(emp.date_embauche)}`,
      `Situation : ${emp.situation_familiale ?? "—"} — ${emp.nombre_enfants ?? 0} enfant(s)`,
      emp.type_contrat ? `Contrat : ${emp.type_contrat}` : null,
    ].filter(Boolean) as string[];
    leftLines.forEach((l, i)  => doc.text(l, ml + 4, y + 14 + i * 5));
    rightLines.forEach((l, i) => doc.text(l, ml + half + 4, y + 14 + i * 5));

    y += 35;

    // ── Salary table ──────────────────────────────────────────────────────────
    const tableRows: (string[])[] = [
      ["Salaire de base",               fmtAmt(Number(bulletin.salaire_brut)),  ""],
      ...(Number(bulletin.heures_sup) > 0  ? [["Heures supplémentaires", fmtAmt(Number(bulletin.heures_sup)), ""]] : []),
      ...(Number(bulletin.primes) > 0      ? [["Primes",                  fmtAmt(Number(bulletin.primes)), ""]]     : []),
      ...(Number(bulletin.indemnites) > 0  ? [["Indemnités",              fmtAmt(Number(bulletin.indemnites)), ""]] : []),
      ["Salaire Brut",                  fmtAmt(Number(bulletin.salaire_brut)),  ""],
      ["CNSS Salarié (6.74%)",          "",                                     fmtAmt(Number(bulletin.cnss_salarie))],
      ["AMO Salarié (2.26%)",           "",                                     fmtAmt(Number(bulletin.amo_salarie))],
      ["Frais professionnels (20%)",    "",                                     fmtAmt(Number(bulletin.frais_pro))],
      ["Net imposable",                 fmtAmt(Number(bulletin.salaire_net_imposable)), ""],
      ["IR / Salaires",                 "",                                     fmtAmt(Number(bulletin.ir_net))],
      ["NET À PAYER",                   fmtAmt(Number(bulletin.salaire_net_payer)), ""],
    ];

    (doc as any).autoTable({
      startY: y,
      margin: { left: ml, right: mr },
      head: [["LIBELLÉ", "GAINS (MAD)", "RETENUES (MAD)"]],
      body: tableRows,
      headStyles: { fillColor: accentRgb, textColor: WHITE, fontStyle: "bold", fontSize: 7.5 },
      bodyStyles: { fontSize: 8, textColor: TEXT },
      columnStyles: {
        0: { cellWidth: "auto" },
        1: { halign: "right", cellWidth: 42 },
        2: { halign: "right", cellWidth: 42 },
      },
      didParseCell: (data: any) => {
        const isNet = data.row.index === tableRows.length - 1;
        const isBrut = data.row.index === 4;
        if ((isNet || isBrut) && data.section === "body") {
          data.cell.styles.fontStyle = "bold";
          if (isNet) data.cell.styles.fillColor = CREAM;
        }
      },
      theme: "plain",
      tableLineColor: [229, 231, 235],
      tableLineWidth: 0.2,
    });

    y = (doc as any).lastAutoTable.finalY + 6;

    // ── Charges patronales ────────────────────────────────────────────────────
    doc.setFillColor(...CREAM); doc.roundedRect(ml, y, cw, 24, 2, 2, "F");
    doc.setFont("helvetica","bold"); doc.setFontSize(7); doc.setTextColor(...accentRgb);
    doc.text("CHARGES PATRONALES (info)", ml + 4, y + 6);
    doc.setFont("helvetica","normal"); doc.setFontSize(7.5); doc.setTextColor(...MUTED);
    const cpLines = [
      [`CNSS Patronal (21.09%) : ${fmtAmt(Number(bulletin.cnss_patronal))} MAD`,   `AMO Patronal (2.26%) : ${fmtAmt(Number(bulletin.amo_patronal))} MAD`],
      [`Taxe Formation Prof. (1.6%) : ${fmtAmt(Number(bulletin.taxe_formation_pro))} MAD`, `Coût total employeur : ${fmtAmt(Number(bulletin.cout_total_employeur))} MAD`],
    ];
    cpLines.forEach((row, i) => {
      doc.text(row[0], ml + 4, y + 12 + i * 6);
      doc.text(row[1], ml + cw/2 + 4, y + 12 + i * 6);
    });
    y += 28;

    // ── Payment info ──────────────────────────────────────────────────────────
    if (emp.banque || emp.rib) {
      doc.setDrawColor(229, 231, 235); doc.line(ml, y, pw - mr, y);
      y += 5;
      doc.setFont("helvetica","bold"); doc.setFontSize(7); doc.setTextColor(...accentRgb);
      doc.text("COORDONNÉES BANCAIRES", ml, y + 4);
      doc.setFont("helvetica","normal"); doc.setFontSize(7.5); doc.setTextColor(...MUTED);
      if (emp.banque) doc.text(`Banque : ${emp.banque}`, ml, y + 10);
      if (emp.rib) doc.text(`RIB : ${emp.rib}`, emp.banque ? ml + 70 : ml, y + 10);
      doc.text("Mode de paiement : Virement bancaire", pw - mr, y + 10, { align: "right" });
      y += 16;
    }

    // ── Signature ─────────────────────────────────────────────────────────────
    const sigY = 260;
    doc.setDrawColor(229, 231, 235);
    doc.setFont("helvetica","normal"); doc.setFontSize(7.5); doc.setTextColor(...MUTED);
    doc.text("Lu et approuvé — L'Employé", ml, sigY);
    doc.line(ml, sigY + 10, ml + 70, sigY + 10);
    doc.text("Pour la société — Le Directeur", pw - mr - 70, sigY);
    doc.line(pw - mr - 70, sigY + 10, pw - mr, sigY + 10);

    // ── Footer ────────────────────────────────────────────────────────────────
    const footY = 287;
    doc.setDrawColor(229, 231, 235); doc.line(ml, footY - 4, pw - mr, footY - 4);
    doc.setFont("helvetica","normal"); doc.setFontSize(6.5); doc.setTextColor(...MUTED);
    doc.text("Ce bulletin de paie doit être conservé sans limitation de durée.", ml, footY);
    doc.setFont("helvetica","bold"); doc.setTextColor(...accentRgb);
    doc.text("Généré par Mohasib — mohasib.ma", pw - mr, footY, { align: "right" });

    const arrayBuffer = doc.output("arraybuffer");
    const filename = `Bulletin_${emp.prenom}_${emp.nom}_${bulletin.period_label ?? bulletin.mois + "_" + bulletin.annee}.pdf`
      .replace(/\s/g, "_");

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    console.error("[PAIE PDF]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
