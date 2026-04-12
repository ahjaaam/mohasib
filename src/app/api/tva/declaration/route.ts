import { NextRequest, NextResponse } from "next/server";
import { jsPDF } from "jspdf";
import { applyPlugin } from "jspdf-autotable";

applyPlugin(jsPDF);

const NAVY: [number, number, number] = [13, 21, 38];
const GOLD: [number, number, number] = [200, 146, 74];
const MUTED: [number, number, number] = [107, 114, 128];
const TEXT: [number, number, number] = [26, 26, 46];
const CREAM: [number, number, number] = [250, 250, 246];
const WHITE: [number, number, number] = [255, 255, 255];
const RED: [number, number, number] = [220, 38, 38];
const GREEN: [number, number, number] = [5, 150, 105];

function fmt(n: number): string {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function setFill(doc: jsPDF, rgb: [number, number, number]) {
  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
}
function setDraw(doc: jsPDF, rgb: [number, number, number]) {
  doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
}
function setTxt(doc: jsPDF, rgb: [number, number, number]) {
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      company, userName, periodLabel, regime,
      periodStart, periodEnd, deadline,
      collectee, deductible,
      totalCollectee, totalDeductible, totalNette,
    } = body;

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const W = 210;
    const margin = 18;
    const contentW = W - margin * 2;
    let y = 0;

    // ── Header strip ───────────────────────────────────────────────────
    setFill(doc, NAVY);
    doc.rect(0, 0, W, 38, "F");

    setTxt(doc, WHITE);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.text("ROYAUME DU MAROC", margin, 11);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text("Direction Générale des Impôts", margin, 16);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    setTxt(doc, [200, 146, 74]);
    doc.text("DÉCLARATION DE LA TAXE SUR LA VALEUR AJOUTÉE", W / 2, 22, { align: "center" });

    doc.setFontSize(9.5);
    setTxt(doc, WHITE);
    doc.setFont("helvetica", "normal");
    doc.text(`Période: ${periodLabel}  |  Régime: ${regime}  |  Date limite: ${deadline}`, W / 2, 31, { align: "center" });

    y = 48;

    // ── Company identification box ─────────────────────────────────────
    setFill(doc, CREAM);
    setDraw(doc, [220, 220, 215]);
    doc.roundedRect(margin, y, contentW, 32, 2, 2, "FD");

    setTxt(doc, NAVY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("IDENTIFICATION DU CONTRIBUABLE", margin + 4, y + 7);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    setTxt(doc, TEXT);

    const col1x = margin + 4;
    const col2x = margin + contentW / 2 + 4;
    const lineH = 5.5;
    let iy = y + 13;

    const fields1 = [
      ["Raison sociale", company?.raison_sociale || "—"],
      ["ICE", company?.ice || "—"],
      ["IF", company?.if_number || "—"],
    ];
    const fields2 = [
      ["RC", company?.rc || "—"],
      ["Ville", company?.city || "—"],
      ["Adresse", company?.address || "—"],
    ];

    for (let i = 0; i < fields1.length; i++) {
      setTxt(doc, MUTED);
      doc.setFontSize(7.5);
      doc.text(fields1[i][0] + ":", col1x, iy + i * lineH);
      setTxt(doc, TEXT);
      doc.setFontSize(8.5);
      doc.text(fields1[i][1], col1x + 26, iy + i * lineH);

      setTxt(doc, MUTED);
      doc.setFontSize(7.5);
      doc.text(fields2[i][0] + ":", col2x, iy + i * lineH);
      setTxt(doc, TEXT);
      doc.setFontSize(8.5);
      doc.text(fields2[i][1], col2x + 20, iy + i * lineH);
    }

    y += 40;

    // ── TABLEAU I — Opérations taxables ───────────────────────────────
    setTxt(doc, NAVY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("TABLEAU I — OPÉRATIONS TAXABLES", margin, y);
    y += 5;

    const t1Head = [["Taux TVA", "Base imposable (MAD)", "Coefficient", "TVA due (MAD)"]];
    const t1Body = (collectee ?? []).map((r: any) => [
      `${r.rate}%`,
      fmt(r.baseHT),
      `0,${String(r.rate).padStart(2, "0")}`,
      fmt(r.tvaAmount),
    ]);

    const t1TotalBase = (collectee ?? []).reduce((s: number, r: any) => s + r.baseHT, 0);
    t1Body.push(["TOTAL", fmt(t1TotalBase), "", fmt(totalCollectee)]);

    (doc as any).autoTable({
      startY: y,
      head: t1Head,
      body: t1Body,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8.5, cellPadding: 3, font: "helvetica" },
      headStyles: { fillColor: NAVY, textColor: WHITE, fontStyle: "bold", fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { halign: "right" },
        2: { halign: "center", cellWidth: 30 },
        3: { halign: "right", fontStyle: "bold" },
      },
      didParseCell: (data: any) => {
        if (data.row.index === t1Body.length - 1) {
          data.cell.styles.fillColor = CREAM;
          data.cell.styles.fontStyle = "bold";
        }
      },
      alternateRowStyles: { fillColor: [252, 252, 250] },
    });

    y = (doc as any).lastAutoTable.finalY + 8;

    // ── TABLEAU II — TVA Déductible ───────────────────────────────────
    setTxt(doc, NAVY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("TABLEAU II — TVA DÉDUCTIBLE", margin, y);
    y += 5;

    const t2Head = [["Nature des achats", "Montant HT (MAD)", "TVA déduite (MAD)"]];
    const t2Body = (deductible ?? []).map((r: any) => [
      r.category,
      fmt(r.baseHT),
      fmt(r.tvaAmount),
    ]);
    t2Body.push(["Immobilisations", "0,00", "0,00"]);
    t2Body.push(["Report période précédente", "0,00", "0,00"]);
    t2Body.push(["TOTAL TVA DÉDUCTIBLE", fmt((deductible ?? []).reduce((s: number, r: any) => s + r.baseHT, 0)), fmt(totalDeductible)]);

    (doc as any).autoTable({
      startY: y,
      head: t2Head,
      body: t2Body,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8.5, cellPadding: 3, font: "helvetica" },
      headStyles: { fillColor: [59, 82, 120], textColor: WHITE, fontStyle: "bold", fontSize: 8 },
      columnStyles: {
        1: { halign: "right" },
        2: { halign: "right", fontStyle: "bold" },
      },
      didParseCell: (data: any) => {
        if (data.row.index === t2Body.length - 1) {
          data.cell.styles.fillColor = CREAM;
          data.cell.styles.fontStyle = "bold";
        }
      },
      alternateRowStyles: { fillColor: [252, 252, 250] },
    });

    y = (doc as any).lastAutoTable.finalY + 8;

    // ── TABLEAU III — Liquidation ─────────────────────────────────────
    setTxt(doc, NAVY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("TABLEAU III — LIQUIDATION", margin, y);
    y += 5;

    const netteColor: [number, number, number] = totalNette > 0 ? RED : totalNette < 0 ? GREEN : MUTED;
    const netteLabel = totalNette >= 0 ? "TVA NETTE À PAYER" : "CRÉDIT TVA À REPORTER";

    const t3Body = [
      ["TVA due (Tableau I)", fmt(totalCollectee)],
      ["TVA déductible (Tableau II)", `− ${fmt(totalDeductible)}`],
      [netteLabel, fmt(Math.abs(totalNette))],
    ];

    (doc as any).autoTable({
      startY: y,
      body: t3Body,
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 3.5, font: "helvetica" },
      columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
      didParseCell: (data: any) => {
        if (data.row.index === 2) {
          data.cell.styles.fillColor = NAVY;
          data.cell.styles.textColor = WHITE;
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fontSize = 10;
        }
      },
    });

    y = (doc as any).lastAutoTable.finalY + 12;

    // ── Footer ────────────────────────────────────────────────────────
    const today = new Date().toLocaleDateString("fr-MA", { day: "numeric", month: "long", year: "numeric" });

    setFill(doc, CREAM);
    setDraw(doc, [220, 220, 215]);
    const footerH = 42;
    if (y + footerH > 275) { doc.addPage(); y = 18; }
    doc.roundedRect(margin, y, contentW, footerH, 2, 2, "FD");

    setTxt(doc, TEXT);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const certText = `Je soussigné(e) ${userName || "le gérant"}, certifie l'exactitude des informations portées sur la présente déclaration.`;
    doc.text(certText, margin + 4, y + 8, { maxWidth: contentW - 8 });
    doc.text(`Fait à ${company?.city || "Maroc"}, le ${today}`, margin + 4, y + 17);
    doc.text("Signature et cachet :", margin + 4, y + 24);
    doc.line(margin + 4, y + 35, margin + 55, y + 35);

    // Mohasib branding
    setTxt(doc, MUTED);
    doc.setFontSize(7.5);
    doc.text("Généré par Mohasib — mohasib.ma", W - margin, y + footerH - 4, { align: "right" });

    const pdfBytes = doc.output("arraybuffer");

    return new NextResponse(pdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="TVA_${periodLabel.replace(/\s/g, "_")}.pdf"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
