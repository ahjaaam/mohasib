import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import React from "react";
import {
  Document, Page, Text, View, StyleSheet, renderToBuffer,
} from "@react-pdf/renderer";
import { calculateSalary, fmtNum, fmtPct, calcAnciennete } from "@/lib/payroll";

export const runtime = "nodejs";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPeriod(mois: number, annee: number): string {
  const SHORT = ["jan","fév","mar","avr","mai","jun","jul","aoû","sep","oct","nov","déc"];
  return `${SHORT[mois - 1]}-${String(annee).slice(-2)}`;
}


// ── Styles ────────────────────────────────────────────────────────────────────

const BLUE_HEADER = "#BFD7ED";
const GRAY_ROW    = "#E8E8E8";
const BORDER      = "#000000";
const BORDER_W    = 0.5;

const S = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 8,
    paddingTop: 42,
    paddingBottom: 42,
    paddingHorizontal: 42,
    color: "#000000",
  },

  // ── Title ────────────────────────────────────────────────────────────────
  titleBox: {
    border: BORDER_W,
    borderColor: BORDER,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingVertical: 5,
    marginBottom: 8,
  },
  titleText: {
    fontFamily: "Helvetica-Bold",
    fontSize: 14,
    textAlign: "center",
    letterSpacing: 1,
  },

  // ── Info grid ────────────────────────────────────────────────────────────
  infoGrid: {
    flexDirection: "row",
    borderWidth: BORDER_W,
    borderColor: BORDER,
    marginBottom: 8,
  },
  infoCol: { flex: 1 },
  infoRow: {
    flexDirection: "row",
    borderBottomWidth: BORDER_W,
    borderBottomColor: BORDER,
    minHeight: 14,
  },
  infoRowLast: {
    flexDirection: "row",
    minHeight: 14,
  },
  infoColDivider: {
    borderRightWidth: BORDER_W,
    borderRightColor: BORDER,
  },
  infoLabel: {
    fontFamily: "Helvetica-Bold",
    width: 80,
    paddingHorizontal: 3,
    paddingVertical: 2,
    borderRightWidth: BORDER_W,
    borderRightColor: BORDER,
  },
  infoValue: {
    flex: 1,
    paddingHorizontal: 3,
    paddingVertical: 2,
  },

  // ── Main table ────────────────────────────────────────────────────────────
  table: {
    borderWidth: BORDER_W,
    borderColor: BORDER,
    marginBottom: 4,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: BORDER_W,
    borderBottomColor: BORDER,
    minHeight: 14,
    alignItems: "center",
  },
  tableRowLast: {
    flexDirection: "row",
    minHeight: 14,
    alignItems: "center",
  },
  tableRowShaded: {
    flexDirection: "row",
    borderBottomWidth: BORDER_W,
    borderBottomColor: BORDER,
    minHeight: 14,
    alignItems: "center",
    backgroundColor: GRAY_ROW,
  },
  tableRowHeader: {
    flexDirection: "row",
    borderBottomWidth: BORDER_W,
    borderBottomColor: BORDER,
    minHeight: 16,
    alignItems: "center",
    backgroundColor: BLUE_HEADER,
  },
  tableRowFooter: {
    flexDirection: "row",
    minHeight: 20,
    alignItems: "center",
    backgroundColor: BLUE_HEADER,
  },

  // Column widths (in points — page width ~510pt after margins)
  cRubrique:    { width: "32%", paddingHorizontal: 3, paddingVertical: 2 },
  cBase:        { width: "10%", paddingHorizontal: 3, paddingVertical: 2, textAlign: "right", borderLeftWidth: BORDER_W, borderLeftColor: BORDER },
  cTaux:        { width: "8%",  paddingHorizontal: 3, paddingVertical: 2, textAlign: "center", borderLeftWidth: BORDER_W, borderLeftColor: BORDER },
  cGains:       { width: "11%", paddingHorizontal: 3, paddingVertical: 2, textAlign: "right", borderLeftWidth: BORDER_W, borderLeftColor: BORDER },
  cRetenues:    { width: "11%", paddingHorizontal: 3, paddingVertical: 2, textAlign: "right", borderLeftWidth: BORDER_W, borderLeftColor: BORDER },
  // Part patronale sub-columns
  cPatBase:     { width: "13%", paddingHorizontal: 3, paddingVertical: 2, textAlign: "right", borderLeftWidth: BORDER_W, borderLeftColor: BORDER },
  cPatTaux:     { width: "7%",  paddingHorizontal: 3, paddingVertical: 2, textAlign: "center", borderLeftWidth: BORDER_W, borderLeftColor: BORDER },
  cPatResult:   { width: "8%",  paddingHorizontal: 3, paddingVertical: 2, textAlign: "right", borderLeftWidth: BORDER_W, borderLeftColor: BORDER },

  bold:   { fontFamily: "Helvetica-Bold" },
  italic: { fontFamily: "Helvetica-Oblique" },

  // Double-header group labels
  groupHeader: {
    flexDirection: "row",
    borderBottomWidth: BORDER_W,
    borderBottomColor: BORDER,
    minHeight: 14,
    alignItems: "center",
    backgroundColor: BLUE_HEADER,
  },
  groupLabelLeft:  { width: "72%", textAlign: "center", paddingVertical: 2, fontFamily: "Helvetica-Bold", borderRightWidth: BORDER_W, borderRightColor: BORDER },
  groupLabelRight: { width: "28%", textAlign: "center", paddingVertical: 2, fontFamily: "Helvetica-Bold" },
});

