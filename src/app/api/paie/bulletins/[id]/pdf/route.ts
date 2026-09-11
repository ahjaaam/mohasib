import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { jsPDF } from "jspdf";
import { applyPlugin } from "jspdf-autotable";
import { requirePlanFeature } from "@/lib/api-plan";
import { authorizePermission } from "@/lib/api-permissions";

applyPlugin(jsPDF);

function fmtAmt(n: number): string {
  return new Intl.NumberFormat("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("fr-MA", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function value(v: unknown): string {
  if (v === null || v === undefined || v === "") return "-";
  return String(v);
}

function hexToRgb(hex: string): [number, number, number] {
  if (!hex?.startsWith("#") || hex.length < 7) return [200, 146, 74];
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

function monthsBetween(start?: string | null, end = new Date()) {
  if (!start) return "-";
  const d = new Date(start);
  if (Number.isNaN(d.getTime())) return "-";
  const total = Math.max(0, (end.getFullYear() - d.getFullYear()) * 12 + end.getMonth() - d.getMonth());
  const years = Math.floor(total / 12);
  const months = total % 12;
  return `${years} an(s) ${months} mois`;
}

function drawInfoGrid(doc: jsPDF, x: number, y: number, w: number, rows: string[][], colors: Record<string, [number, number, number]>) {
  const rowH = 8;
  const labelW = 25;
  const valueW = w / 2 - labelW;
  doc.setDrawColor(...colors.BORDER);
  doc.setLineWidth(0.15);

  rows.forEach((row, i) => {
    const yy = y + i * rowH;
    doc.setFillColor(i % 2 === 0 ? 255 : 250, i % 2 === 0 ? 255 : 250, i % 2 === 0 ? 255 : 248);
    doc.rect(x, yy, w, rowH, "F");
    doc.line(x, yy, x + w, yy);
    doc.line(x + w / 2, yy, x + w / 2, yy + rowH);

    for (let side = 0; side < 2; side += 1) {
      const sx = x + side * (w / 2);
      const label = row[side * 2] ?? "";
      const val = row[side * 2 + 1] ?? "-";
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(...colors.MUTED);
      doc.text(label, sx + 2.5, yy + 5.1);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.3);
      doc.setTextColor(...colors.TEXT);
      const clipped = doc.splitTextToSize(val, valueW - 4)[0] ?? "-";
      doc.text(clipped, sx + labelW, yy + 5.1);
    }
  });

  doc.rect(x, y, w, rows.length * rowH);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const plan = await requirePlanFeature("paie");
    if (plan.response) return plan.response;
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

    const permission = await authorizePermission("bulletin_paie", "read", { companyId: bulletin.company_id, dossierId: bulletin.dossier_id });
    if (permission.response) return permission.response;

    const [{ data: emp }, scopeResult, { data: yearRows, error: yearError }] = await Promise.all([
      supabase.from("employees").select("*").eq("id", bulletin.employee_id).single(),
      bulletin.dossier_id
        ? supabase.from("dossiers").select("raison_sociale,ice,cnss,color").eq("id", bulletin.dossier_id).single()
        : supabase.from("companies").select("*").eq("id", bulletin.company_id).single(),
      supabase.from("bulletins_paie").select("*").eq("employee_id", bulletin.employee_id).eq("annee", bulletin.annee).lte("mois", bulletin.mois),
    ]);
    if (!emp) return NextResponse.json({ error: "Employé introuvable" }, { status: 404 });
    if (scopeResult.error || yearError) return NextResponse.json({ error: scopeResult.error?.message ?? yearError?.message }, { status: 500 });
    const company = scopeResult.data;

    const accentRgb = hexToRgb(company?.invoice_color ?? company?.color ?? "#C8924A");
    const colors = {
      ACCENT: accentRgb,
      NAVY: [20, 30, 48] as [number, number, number],
      TEXT: [28, 31, 42] as [number, number, number],
      MUTED: [96, 103, 115] as [number, number, number],
      BORDER: [196, 202, 210] as [number, number, number],
      SOFT: [247, 248, 250] as [number, number, number],
      WHITE: [255, 255, 255] as [number, number, number],
    };

    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pw = 210;
    const ph = 297;
    const ml = 12;
    const mr = 12;
    const cw = pw - ml - mr;
    const period = bulletin.period_label ?? `${String(bulletin.mois).padStart(2, "0")}/${bulletin.annee}`;
    const firstDay = `01/${String(bulletin.mois).padStart(2, "0")}/${bulletin.annee}`;
    const lastDay = `${String(new Date(bulletin.annee, bulletin.mois, 0).getDate()).padStart(2, "0")}/${String(bulletin.mois).padStart(2, "0")}/${bulletin.annee}`;
    const paymentMode = emp.mode_paiement ? String(emp.mode_paiement) : emp.rib ? "Virement bancaire" : "Espèces";
    const grossSalary = Number(bulletin.salaire_brut);
    const salaryBase = Number(bulletin.salaire_base ?? bulletin.salaire_brut);
    const contributionBase = Number(bulletin.base_cnss ?? bulletin.salaire_brut);
    const cnssBase = Math.min(contributionBase, 6000);
    const totalCotSal = Number(bulletin.cnss_salarie) + Number(bulletin.amo_salarie) + Number(bulletin.mutuelle_salarie ?? 0) + Number(bulletin.cimr_salarie ?? 0);
    const totalCotPat = Number(bulletin.cnss_patronal) + Number(bulletin.amo_patronal) + Number(bulletin.taxe_formation_pro) + Number(bulletin.mutuelle_patronal ?? 0) + Number(bulletin.cimr_patronal ?? 0);
    const netPay = Number(bulletin.salaire_net_payer);
    const declaredDays = Math.min(26, Math.max(0, Math.round((Number(bulletin.heures_travaillees ?? 0) / Math.max(1, Number(bulletin.heures_theoriques ?? 191.33))) * 26 * 2) / 2));
    const dependantCount = Math.min(6, Number(emp.nombre_enfants ?? 0) + (emp.situation_familiale === "Marié(e)" ? 1 : 0));
    const ytdRows = (yearRows ?? []).filter((row: any) => row.id === bulletin.id || ["validé", "payé"].includes(row.statut));
    const ytd = (key: string) => ytdRows.reduce((sum: number, row: any) => sum + Number(row[key] ?? 0), 0);
    const ytdDays = ytdRows.reduce((sum: number, row: any) => sum + Math.min(26, Math.max(0, (Number(row.heures_travaillees ?? 0) / Math.max(1, Number(row.heures_theoriques ?? 191.33))) * 26)), 0);

    doc.setFillColor(...colors.WHITE);
    doc.rect(0, 0, pw, ph, "F");

    // Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...colors.NAVY);
    doc.text(value(company?.raison_sociale).toUpperCase(), ml, 17);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...colors.MUTED);
    doc.text(`N° Affiliation CNSS : ${value(company?.numero_cnss ?? (company as any)?.cnss)}`, ml, 23);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(...colors.NAVY);
    doc.text("BULLETIN DE PAIE", pw - mr, 14, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.2);
    doc.setTextColor(...colors.TEXT);
    doc.text(`Période du : ${firstDay} au : ${lastDay}`, pw - mr, 21, { align: "right" });
    doc.text(bulletin.statut === "payé" ? `Paiement le : ${fmtDate(bulletin.date_paiement ?? bulletin.paid_at)} - ${paymentMode}` : "Paiement : non réglé", pw - mr, 26, { align: "right" });
    doc.setDrawColor(...colors.ACCENT);
    doc.setLineWidth(0.8);
    doc.line(ml, 30, pw - mr, 30);

    // Employee identity
    let y = 38;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12.5);
    doc.setTextColor(...colors.NAVY);
    doc.text(`${emp.prenom} ${emp.nom}`, ml, y);
    const employeeAddress = value(emp.adresse ?? emp.address);
    if (employeeAddress !== "-") {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...colors.MUTED);
      doc.text(doc.splitTextToSize(employeeAddress, cw)[0], ml, y + 5);
      y += 11;
    } else {
      y += 6;
    }

    drawInfoGrid(doc, ml, y, cw, [
      ["Matricule", value(emp.matricule), "Ancienneté", monthsBetween(emp.date_embauche, new Date(bulletin.annee, bulletin.mois - 1, 1))],
      ["N° CNSS", value(emp.numero_cnss ?? emp.cnss_number), "N° Mutuelle", "-"],
      ["Fonction", value(emp.poste), "Département", value(emp.departement)],
      ["Date Naissance", fmtDate(emp.date_naissance), "Date Embauche", fmtDate(emp.date_embauche)],
      ["Situation Fam.", value(emp.situation_familiale), "Nbre Enfants", value(emp.nombre_enfants)],
      ["Personnes à charge", value(dependantCount), "Jours déclarés", `${declaredDays} j`],
      ["Email", value(emp.email), "Adresse", employeeAddress],
      ["RIB", value(emp.rib), "Banque", value(emp.banque)],
    ], colors);

    y += 70;

    const payrollRows: any[] = [
      ["30", "Salaire Mensuel", `${declaredDays} j`, fmtAmt(salaryBase), "", fmtAmt(salaryBase), "", "", "", ""],
    ];
    if (Number(bulletin.heures_sup) > 0) {
      payrollRows.push(["40", "Heures supplémentaires", "", "", "", fmtAmt(Number(bulletin.heures_sup)), "", "", "", ""]);
    }
    if (Number(bulletin.primes) > 0) {
      payrollRows.push(["50", "Primes", "", "", "", fmtAmt(Number(bulletin.primes)), "", "", "", ""]);
    }
    if (Number(bulletin.indemnites) > 0) {
      payrollRows.push(["60", "Indemnités", "", "", "", fmtAmt(Number(bulletin.indemnites)), "", "", "", ""]);
    }
    if (Number(bulletin.montant_absence_deduit) > 0) {
      payrollRows.push(["65", "Retenue pour absence", "", "", "", "", fmtAmt(Number(bulletin.montant_absence_deduit)), "", "", ""]);
    }
    payrollRows.push(
      ["", "Total Brut", "", "", "", fmtAmt(grossSalary), "", "", "", ""],
      ["7010", "CNSS / allocations familiales", "", fmtAmt(cnssBase), "4,48 %", "", fmtAmt(Number(bulletin.cnss_salarie)), "", "", fmtAmt(Number(bulletin.cnss_patronal))],
      ["7100", "Cotisation A.M.O.", "", fmtAmt(contributionBase), contributionBase > 0 ? `${fmtAmt(Number(bulletin.amo_salarie) / contributionBase * 100)} %` : "", "", fmtAmt(Number(bulletin.amo_salarie)), contributionBase > 0 ? `${fmtAmt(Number(bulletin.amo_patronal) / contributionBase * 100)} %` : "", "", fmtAmt(Number(bulletin.amo_patronal))],
      ["7160", "Formation professionnelle", "", fmtAmt(contributionBase), "", "", "", contributionBase > 0 ? `${fmtAmt(Number(bulletin.taxe_formation_pro) / contributionBase * 100)} %` : "", "", fmtAmt(Number(bulletin.taxe_formation_pro))],
      ["", "Total Cotisations", "", "", "", "", fmtAmt(totalCotSal), "", "", fmtAmt(totalCotPat)],
      ["8010", "Prélèvement IGR", "", fmtAmt(Number(bulletin.salaire_net_imposable)), "", "", fmtAmt(Number(bulletin.ir_net)), "", "", ""],
      ["90500", "Nbre personnes à Charge (Int.)", "", "", "", fmtAmt(Number(bulletin.deduction_charge_famille)), "", "", "", ""],
    );
    if (Number(bulletin.mutuelle_salarie ?? 0) + Number(bulletin.mutuelle_patronal ?? 0) > 0) payrollRows.splice(-3, 0, ["7200", "Mutuelle", "", fmtAmt(contributionBase), "", "", fmtAmt(Number(bulletin.mutuelle_salarie)), "", "", fmtAmt(Number(bulletin.mutuelle_patronal))]);
    if (Number(bulletin.cimr_salarie ?? 0) + Number(bulletin.cimr_patronal ?? 0) > 0) payrollRows.splice(-3, 0, ["7300", "CIMR", "", fmtAmt(contributionBase), "", "", fmtAmt(Number(bulletin.cimr_salarie)), "", "", fmtAmt(Number(bulletin.cimr_patronal))]);

    // Main payroll table
    (doc as any).autoTable({
      startY: y,
      margin: { left: ml, right: mr },
      tableWidth: cw,
      head: [
        [
          { content: "N°", rowSpan: 2 },
          { content: "Désignation", rowSpan: 2 },
          { content: "Nombre", rowSpan: 2 },
          { content: "Base", rowSpan: 2 },
          { content: "Part salariale", colSpan: 3, styles: { halign: "center" } },
          { content: "Part patronale", colSpan: 3, styles: { halign: "center" } },
        ],
        ["Taux", "Gain", "Retenue", "Taux", "Ret. (+)", "Ret. (-)"],
      ],
      body: payrollRows,
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 7,
        cellPadding: { top: 2.1, right: 1.2, bottom: 2.1, left: 1.2 },
        lineColor: colors.BORDER,
        lineWidth: 0.15,
        textColor: colors.TEXT,
        valign: "middle",
      },
      headStyles: {
        fillColor: colors.NAVY,
        textColor: colors.WHITE,
        fontStyle: "bold",
        lineColor: colors.BORDER,
        lineWidth: 0.2,
      },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: 38 },
        2: { cellWidth: 16, halign: "center" },
        3: { cellWidth: 20, halign: "right" },
        4: { cellWidth: 15, halign: "right" },
        5: { cellWidth: 21, halign: "right" },
        6: { cellWidth: 21, halign: "right" },
        7: { cellWidth: 15, halign: "right" },
        8: { cellWidth: 17, halign: "right" },
        9: { cellWidth: 13, halign: "right" },
      },
      didParseCell: (data: any) => {
        const label = data.row.raw?.[1];
        if (data.section === "body" && (label === "Total Brut" || label === "Total Cotisations")) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [250, 250, 248];
        }
        if (data.section === "body" && data.row.raw?.[0] === "90500") {
          data.cell.styles.textColor = colors.MUTED;
        }
      },
    });

    y = (doc as any).lastAutoTable.finalY + 7;

    // Cumuls table
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...colors.NAVY);
    doc.text("Cumuls", ml, y);
    y += 3;

    const cumulsHead = ["", "Salaire brut", "Net imposable", "Charges sal.", "Fr. Prof.", "IR", "Déd. Charges Fam.", "Jours", "Net payé"];
    const cumulsRow = [
      fmtAmt(grossSalary),
      fmtAmt(Number(bulletin.salaire_net_imposable)),
      fmtAmt(totalCotSal),
      fmtAmt(Number(bulletin.frais_pro)),
      fmtAmt(Number(bulletin.ir_net)),
      fmtAmt(Number(bulletin.deduction_charge_famille)),
      String(declaredDays),
      fmtAmt(netPay),
    ];

    (doc as any).autoTable({
      startY: y,
      margin: { left: ml, right: mr },
      tableWidth: cw,
      head: [cumulsHead],
      body: [
        ["Période", ...cumulsRow],
        ["Année", fmtAmt(ytd("salaire_brut")), fmtAmt(ytd("salaire_net_imposable")), fmtAmt(ytd("cnss_salarie") + ytd("amo_salarie") + ytd("mutuelle_salarie") + ytd("cimr_salarie")), fmtAmt(ytd("frais_pro")), fmtAmt(ytd("ir_net")), fmtAmt(ytd("deduction_charge_famille")), String(Math.round(ytdDays * 2) / 2), fmtAmt(ytd("salaire_net_payer"))],
      ],
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 6.2,
        cellPadding: { top: 2, right: 0.8, bottom: 2, left: 0.8 },
        lineColor: colors.BORDER,
        lineWidth: 0.15,
        textColor: colors.TEXT,
        halign: "right",
      },
      headStyles: { fillColor: colors.NAVY, textColor: colors.WHITE, fontStyle: "bold", halign: "center" },
      columnStyles: {
        0: { cellWidth: 15, halign: "left", fontStyle: "bold" },
        1: { cellWidth: 23 },
        2: { cellWidth: 23 },
        3: { cellWidth: 22 },
        4: { cellWidth: 21 },
        5: { cellWidth: 18 },
        6: { cellWidth: 26 },
        7: { cellWidth: 14 },
        8: { cellWidth: 24, fontStyle: "bold", textColor: colors.NAVY },
      },
    });

    // Signatures
    const sigY = 246;
    doc.setTextColor(...colors.MUTED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Signature de l'employeur", ml, sigY);
    doc.text("Lu et approuvé - Signature de l'employé", pw - mr, sigY, { align: "right" });
    doc.setDrawColor(...colors.BORDER);
    doc.line(ml, sigY + 16, ml + 72, sigY + 16);
    doc.line(pw - mr - 82, sigY + 16, pw - mr, sigY + 16);

    // Footer
    doc.setDrawColor(...colors.BORDER);
    doc.line(ml, 279, pw - mr, 279);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...colors.MUTED);
    doc.text("Pour vous aider à faire valoir vos droits, conservez ce bulletin de paie sans limitation de durée.", pw / 2, 285, { align: "center" });

    const arrayBuffer = doc.output("arraybuffer");
    const filename = `Bulletin_${emp.prenom}_${emp.nom}_${period}.pdf`.replace(/\s/g, "_");

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
