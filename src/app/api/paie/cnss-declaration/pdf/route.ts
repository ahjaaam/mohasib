import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildCnssDeclaration } from "@/lib/paie/cnss-declaration";
import { jsPDF } from "jspdf";
import { applyPlugin } from "jspdf-autotable";

applyPlugin(jsPDF);

function fmtAmt(n: number) {
  return new Intl.NumberFormat("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function generateFallbackPdf(data: any) {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const NAVY: [number, number, number] = [31, 56, 100];
  const GOLD: [number, number, number] = [200, 146, 74];
  const MUTED: [number, number, number] = [107, 114, 128];
  const pageWidth = 297;
  const ml = 10;
  const mr = 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...NAVY);
  doc.text("DÉCLARATION CNSS", ml, 15);
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(`${data.company?.name ?? ""}  |  ICE: ${data.company?.ice ?? "—"}  |  CNSS: ${data.company?.cnss_number ?? "—"}`, ml, 22);
  doc.text(`Période: ${data.period?.label ?? ""}`, pageWidth - mr, 15, { align: "right" });

  const rows = (data.employees ?? []).map((e: any) => [
    e.n,
    e.matricule_cnss || "—",
    e.nom,
    e.prenom,
    e.jours_declares,
    fmtAmt(e.salaire_brut),
    fmtAmt(e.salaire_plafonne),
    fmtAmt(e.cnss_salarie),
    fmtAmt(e.cnss_patronal),
    fmtAmt(e.amo_salarie),
    fmtAmt(e.amo_patronal),
    fmtAmt(e.total_cotisations),
  ]);
  const t = data.totals ?? {};
  rows.push([
    "TOTAL", "", "", "", t.total_jours ?? 0,
    fmtAmt(t.total_brut ?? 0),
    fmtAmt(t.total_plafonne ?? 0),
    fmtAmt(t.total_cnss_salarie ?? 0),
    fmtAmt(t.total_cnss_patronal ?? 0),
    fmtAmt(t.total_amo_salarie ?? 0),
    fmtAmt(t.total_amo_patronal ?? 0),
    fmtAmt(t.total_cotisations ?? 0),
  ]);

  (doc as any).autoTable({
    startY: 30,
    margin: { left: ml, right: mr },
    head: [["N°", "Matricule", "Nom", "Prénom", "Jours", "Brut", "Plafonné", "CNSS sal.", "CNSS pat.", "AMO sal.", "AMO pat.", "Total"]],
    body: rows,
    theme: "grid",
    styles: { fontSize: 7, cellPadding: 1.8, overflow: "linebreak" },
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 9 },
      1: { cellWidth: 23 },
      2: { cellWidth: 25 },
      3: { cellWidth: 25 },
      4: { cellWidth: 13, halign: "right" },
      5: { cellWidth: 23, halign: "right" },
      6: { cellWidth: 23, halign: "right" },
      7: { cellWidth: 23, halign: "right" },
      8: { cellWidth: 23, halign: "right" },
      9: { cellWidth: 23, halign: "right" },
      10: { cellWidth: 23, halign: "right" },
      11: { cellWidth: 28, halign: "right" },
    },
    didParseCell: (hook: any) => {
      if (hook.section === "body" && hook.row.index === rows.length - 1) {
        hook.cell.styles.fontStyle = "bold";
        hook.cell.styles.fillColor = [249, 250, 251];
        hook.cell.styles.textColor = NAVY;
      }
    },
  });

  const y = Math.min((doc as any).lastAutoTable.finalY + 12, 180);
  doc.setDrawColor(229, 231, 235);
  doc.rect(ml, y, 80, 22);
  doc.rect(100, y, 45, 22);
  doc.rect(155, y, 70, 22);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...NAVY);
  doc.text("Le Responsable", ml + 4, y + 6);
  doc.text("Date", 104, y + 6);
  doc.text("Cachet", 159, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  doc.text("À déposer avant le 15 du mois suivant sur damancom.ma", ml, 202);
  doc.setTextColor(...GOLD);
  doc.text("Généré par Mohasib", pageWidth - mr, 202, { align: "right" });

  return doc.output("arraybuffer");
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mois = Number(searchParams.get("mois"));
    const annee = Number(searchParams.get("annee"));
    const dossierId = searchParams.get("dossierId");
    if (!mois || !annee) return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const data = await buildCnssDeclaration({ supabase, userId: user.id, mois, annee, dossierId });
    const serviceUrl = process.env.PDF_SERVICE_URL ?? "http://localhost:5050";
    const secret = (process.env.PDF_SECRET ?? "").trim();
    let pdfBytes: ArrayBuffer;

    try {
      const res = await fetch(`${serviceUrl.replace(/\/$/, "")}/pdf/cnss`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret, data }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(detail || "Erreur génération PDF CNSS");
      }
      pdfBytes = await res.arrayBuffer();
    } catch (err) {
      pdfBytes = generateFallbackPdf(data);
    }

    return new NextResponse(pdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Declaration-CNSS-${annee}-${String(mois).padStart(2, "0")}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