// ── Row helpers ───────────────────────────────────────────────────────────────

type RowData = {
  rubrique: string;
  base?: string;
  taux?: string;
  gains?: string;
  retenues?: string;
  patBase?: string;
  patTaux?: string;
  patResult?: string;
  shaded?: boolean;
  bold?: boolean;
  last?: boolean;
};

function TableRow({ d }: { d: RowData }) {
  const rowStyle = d.shaded
    ? S.tableRowShaded
    : d.last
    ? S.tableRowLast
    : S.tableRow;
  const txt = d.bold ? { ...S.bold } : {};

  return React.createElement(
    View, { style: rowStyle },
    React.createElement(Text, { style: { ...S.cRubrique, ...txt } }, d.rubrique),
    React.createElement(Text, { style: { ...S.cBase, ...txt } },    d.base     ?? ""),
    React.createElement(Text, { style: { ...S.cTaux, ...txt } },    d.taux     ?? ""),
    React.createElement(Text, { style: { ...S.cGains, ...txt } },   d.gains    ?? ""),
    React.createElement(Text, { style: { ...S.cRetenues, ...txt } },d.retenues ?? ""),
    React.createElement(Text, { style: { ...S.cPatBase, ...txt } }, d.patBase  ?? ""),
    React.createElement(Text, { style: { ...S.cPatTaux, ...txt } }, d.patTaux  ?? ""),
    React.createElement(Text, { style: { ...S.cPatResult, ...txt } },d.patResult ?? ""),
  );
}

// ── PDF Document ──────────────────────────────────────────────────────────────

function BulletinPDF({
  bulletin, emp, company,
}: {
  bulletin: any;
  emp: any;
  company: any;
}) {
  const calc = calculateSalary({
    salaire_brut:       Number(bulletin.salaire_brut),
    situation_familiale: emp.situation_familiale ?? "Célibataire",
    nombre_enfants:     Number(emp.nombre_enfants ?? 0),
    date_embauche:      emp.date_embauche,
    has_mutuelle:       emp.has_mutuelle ?? false,
    mutuelle_taux_salarie:  emp.mutuelle_taux_salarie  ?? 2.59,
    mutuelle_taux_patronal: emp.mutuelle_taux_patronal ?? 2.59,
    has_cimr:           emp.has_cimr ?? false,
    cimr_taux_salarie:  emp.cimr_taux_salarie  ?? 3.00,
    cimr_taux_patronal: emp.cimr_taux_patronal ?? 3.90,
  });

  const anc = calcAnciennete(emp.date_embauche);
  const period = fmtPeriod(bulletin.mois, bulletin.annee);
  const hasMutuelle = emp.has_mutuelle ?? false;
  const hasCimr     = emp.has_cimr ?? false;

  // ── Info grid rows ───────────────────────────────────────────────────────
  const infoLeft = [
    { label: "Direction",          value: company?.raison_sociale ?? "" },
    { label: "Nom",                value: emp.nom },
    { label: "Prénom",             value: emp.prenom },
    { label: "Sit. familiale",     value: (emp.situation_familiale ?? "Célibataire").toUpperCase() },
    { label: "N° Matricule",       value: emp.matricule ?? emp.numero_cnss ?? "" },
  ];
  const infoRight = [
    { label: "Nbr d'enfants",      value: String(emp.nombre_enfants ?? 0) },
    { label: "Période",            value: period },
    { label: "Fonction",           value: emp.poste ?? "" },
    { label: "N° de CSS",          value: emp.numero_cnss ?? "" },
    { label: "Ancienneté",         value: anc.label },
  ];

  // ── Table rows ───────────────────────────────────────────────────────────
  const rows: RowData[] = [];

  // Section 1 — Éléments de salaire
  rows.push({
    rubrique: "SALAIRE DE BASE MENSUEL",
    base: fmtNum(calc.salaire_brut),
    taux: "1",
    gains: fmtNum(calc.salaire_brut),
  });

  rows.push({
    rubrique: "PRIME D'ANCIENNETÉ",
    base: fmtNum(calc.salaire_brut),
    taux: anc.taux > 0 ? fmtPct(anc.taux) : "-",
    gains: anc.taux > 0 ? fmtNum(calc.prime_anciennete_montant) : "-",
  });

  if ((bulletin.indemnites ?? 0) > 0) {
    rows.push({
      rubrique: "LES INDEMNITÉS",
      base: fmtNum(Number(bulletin.indemnites)),
      gains: fmtNum(Number(bulletin.indemnites)),
    });
  }

  rows.push({
    rubrique: "SALAIRE BRUT",
    gains: fmtNum(calc.salaire_brut_total),
    shaded: true,
    bold: true,
  });

  // Section 2 — Retenues salariales
  rows.push({
    rubrique: "COTISATION CSS",
    base: fmtNum(Math.min(calc.salaire_brut, 6000)),
    taux: "4,29%",
    retenues: fmtNum(calc.cotisation_css),
    // Patronal — COT ALLOCATION FAMILIALE
    patBase:   fmtNum(calc.salaire_brut),
    patTaux:   "6,40%",
    patResult: fmtNum(calc.allocation_familiale),
  });

  rows.push({
    rubrique: "INDEMNITE DE PERTE EMPLOI",
    base: fmtNum(Math.min(calc.salaire_brut, 6000)),
    taux: "0,19%",
    retenues: fmtNum(calc.indemnite_perte_emploi),
    // Patronal — COT PRESTATIONS SOCIALES
    patBase:   fmtNum(calc.salaire_brut),
    patTaux:   "8,98%",
    patResult: fmtNum(calc.prestations_sociales),
  });

  rows.push({
    rubrique: "COTISATION Assurance Maladie (AMO)",
    base: fmtNum(calc.salaire_brut),
    taux: "2,26%",
    retenues: fmtNum(calc.amo_salarie),
    // Patronal — COT TAXE FORMATION PROF.
    patBase:   fmtNum(calc.salaire_brut),
    patTaux:   "1,60%",
    patResult: fmtNum(calc.taxe_formation_pro),
  });

  rows.push({
    rubrique: "COT AMO PATRONALE",
    // Employee: empty (just showing patronal)
    patBase:   fmtNum(calc.salaire_brut),
    patTaux:   "4,11%",
    patResult: fmtNum(calc.amo_patronal),
  });

  if (hasMutuelle) {
    const mutTauxSal = emp.mutuelle_taux_salarie ?? 2.59;
    const mutTauxPat = emp.mutuelle_taux_patronal ?? 2.59;
    rows.push({
      rubrique: "ASSURANCE MALADIE (Mutuelle)",
      base: fmtNum(calc.salaire_brut),
      taux: `${fmtNum(mutTauxSal)}%`,
      retenues: fmtNum(calc.mutuelle_salarie),
      patBase:   fmtNum(calc.salaire_brut),
      patTaux:   `${fmtNum(mutTauxPat)}%`,
      patResult: fmtNum(calc.mutuelle_patronal),
    });
  }

  if (hasCimr) {
    const cimrTauxSal = emp.cimr_taux_salarie ?? 3.00;
    const cimrTauxPat = emp.cimr_taux_patronal ?? 3.90;
    rows.push({
      rubrique: "COTISATION (CIMR)",
      base: fmtNum(calc.salaire_brut),
      taux: `${fmtNum(cimrTauxSal)}%`,
      retenues: fmtNum(calc.cimr_salarie),
      patBase:   fmtNum(calc.salaire_brut),
      patTaux:   `${fmtNum(cimrTauxPat)}%`,
      patResult: fmtNum(calc.cimr_patronal),
    });
  }

  rows.push({
    rubrique: "COT FRAIS PROFESSIONNELS",
    base: fmtNum(calc.salaire_brut),
    taux: "25,00%",
    retenues: fmtNum(calc.frais_pro),
  });

  // Section 4 — IR
  rows.push({
    rubrique: "SALAIRE NET IMPOSABLE",
    gains: fmtNum(calc.salaire_net_imposable),
    shaded: true,
    bold: true,
  });

  rows.push({
    rubrique: "IR BRUT",
    retenues: fmtNum(calc.ir_mensuel_brut),
  });

  rows.push({
    rubrique: "CHARGE DE FAMILLE",
    retenues: calc.deduction_charge_famille > 0
      ? fmtNum(calc.deduction_charge_famille)
      : "-",
  });

  rows.push({
    rubrique: "IR NET",
    retenues: fmtNum(calc.ir_net),
    bold: true,
  });

  // Section 5 — Solidarité
  rows.push({
    rubrique: "COT DE SOLIDARITÉ SOCIAL",
    base: fmtNum(Math.min(calc.salaire_brut, 6000)),
    taux: "0,50%",
    retenues: fmtNum(calc.solidarite_sociale),
    last: true,
  });

  // ── Totals ───────────────────────────────────────────────────────────────
  const totalGains = calc.salaire_brut_total;
  const totalRetenues = calc.cotisation_css + calc.indemnite_perte_emploi
    + calc.amo_salarie + calc.mutuelle_salarie + calc.cimr_salarie
    + calc.frais_pro + calc.ir_net + calc.solidarite_sociale;
  const totalPatronal = calc.allocation_familiale + calc.prestations_sociales
    + calc.taxe_formation_pro + calc.amo_patronal
    + calc.mutuelle_patronal + calc.cimr_patronal;

  return React.createElement(
    Document, {},
    React.createElement(
      Page, { size: "A4", style: S.page },

      // ── Title ────────────────────────────────────────────────────────────
      React.createElement(
        View, { style: S.titleBox },
        React.createElement(Text, { style: S.titleText }, "BULLETIN DE PAIE"),
      ),

      // ── Info grid ────────────────────────────────────────────────────────
      React.createElement(
        View, { style: S.infoGrid },
        // Left column
        React.createElement(
          View, { style: { ...S.infoCol, ...S.infoColDivider } },
          ...infoLeft.map((r, i) =>
            React.createElement(
              View, {
                key: i,
                style: i < infoLeft.length - 1 ? S.infoRow : S.infoRowLast,
              },
              React.createElement(Text, { style: S.infoLabel }, r.label + " :"),
              React.createElement(Text, { style: S.infoValue }, r.value),
            ),
          ),
        ),
        // Right column
        React.createElement(
          View, { style: S.infoCol },
          ...infoRight.map((r, i) =>
            React.createElement(
              View, {
                key: i,
                style: i < infoRight.length - 1 ? S.infoRow : S.infoRowLast,
              },
              React.createElement(Text, { style: S.infoLabel }, r.label + " :"),
              React.createElement(Text, { style: S.infoValue }, r.value),
            ),
          ),
        ),
      ),

      // ── Main table ───────────────────────────────────────────────────────
      React.createElement(
        View, { style: S.table },

        // Double header row — group labels
        React.createElement(
          View, { style: S.groupHeader },
          React.createElement(Text, { style: S.groupLabelLeft  }, "ÉLÉMENTS DU SALAIRE / RETENUES"),
          React.createElement(Text, { style: S.groupLabelRight }, "PART PATRONALE"),
        ),

        // Column headers
        React.createElement(
          View, { style: S.tableRowHeader },
          React.createElement(Text, { style: { ...S.cRubrique, ...S.bold } }, "RUBRIQUE"),
          React.createElement(Text, { style: { ...S.cBase,     ...S.bold } }, "BASE"),
          React.createElement(Text, { style: { ...S.cTaux,     ...S.bold } }, "TAUX"),
          React.createElement(Text, { style: { ...S.cGains,    ...S.bold } }, "GAINS"),
          React.createElement(Text, { style: { ...S.cRetenues, ...S.bold } }, "RETENUES"),
          React.createElement(Text, { style: { ...S.cPatBase,  ...S.bold } }, "BASE"),
          React.createElement(Text, { style: { ...S.cPatTaux,  ...S.bold } }, "TAUX"),
          React.createElement(Text, { style: { ...S.cPatResult,...S.bold } }, "RÉSULTAT"),
        ),

        // Data rows
        ...rows.map((r, i) => React.createElement(TableRow, { key: i, d: r })),

        // Totals row
        React.createElement(
          View, { style: S.tableRowShaded },
          React.createElement(Text, { style: { ...S.cRubrique, ...S.bold } }, "TOTAUX"),
          React.createElement(Text, { style: { ...S.cBase } }, ""),
          React.createElement(Text, { style: { ...S.cTaux } }, ""),
          React.createElement(Text, { style: { ...S.cGains,    ...S.bold } }, fmtNum(totalGains)),
          React.createElement(Text, { style: { ...S.cRetenues, ...S.bold } }, fmtNum(totalRetenues)),
          React.createElement(Text, { style: { ...S.cPatBase } }, ""),
          React.createElement(Text, { style: { ...S.cPatTaux } }, ""),
          React.createElement(Text, { style: { ...S.cPatResult, ...S.bold } }, fmtNum(totalPatronal)),
        ),

        // Net à payer row
        React.createElement(
          View, { style: S.tableRowFooter },
          React.createElement(
            Text,
            {
              style: {
                ...S.cRubrique,
                ...S.bold,
                fontSize: 10,
                width: "60%",
                textAlign: "right",
                paddingRight: 12,
              },
            },
            "NET À PAYER :",
          ),
          React.createElement(
            Text,
            {
              style: {
                ...S.bold,
                fontSize: 10,
                flex: 1,
                textAlign: "right",
                paddingRight: 3,
                borderLeftWidth: BORDER_W,
                borderLeftColor: BORDER,
                paddingVertical: 4,
              },
            },
            fmtNum(calc.salaire_net_payer) + " MAD",
          ),
        ),
      ),

      // ── Signature line ────────────────────────────────────────────────────
      React.createElement(
        View, { style: { flexDirection: "row", justifyContent: "space-between", marginTop: 20 } },
        React.createElement(
          View, { style: { width: "45%" } },
          React.createElement(Text, { style: { fontFamily: "Helvetica-Bold", marginBottom: 20 } }, "Lu et approuvé — L'Employé"),
          React.createElement(View, { style: { borderTopWidth: 0.5, borderTopColor: "#000" } }),
        ),
        React.createElement(
          View, { style: { width: "45%", alignItems: "flex-end" } },
          React.createElement(Text, { style: { fontFamily: "Helvetica-Bold", marginBottom: 20 } }, "Pour la société — Le Directeur"),
          React.createElement(View, { style: { borderTopWidth: 0.5, borderTopColor: "#000", width: "100%" } }),
        ),
      ),

      // ── Footer ────────────────────────────────────────────────────────────
      React.createElement(
        View, { style: { marginTop: 10, flexDirection: "row", justifyContent: "space-between" } },
        React.createElement(
          Text,
          { style: { fontSize: 7, color: "#666" } },
          "Ce bulletin de paie doit être conservé sans limitation de durée.",
        ),
        React.createElement(
          Text,
          { style: { fontSize: 7, color: "#666" } },
          "Généré par Mohasib — mohasib.ma",
        ),
      ),
    ),
  );
}

// ── Route ─────────────────────────────────────────────────────────────────────

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

    const pdfElement = BulletinPDF({ bulletin, emp, company });
    const buffer = await renderToBuffer(pdfElement as any);

    const filename = `Bulletin_${emp.prenom}_${emp.nom}_${bulletin.period_label ?? `${bulletin.mois}_${bulletin.annee}`}.pdf`
      .replace(/\s/g, "_");

    return new NextResponse(new Uint8Array(buffer), {
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
