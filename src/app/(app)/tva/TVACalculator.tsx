"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ChevronLeft, ChevronRight, Receipt, CheckCircle,
  Download, AlertTriangle, Info, ChevronDown, ChevronUp,
} from "lucide-react";
import {
  calculateTVAForPeriod, saveDeclaration, fetchDeclarationHistory,
  type TVACalcResult, type TVADeclaration, type TVADeductionRow,
} from "./actions";
import { getTVAConfig } from "@/app/actions/tva-config";
import { DEFAULT_ENABLED_CODES, TVA_LINES, withAlwaysShown } from "@/lib/tva-lines-registry";
import { usePlanEntitlements } from "@/hooks/usePlanEntitlements";
import { translateError } from "@/lib/errors";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function n(x: number) { return Number(x) || 0; }

function fmtMAD(x: number) {
  return n(x).toLocaleString("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " MAD";
}

function fmtDate(d: string) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("fr-MA", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

const MONTHS_FR = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

function toISO(d: Date) { return d.toISOString().split("T")[0]; }

function getPeriodDates(regime: string, year: number, month: number, quarter: number) {
  if (regime === "Mensuel") {
    return { start: toISO(new Date(year, month - 1, 1)), end: toISO(new Date(year, month, 0)) };
  }
  const qm = (quarter - 1) * 3;
  return { start: toISO(new Date(year, qm, 1)), end: toISO(new Date(year, qm + 3, 0)) };
}

function getPeriodLabel(regime: string, year: number, month: number, quarter: number) {
  if (regime === "Mensuel") return `${MONTHS_FR[month - 1]} ${year}`;
  const labels = ["Jan–Mar","Avr–Jun","Jul–Sep","Oct–Déc"];
  return `T${quarter} ${year} (${labels[quarter - 1]})`;
}

function getDeadline(regime: string, year: number, month: number, quarter: number): Date {
  if (regime === "Mensuel") return new Date(year, month, 20);
  const months = [3, 6, 9, 0];
  return new Date(quarter === 4 ? year + 1 : year, months[quarter - 1], 20);
}

function daysUntil(d: Date) { return Math.ceil((d.getTime() - Date.now()) / 86400000); }

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl overflow-hidden mb-4"
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
      <div className="px-4 py-2.5 border-b border-[rgba(0,0,0,0.12)] bg-[#1A1A2E]">
        <span className="text-[12px] font-bold text-white tracking-wide">{title}</span>
      </div>
      {children}
    </div>
  );
}

function TH({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`text-[10.5px] font-semibold text-[#6B7280] uppercase tracking-[0.5px] px-4 py-2.5 bg-[#FAFAF6] ${right ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}

function TD({ children, right, bold, color }: { children: React.ReactNode; right?: boolean; bold?: boolean; color?: string }) {
  return (
    <td className={`px-4 py-2.5 text-[12px] border-t border-[rgba(0,0,0,0.04)] ${right ? "text-right" : ""} ${bold ? "font-bold" : ""}`}
      style={color ? { color } : undefined}>
      {children}
    </td>
  );
}

function NumInput({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <input
      type="number" step="0.01" min="0"
      value={value || ""}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      disabled={disabled}
      className="input text-right text-[12px] w-[140px]"
      style={{ height: 30 }}
    />
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Company {
  id?: string;
  raison_sociale?: string; ice?: string; if_number?: string;
  rc?: string; address?: string; city?: string;
  tva_regime?: string; tva_assujetti?: boolean; tva_taux_defaut?: number;
}

interface LockedPeriod {
  mois: number;
  annee: number;
  lock_type?: string | null;
  lock_reason?: string | null;
  locked_by_email?: string | null;
  locked_at?: string | null;
}

interface Props { company: Company | null; userName: string; lockedPeriods?: LockedPeriod[]; }

// ─── Default empty calc ───────────────────────────────────────────────────────

const EMPTY_CALC: TVACalcResult = {
  ca_total: 0, ca_7: 0, ca_10: 0, ca_14: 0, ca_20: 0,
  tva_7: 0, tva_10: 0, tva_14: 0, tva_20: 0, tva_collectee_total: 0,
  deductions_charges: 0, deductions_immobilisations: 0, deductions_total: 0,
  credit_reporte: 0, nb_factures: 0, droits_timbre: 0,
  tva_nette_due: 0, credit_tva: 0, ca_exercice_annuel: 0,
  invoices: [], deductions: [],
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function TVACalculator({ company, lockedPeriods = [] }: Props) {
  const entitlements = usePlanEntitlements();
  const regime = company?.tva_regime === "Trimestriel" ? "Trimestriel" : "Mensuel";
  const now = new Date();

  const [year, setYear]       = useState(now.getFullYear());
  const [month, setMonth]     = useState(now.getMonth() + 1);
  const [quarter, setQuarter] = useState(Math.ceil((now.getMonth() + 1) / 3));

  const [calc, setCalc]       = useState<TVACalcResult>(EMPTY_CALC);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [lastCalc, setLastCalc] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [history, setHistory] = useState<TVADeclaration[]>([]);
  const [showInvoices, setShowInvoices] = useState(false);
  const [showDeductions, setShowDeductions] = useState(false);
  const [statut, setStatut]   = useState<"brouillon"|"validé"|"déposé">("brouillon");
  const [confirmValidate, setConfirmValidate] = useState(false);
  const [enabledLines, setEnabledLines] = useState<Set<number>>(() => withAlwaysShown(DEFAULT_ENABLED_CODES));
  const [lineBases, setLineBases] = useState<Record<number, number>>({});

  // Adjustable overrides (user can edit auto values)
  const [caExporte, setCaExporte]     = useState(0);
  const [caExonere, setCaExonere]     = useState(0);
  const [caHorsChamp, setCaHorsChamp] = useState(0);
  const [caSuspension, setCaSuspension] = useState(0);
  const [odTva, setOdTva]             = useState(0);
  const [odTvaNote, setOdTvaNote]     = useState("");

  const { start, end } = getPeriodDates(regime, year, month, quarter);
  const periodLabel    = getPeriodLabel(regime, year, month, quarter);
  const configPeriod   = start.slice(0, 7);
  const deadline       = getDeadline(regime, year, month, quarter);
  const daysLeft       = daysUntil(deadline);
  const periodMonths = regime === "Mensuel"
    ? [month]
    : [((quarter - 1) * 3) + 1, ((quarter - 1) * 3) + 2, ((quarter - 1) * 3) + 3];
  const currentLock = lockedPeriods.find(period =>
    period.annee === year && periodMonths.includes(Number(period.mois))
  );

  function prevPeriod() {
    if (regime === "Mensuel") {
      if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1);
    } else {
      if (quarter === 1) { setQuarter(4); setYear(y => y - 1); } else setQuarter(q => q - 1);
    }
  }
  function nextPeriod() {
    if (regime === "Mensuel") {
      if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1);
    } else {
      if (quarter === 4) { setQuarter(1); setYear(y => y + 1); } else setQuarter(q => q + 1);
    }
  }

  const recalculate = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    const res = await calculateTVAForPeriod(start, end);
    if (res.error) { setFetchError(res.error); setLoading(false); return; }
    if (res.data) {
      setCalc(res.data);
      setLastCalc(new Date().toLocaleTimeString("fr-MA", { hour: "2-digit", minute: "2-digit" }));
    }
    setLoading(false);
  }, [start, end]);

  useEffect(() => { recalculate(); }, [recalculate]);

  useEffect(() => {
    let alive = true;
    async function loadConfig() {
      if (!company?.id) return;
      const config = await getTVAConfig(company.id, configPeriod);
      if (alive) setEnabledLines(withAlwaysShown(config.enabledCodes));
    }
    loadConfig();
    return () => { alive = false; };
  }, [company?.id, configPeriod]);

  const activeBLines = TVA_LINES.filter((line) => line.section === "B" && enabledLines.has(line.code));
  const activeCLines = TVA_LINES.filter((line) => line.section === "C" && enabledLines.has(line.code));
  const activeDLines = TVA_LINES.filter((line) => line.section === "D" && enabledLines.has(line.code));
  const activeELines = TVA_LINES.filter((line) => line.section === "E" && enabledLines.has(line.code));

  useEffect(() => {
    const sourceByRate: Record<number, number> = {
      7: calc.ca_7,
      10: calc.ca_10,
      14: calc.ca_14,
      20: calc.ca_20,
    };
    const preferredByRate: Record<number, number> = { 7: 119, 10: 118, 14: 104, 20: 102 };
    const next: Record<number, number> = {};

    for (const line of activeBLines) next[line.code] = 0;
    for (const [rateText, amount] of Object.entries(sourceByRate)) {
      const rate = Number(rateText);
      const candidates = activeBLines.filter((line) => line.taux === rate);
      const target = candidates.find((line) => line.code === preferredByRate[rate]) ?? candidates[0];
      if (target) next[target.code] = amount;
    }
    setLineBases(next);
  }, [calc.ca_7, calc.ca_10, calc.ca_14, calc.ca_20, enabledLines]);

  useEffect(() => {
    fetchDeclarationHistory().then(setHistory);
  }, []);

  // ── Derived totals ─────────────────────────────────────────────────────────
  const sectionDEnabled = activeDLines.length > 0;
  const deductionEnabled = (deduction: TVADeductionRow) => TVA_LINES.some((line) => {
    if (line.section !== "E" || !enabledLines.has(line.code)) return false;
    const isImmo = deduction.type_deduction === "immobilisation";
    const lineIsImmo = line.subsection === "Immobilisations";
    if (isImmo !== lineIsImmo) return false;
    return line.taux == null || line.taux === Number(deduction.taux_tva);
  });
  const visibleDeductions = calc.deductions.filter(deductionEnabled);
  const activeBTotalBase = activeBLines.reduce((sum, line) => sum + n(lineBases[line.code]), 0);
  const activeBTotalTVA = activeBLines.reduce((sum, line) => sum + n(lineBases[line.code]) * n(line.taux ?? 0) / 100, 0);
  const baseForRate = (rate: number) => activeBLines
    .filter((line) => line.taux === rate)
    .reduce((sum, line) => sum + n(lineBases[line.code]), 0);
  const filteredCalc: TVACalcResult = {
    ...calc,
    ca_7: baseForRate(7),
    ca_10: baseForRate(10),
    ca_14: baseForRate(14),
    ca_20: baseForRate(20),
    tva_7: baseForRate(7) * 0.07,
    tva_10: baseForRate(10) * 0.10,
    tva_14: baseForRate(14) * 0.14,
    tva_20: baseForRate(20) * 0.20,
    deductions_charges: visibleDeductions
      .filter((deduction) => deduction.type_deduction !== "immobilisation")
      .reduce((sum, deduction) => sum + deduction.tva_deductible, 0),
    deductions_immobilisations: visibleDeductions
      .filter((deduction) => deduction.type_deduction === "immobilisation")
      .reduce((sum, deduction) => sum + deduction.tva_deductible, 0),
    deductions: visibleDeductions,
  };
  filteredCalc.tva_collectee_total = activeBTotalTVA;
  filteredCalc.deductions_total = filteredCalc.deductions_charges + filteredCalc.deductions_immobilisations;

  const caImposable   = calc.ca_total - caExporte - caExonere - caHorsChamp - caSuspension;
  const tvaExigible   = filteredCalc.tva_collectee_total + (sectionDEnabled ? n(odTva) : 0);
  const totalDed      = filteredCalc.deductions_total + filteredCalc.credit_reporte;
  const raw           = tvaExigible + calc.droits_timbre - totalDed;
  const tvaNetteDue   = Math.max(0, raw);
  const creditTVA     = Math.max(0, -raw);

  // ── Save ───────────────────────────────────────────────────────────────────
  async function handleSave(newStatut: "brouillon" | "validé" | "déposé") {
    setSaving(true);
    const result = await saveDeclaration({
      periodStart: start, periodEnd: end, periodLabel, regime,
      statut: newStatut,
      calc: filteredCalc, overrides: {},
      odTva: sectionDEnabled ? n(odTva) : 0, odTvaNote,
      caExporte: n(caExporte), caExonere: n(caExonere),
      caHorsChamp: n(caHorsChamp), caSuspension: n(caSuspension),
    });
    if (result.error) {
      alert(translateError(result.error));
      setSaving(false);
      setConfirmValidate(false);
      return;
    }
    setStatut(newStatut);
    setSaving(false);
    setConfirmValidate(false);
    const h = await fetchDeclarationHistory();
    setHistory(h);
  }

  // ── EDI export ─────────────────────────────────────────────────────────────
  async function handleEDI() {
    const JSZip = (await import("jszip")).default;
    const esc = (s: string) => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    const n2  = (x: number) => n(x).toFixed(2);
    const ifNum   = company?.if_number ?? "";
    const ice     = company?.ice ?? "";
    const rs      = company?.raison_sociale ?? "";
    const yearStr = String(year);
    const monthStr = String(regime === "Mensuel" ? month : (quarter - 1) * 3 + 1).padStart(2, "0");

    const lignesB = activeBLines.map(line => {
      const ca = n(lineBases[line.code]);
      const tva = ca * n(line.taux ?? 0) / 100;
      return ca > 0 ? `\n    <LigneImposable code="${line.code}" taux="${line.taux ?? 0}"><BaseHT>${n2(ca)}</BaseHT><TVA>${n2(tva)}</TVA></LigneImposable>` : "";
    }).join("");

    const lignesDed = filteredCalc.deductions.map((d,i) => `
    <Deduction numero="${i+1}">
      <DateFacture>${d.date_facture}</DateFacture>
      <Fournisseur>${esc(d.fournisseur_nom)}</Fournisseur>
      <IF>${esc(d.fournisseur_if)}</IF>
      <ICE>${esc(d.fournisseur_ice)}</ICE>
      <Designation>${esc(d.designation)}</Designation>
      <MontantHT>${n2(d.montant_ht)}</MontantHT>
      <Taux>${d.taux_tva}</Taux>
      <MontantTVA>${n2(d.montant_tva)}</MontantTVA>
      <TVADeductible>${n2(d.tva_deductible)}</TVADeductible>
      <ModePaiement>${esc(d.mode_paiement||"Virement")}</ModePaiement>
    </Deduction>`).join("");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<DeclarationTVA xmlns="http://www.tax.gov.ma/tva/2024" version="1.0">
  <Identification>
    <IF>${esc(ifNum)}</IF><ICE>${esc(ice)}</ICE>
    <RaisonSociale>${esc(rs)}</RaisonSociale>
    <Periode>
      <Annee>${yearStr}</Annee><Mois>${monthStr}</Mois>
      <Regime>${regime}</Regime>
      <PeriodeDebut>${start}</PeriodeDebut><PeriodeFin>${end}</PeriodeFin>
    </Periode>
  </Identification>
  <SectionA>
    <CATotal>${n2(calc.ca_total)}</CATotal>
    <CAExporte>${n2(caExporte)}</CAExporte>
    <CAExonere>${n2(caExonere)}</CAExonere>
    <CAHorsChamp>${n2(caHorsChamp)}</CAHorsChamp>
    <CAImposable>${n2(caImposable)}</CAImposable>
  </SectionA>
  <SectionB>${lignesB}
    <TotalImposable>${n2(activeBTotalBase)}</TotalImposable>
    <TotalTVA>${n2(filteredCalc.tva_collectee_total)}</TotalTVA>
  </SectionB>
  <SectionD>
    <TVAExigible>${n2(tvaExigible)}</TVAExigible>
    <ODTVA>${n2(odTva)}</ODTVA>
  </SectionD>
  <SectionE>
    <DroitsTimbre>${n2(calc.droits_timbre)}</DroitsTimbre>
    <ReleveDeductions>${lignesDed}
    </ReleveDeductions>
    <DeductionsTotal>${n2(filteredCalc.deductions_total)}</DeductionsTotal>
    <CreditReporte>${n2(filteredCalc.credit_reporte)}</CreditReporte>
  </SectionE>
  <SectionF>
    <TVANetteDue>${n2(tvaNetteDue)}</TVANetteDue>
    <CreditTVA>${n2(creditTVA)}</CreditTVA>
  </SectionF>
</DeclarationTVA>`;

    const zip = new JSZip();
    zip.file("declaration.xml", xml);
    const blob = await zip.generateAsync({ type: "blob" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `TVA_${ifNum||"DECLARATION"}_${yearStr}_${monthStr}.zip`;
    a.click(); URL.revokeObjectURL(url);
  }

  const statutBadge = statut === "déposé"
    ? "bg-[#D1FAE5] text-[#065F46]"
    : statut === "validé"
      ? "bg-[#FEF3C7] text-[#92400E]"
      : "bg-[#F3F4F6] text-[#6B7280]";

  const statutLabel = statut === "déposé" ? "Déposée"
    : statut === "validé" ? "🔒 Validée" : "📝 Brouillon";

  const isFiled = statut === "déposé";
  const isLocked = isFiled || !!currentLock;

  // Sync statut when period changes
  useEffect(() => {
    const found = history.find(d => d.period_start === start);
    if (found) {
      const s = found.statut ?? found.status;
      setStatut(s === "filed" || s === "déposé" ? "déposé" : s === "validé" ? "validé" : "brouillon");
    } else {
      setStatut("brouillon");
    }
  }, [start, history]);

  return (
    <div>
      {/* ── Page header: title left, period nav right ───────────────────── */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(200,146,74,0.12)" }}>
            <Receipt size={18} className="text-[#C8924A]" />
          </div>
          <div>
            <h1 className="text-[18px] font-bold text-[#1A1A2E] leading-none">Déclaration TVA</h1>
            <p className="text-[11px] text-[#9CA3AF] mt-0.5">
              SIMPL-TVA · DGI Maroc
              <span className="ml-2 inline-block bg-[#F3F4F6] text-[#374151] text-[10.5px] font-medium px-2 py-0.5 rounded-full">{regime}</span>
            </p>
          </div>
        </div>
        {/* Period navigator */}
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 text-[10.5px] font-semibold px-2.5 py-1 rounded-lg ${statutBadge}`}>
            {statut === "déposé" && <CheckCircle size={11} aria-hidden="true" />}
            {statutLabel}
          </span>
          <button onClick={prevPeriod}
            className="w-8 h-8 rounded-lg border border-[rgba(0,0,0,0.12)] flex items-center justify-center text-[#6B7280] hover:bg-[#F3F4F6]">
            <ChevronLeft size={15} />
          </button>
          <span className="text-[13.5px] font-semibold text-[#1A1A2E] min-w-[130px] text-center">{periodLabel}</span>
          <button onClick={nextPeriod}
            className="w-8 h-8 rounded-lg border border-[rgba(0,0,0,0.12)] flex items-center justify-center text-[#6B7280] hover:bg-[#F3F4F6]">
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {/* ── Controls row ─────────────────────────────────────────────────── */}
      {lastCalc && !loading && (
        <p className="text-[10.5px] text-[#9CA3AF] mb-4">Recalculé à {lastCalc}</p>
      )}

      {fetchError && (
        <div className="bg-[#FEE2E2] rounded-lg px-4 py-3 mb-4 text-[12px] text-[#991B1B]">
          Erreur: {fetchError}
        </div>
      )}

      {currentLock && (
        <div className="mb-4 rounded-xl border border-[#F59E0B]/25 bg-[#FFFBEB] px-4 py-3 text-[12px] text-[#92400E]">
          <div className="font-semibold">Période verrouillée</div>
          <div className="mt-0.5">
            {currentLock.lock_reason ?? "Cette période ne peut plus être modifiée."}
            {currentLock.locked_by_email ? ` Verrouillée par ${currentLock.locked_by_email}.` : ""}
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[rgba(200,146,74,0.25)] bg-[#FFF7ED] px-4 py-3">
        <div>
          <p className="text-[12.5px] font-semibold text-[#92400E]">
            {enabledLines.size} lignes DGI actives pour {periodLabel}
          </p>
          <p className="mt-0.5 text-[11px] text-[#A16207]">
            B: {activeBLines.length} · C: {activeCLines.length} · D: {activeDLines.length} · E: {activeELines.length}
          </p>
        </div>
        <Link href="/settings?tab=tva" className="btn btn-outline text-[11.5px] text-[#92400E]">
          Gérer les lignes actives
        </Link>
      </div>

      {/* ── Confirm validate modal ────────────────────────────────────────── */}
      {confirmValidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <p className="text-[14px] font-bold text-[#1A1A2E] mb-2">Valider la déclaration ?</p>
            <p className="text-[12.5px] text-[#6B7280] mb-5">
              Une fois validée, les montants sont figés. Vous pourrez ensuite la marquer comme déposée.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmValidate(false)} className="btn btn-outline text-[12px]">Annuler</button>
              <button data-permission="tva_declaration:validate" onClick={() => handleSave("validé")} disabled={saving || isLocked}
                className="btn btn-gold text-[12px]">
                {saving ? "…" : "Valider"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-[1fr_300px] gap-5 items-start">
        <div>
      {loading ? (
        <div className="animate-pulse space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="bg-white rounded-xl border border-[rgba(0,0,0,0.07)] h-28" />
          ))}
        </div>
      ) : (
        <>
          {/* ─────────────────────────────────────────────────────────────── */}
          {/* SECTION A — CA Total                                           */}
          {/* ─────────────────────────────────────────────────────────────── */}
          <SectionCard title="A — Chiffre d'affaires total">
            <table className="w-full">
              <thead>
                <tr>
                  <TH>Ligne</TH>
                  <TH>Désignation</TH>
                  <TH right>Montant (MAD)</TH>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <TD>10</TD>
                  <TD>CA total réalisé (HT)</TD>
                  <TD right bold>{fmtMAD(calc.ca_total)}</TD>
                </tr>
                {[
                  ["20","Opérations hors champ TVA", caHorsChamp, setCaHorsChamp],
                  ["30","Opérations exonérées sans droit à déduction (art. 91)", caExonere, setCaExonere],
                  ["40","Opérations exonérées avec droit à déduction (art. 92)", caExporte, setCaExporte],
                  ["50","Opérations en suspension TVA (art. 94)", caSuspension, setCaSuspension],
                ].map(([code, label, val, setter]) => (
                  <tr key={code as string}>
                    <TD>{code as string}</TD>
                    <TD><span className="text-[#6B7280]">{label as string}</span></TD>
                    <TD right>
                      <NumInput value={val as number} onChange={setter as (v:number)=>void} disabled={isLocked} />
                    </TD>
                  </tr>
                ))}
                <tr className="bg-[#FAFAF6]">
                  <TD bold>60</TD>
                  <TD bold>CA imposable (10 − (20 + 30 + 40 + 50))</TD>
                  <TD right bold color="#C8924A">{fmtMAD(caImposable)}</TD>
                </tr>
              </tbody>
            </table>
          </SectionCard>

          {/* ─────────────────────────────────────────────────────────────── */}
          {/* SECTION B — CA Imposable par taux                              */}
          {/* ─────────────────────────────────────────────────────────────── */}
          <SectionCard title="B — Chiffre d'affaires imposable par taux">
            <table className="w-full">
              <thead>
                <tr>
                  <TH>Ligne DGI</TH>
                  <TH>Désignation</TH>
                  <TH>Taux TVA</TH>
                  <TH right>Base imposable HT (MAD)</TH>
                  <TH right>TVA correspondante (MAD)</TH>
                </tr>
              </thead>
              <tbody>
                {activeBLines.map((line) => {
                  const base = n(lineBases[line.code]);
                  const tva = base * n(line.taux ?? 0) / 100;
                  return (
                  <tr key={line.code}>
                    <TD bold>{line.code}</TD>
                    <TD><span className="text-[#374151]">{line.label_fr}</span></TD>
                    <TD>
                      <span className="inline-block bg-[#F3F4F6] text-[#374151] text-[11px] font-semibold px-2 py-0.5 rounded-full">
                        {line.taux ?? 0}%
                      </span>
                    </TD>
                    <TD right>
                      <NumInput
                        value={base}
                        onChange={(value) => setLineBases((prev) => ({ ...prev, [line.code]: value }))}
                        disabled={isLocked}
                      />
                    </TD>
                    <TD right>{tva > 0 ? fmtMAD(tva) : <span className="text-[#D1D5DB]">—</span>}</TD>
                  </tr>
                )})}
                {activeBLines.length === 0 && (
                  <tr><TD>—</TD><TD>Aucune ligne active</TD><TD>—</TD><TD right>—</TD><TD right>—</TD></tr>
                )}
                <tr className="bg-[#FAFAF6]">
                  <TD bold>TOTAL</TD>
                  <TD>—</TD>
                  <TD>—</TD>
                  <TD right bold>{fmtMAD(activeBTotalBase)}</TD>
                  <TD right bold color="#C8924A">{fmtMAD(filteredCalc.tva_collectee_total)}</TD>
                </tr>
              </tbody>
            </table>
          </SectionCard>

          {activeCLines.length > 0 && (
            <SectionCard title="C — Opérations avec les non-résidents">
              <table className="w-full">
                <thead>
                  <tr><TH>Ligne DGI</TH><TH>Désignation</TH><TH right>Statut</TH></tr>
                </thead>
                <tbody>
                  {activeCLines.map((line) => (
                    <tr key={line.code}>
                      <TD bold>{line.code}</TD>
                      <TD>{line.label_fr}</TD>
                      <TD right><span className="badge-pill bg-[#D1FAE5] text-[#065F46]">Active</span></TD>
                    </tr>
                  ))}
                </tbody>
              </table>
            </SectionCard>
          )}

          {/* ─────────────────────────────────────────────────────────────── */}
          {/* SECTION D — TVA Exigible                                       */}
          {/* ─────────────────────────────────────────────────────────────── */}
          <SectionCard title="D — Calcul de la TVA exigible">
            <table className="w-full">
              <thead>
                <tr><TH>Désignation</TH><TH right>Montant (MAD)</TH></tr>
              </thead>
              <tbody>
                {activeBLines.map(line => {
                  const tva = n(lineBases[line.code]) * n(line.taux ?? 0) / 100;
                  if (tva === 0) return null;
                  return (
                    <tr key={line.code}>
                      <TD>{line.code} — {line.label_fr}</TD>
                      <TD right>{fmtMAD(tva)}</TD>
                    </tr>
                  );
                })}
                {sectionDEnabled && <tr>
                  <TD>
                    <div>
                      <span className="text-[#6B7280]">
                        {activeDLines.map((line) => `${line.code} — ${line.label_fr}`).join(" · ")}
                      </span>
                      <input className="input ml-2 text-[11.5px] w-[220px]" placeholder="Note justificative…"
                        value={odTvaNote} onChange={e => setOdTvaNote(e.target.value)} disabled={isLocked} />
                    </div>
                  </TD>
                  <TD right>
                    <NumInput value={odTva} onChange={setOdTva} disabled={isLocked} />
                  </TD>
                </tr>}
                <tr className="bg-[#FAFAF6]">
                  <TD bold>TVA exigible totale (= TVA collectée + OD)</TD>
                  <TD right bold color="#C8924A">{fmtMAD(tvaExigible)}</TD>
                </tr>
              </tbody>
            </table>
          </SectionCard>

          {/* ─────────────────────────────────────────────────────────────── */}
          {/* SECTION E — Déductions                                         */}
          {/* ─────────────────────────────────────────────────────────────── */}
          <SectionCard title="E — Les déductions">
            <div className="p-4">
              <div className="mb-4 flex flex-wrap gap-1.5">
                {activeELines.map((line) => (
                  <span key={line.code} className="rounded-md bg-[#F3F4F6] px-2 py-1 text-[10.5px] font-medium text-[#6B7280]">
                    {line.code} — {line.label_fr}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-[#F3F4F6] rounded-lg p-3 text-center">
                  <div className="text-[10.5px] font-medium text-[#6B7280] uppercase tracking-[0.5px] mb-1">Sur charges</div>
                  <div className="text-[14px] font-bold text-[#1A1A2E]">{fmtMAD(filteredCalc.deductions_charges)}</div>
                </div>
                <div className="bg-[#F3F4F6] rounded-lg p-3 text-center">
                  <div className="text-[10.5px] font-medium text-[#6B7280] uppercase tracking-[0.5px] mb-1">Sur immobilisations</div>
                  <div className="text-[14px] font-bold text-[#1A1A2E]">{fmtMAD(filteredCalc.deductions_immobilisations)}</div>
                </div>
                <div className="bg-[#EFF6FF] rounded-lg p-3 text-center border border-[rgba(37,99,235,0.15)]">
                  <div className="text-[10.5px] font-medium text-[#6B7280] uppercase tracking-[0.5px] mb-1">Crédit reporté</div>
                  <div className="text-[14px] font-bold text-[#1D4ED8]">{fmtMAD(filteredCalc.credit_reporte)}</div>
                </div>
              </div>

              {/* Relevé des déductions */}
              <button onClick={() => setShowDeductions(v => !v)}
                className="w-full flex items-center justify-between text-[12px] font-medium text-[#374151] mb-2 hover:text-[#C8924A] transition-colors">
                <span>Relevé des déductions ({filteredCalc.deductions.length} ligne{filteredCalc.deductions.length !== 1 ? "s" : ""})</span>
                {showDeductions ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {showDeductions && filteredCalc.deductions.length > 0 && (
                <div className="overflow-x-auto rounded-lg border border-[rgba(0,0,0,0.07)]">
                  <table className="w-full">
                    <thead>
                      <tr>
                        {["Date","N° Facture","Fournisseur","Désignation","HT","Taux","TVA","Mode pmt","Date pmt","Prorata","TVA déd.","Type"].map(h => (
                          <th key={h} className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-[0.5px] px-3 py-2 bg-[#FAFAF6] whitespace-nowrap text-left">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCalc.deductions.map((d, i) => (
                        <tr key={i} className="border-t border-[rgba(0,0,0,0.04)] hover:bg-[#FAFAF6]">
                          <td className="px-3 py-2 text-[11px] text-[#6B7280] whitespace-nowrap">{fmtDate(d.date_facture)}</td>
                          <td className="px-3 py-2 text-[11px] text-[#6B7280]">{d.numero_facture || "—"}</td>
                          <td className="px-3 py-2 text-[11.5px] text-[#1A1A2E] max-w-[120px] truncate">{d.fournisseur_nom}</td>
                          <td className="px-3 py-2 text-[11.5px] text-[#374151] max-w-[140px] truncate">{d.designation}</td>
                          <td className="px-3 py-2 text-[11.5px] text-right font-medium">{fmtMAD(d.montant_ht)}</td>
                          <td className="px-3 py-2 text-[11px] text-center text-[#6B7280]">{d.taux_tva}%</td>
                          <td className="px-3 py-2 text-[11.5px] text-right font-medium text-[#3B82F6]">{fmtMAD(d.montant_tva)}</td>
                          <td className="px-3 py-2 text-[11px] text-[#6B7280]">{d.mode_paiement || "—"}</td>
                          <td className="px-3 py-2 text-[11px] text-[#6B7280] whitespace-nowrap">{fmtDate(d.date_paiement)}</td>
                          <td className="px-3 py-2 text-[11px] text-center text-[#6B7280]">{d.prorata}%</td>
                          <td className="px-3 py-2 text-[11.5px] text-right font-semibold text-[#059669]">{fmtMAD(d.tva_deductible)}</td>
                          <td className="px-3 py-2">
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                              d.type_deduction === "immobilisation"
                                ? "bg-[#EFF6FF] text-[#1D4ED8]"
                                : "bg-[#F3F4F6] text-[#6B7280]"}`}>
                              {d.type_deduction}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-[#FAFAF6] border-t-2 border-[rgba(0,0,0,0.08)]">
                        <td colSpan={4} className="px-3 py-2 text-[12px] font-bold text-[#1A1A2E]">TOTAL</td>
                        <td className="px-3 py-2 text-[12px] font-bold text-right">
                          {fmtMAD(filteredCalc.deductions.reduce((s,d) => s+d.montant_ht, 0))}
                        </td>
                        <td />
                        <td className="px-3 py-2 text-[12px] font-bold text-right text-[#3B82F6]">
                          {fmtMAD(filteredCalc.deductions.reduce((s,d) => s+d.montant_tva, 0))}
                        </td>
                        <td /><td /><td />
                        <td className="px-3 py-2 text-[12px] font-bold text-right text-[#059669]">
                          {fmtMAD(filteredCalc.deductions_total)}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
              {showDeductions && filteredCalc.deductions.length === 0 && (
                <p className="text-[12px] text-[#9CA3AF] py-3 text-center">Aucune déduction pour cette période</p>
              )}
            </div>
          </SectionCard>

          {/* ─────────────────────────────────────────────────────────────── */}
          {/* DROITS DE TIMBRE                                                */}
          {/* ─────────────────────────────────────────────────────────────── */}
          <SectionCard title="Droits de timbre">
            <div className="p-4 flex items-center justify-between gap-6">
              <div>
                <p className="text-[12.5px] text-[#374151]">
                  <strong>{calc.nb_factures}</strong> facture{calc.nb_factures !== 1 ? "s" : ""} émise{calc.nb_factures !== 1 ? "s" : ""} sur la période
                </p>
                <p className="text-[11px] text-[#9CA3AF] mt-1">
                  Droits de timbre = 2 MAD × {calc.nb_factures} facture{calc.nb_factures !== 1 ? "s" : ""}
                </p>
                <p className="text-[10.5px] text-[#9CA3AF] mt-0.5 flex items-center gap-1">
                  <Info size={11} /> Dus sur chaque facture de vente (art. 252 CGI Maroc)
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-[22px] font-bold text-[#1A1A2E]">{fmtMAD(calc.droits_timbre)}</div>
              </div>
            </div>
          </SectionCard>

          {/* ─────────────────────────────────────────────────────────────── */}
          {/* SECTION F — Résultat                                            */}
          {/* ─────────────────────────────────────────────────────────────── */}
          <div className="bg-white rounded-xl overflow-hidden mb-4"
            style={{ border: "2px solid #C8924A", boxShadow: "0 2px 8px rgba(200,146,74,0.15)" }}>
            <div className="px-4 py-2.5 border-b border-[rgba(200,146,74,0.2)]"
              style={{ background: "#C8924A" }}>
              <span className="text-[12px] font-bold text-white tracking-wide">F — Résultat de la déclaration</span>
            </div>
            <div className="p-5">
              <div className="space-y-2.5 mb-5">
                {[
                  ["TVA exigible totale", tvaExigible, "#DC2626"],
                  ["(−) Déductions sur charges + immobilisations", filteredCalc.deductions_total, "#059669"],
                  ["(−) Crédit reporté de la période précédente", filteredCalc.credit_reporte, "#059669"],
                  ["(+) Droits de timbre", calc.droits_timbre, "#374151"],
                ].map(([label, val, color]) => (
                  <div key={label as string} className="flex items-center justify-between text-[12.5px]">
                    <span className="text-[#6B7280]">{label as string}</span>
                    <span className="font-semibold" style={{ color: color as string }}>{fmtMAD(val as number)}</span>
                  </div>
                ))}
                <div className="border-t-2 border-[rgba(200,146,74,0.25)] pt-4">
                  {tvaNetteDue > 0 ? (
                    <div className="flex items-center justify-between">
                      <span className="text-[16px] font-bold text-[#1A1A2E]">TVA NETTE DUE</span>
                      <span className="text-[28px] font-bold text-[#DC2626]">{fmtMAD(tvaNetteDue)}</span>
                    </div>
                  ) : creditTVA > 0 ? (
                    <div className="flex items-center justify-between">
                      <span className="text-[16px] font-bold text-[#1A1A2E]">CRÉDIT DE TVA</span>
                      <span className="text-[28px] font-bold text-[#059669]">{fmtMAD(creditTVA)}</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-[16px] font-bold text-[#1A1A2E]">TVA NETTE DUE</span>
                      <span className="text-[28px] font-bold text-[#059669]">0,00 MAD</span>
                    </div>
                  )}
                </div>
              </div>

              {creditTVA > 0 && (
                <div className="bg-[#EFF6FF] border border-[rgba(37,99,235,0.2)] rounded-lg px-4 py-3 text-[12px] text-[#1E40AF] mb-4">
                  💡 Crédit de TVA de <strong>{fmtMAD(creditTVA)}</strong> — sera reporté sur la prochaine déclaration.
                </div>
              )}

              {tvaNetteDue > 0 && !isLocked && (
                <div className="border-t border-[rgba(0,0,0,0.07)] pt-4">
                  <div className="flex items-start gap-2 mb-3">
                    <AlertTriangle size={14} className="text-[#D97706] flex-shrink-0 mt-0.5" />
                    <p className="text-[12px] text-[#374151]">
                      Échéance de paiement : <strong>20 {MONTHS_FR[deadline.getMonth()]} {deadline.getFullYear()}</strong>
                      {daysLeft < 0
                        ? <span className="text-[#DC2626]"> (en retard de {Math.abs(daysLeft)} jours)</span>
                        : <span className={daysLeft <= 7 ? "text-[#DC2626]" : "text-[#D97706]"}> ({daysLeft} jours restants)</span>}
                    </p>
                  </div>
                  <div className="bg-[#FAFAF6] rounded-lg p-3 space-y-1.5">
                    <p className="text-[11.5px] text-[#374151]">💳 Paiement par carte bancaire sur SIMPL-TVA</p>
                    <p className="text-[11.5px] text-[#374151]">🏦 Paiement par prélèvement bancaire (RIB requis)</p>
                    <p className="text-[11.5px] text-[#374151]">📱 Paiement Multicanal (référence à télécharger)</p>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-[rgba(0,0,0,0.07)]">
                {statut === "brouillon" && !isLocked && (
                  <button data-permission="tva_declaration:validate" onClick={() => setConfirmValidate(true)} disabled={saving || isLocked}
                    className="btn btn-outline flex items-center gap-1.5 text-[12px] border-[#C8924A] text-[#C8924A] hover:bg-[#FFF7ED]">
                    <CheckCircle size={12} /> Valider
                  </button>
                )}
                {entitlements.features.tva_edi && <button data-permission="tva_declaration:prepare" onClick={handleEDI}
                  className="btn btn-gold flex items-center gap-1.5 text-[12px]">
                  <Download size={13} /> Fichier EDI (XML)
                </button>}
                {statut !== "déposé" && !isLocked && (
                  <button data-permission="tva_declaration:validate" onClick={() => handleSave("déposé")} disabled={saving || isLocked}
                    className="btn btn-outline flex items-center gap-1.5 text-[12px]">
                    <CheckCircle size={13} />
                    {saving ? "…" : "Marquer comme déposée"}
                  </button>
                )}
                <a href="https://simpl.tax.gov.ma" target="_blank" rel="noopener noreferrer"
                  className="btn btn-outline flex items-center gap-1.5 text-[12px] text-[#065F46] border-[rgba(5,150,105,0.3)] hover:bg-[#DCFCE7]">
                  Ouvrir SIMPL-TVA →
                </a>
              </div>
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────── */}
          {/* ANNUAL SUMMARY                                                  */}
          {/* ─────────────────────────────────────────────────────────────── */}
          <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl p-4 mb-4">
            <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-[0.5px] mb-3">
              Situation de l'exercice {year}
            </p>
            <div className="flex gap-6">
              <div>
                <div className="text-[11px] text-[#9CA3AF]">CA exercice (Jan–Déc {year})</div>
                <div className="text-[16px] font-bold text-[#1A1A2E]">{fmtMAD(calc.ca_exercice_annuel)}</div>
              </div>
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────── */}
          {/* DETAIL COLLAPSIBLES                                             */}
          {/* ─────────────────────────────────────────────────────────────── */}
          <div className="bg-white border border-[rgba(0,0,0,0.07)] rounded-xl overflow-hidden mb-4">
            <button onClick={() => setShowInvoices(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#FAFAF6] transition-colors">
              <span className="text-[12.5px] font-medium text-[#1A1A2E]">
                📄 Factures incluses ({calc.invoices.length})
              </span>
              {showInvoices ? <ChevronUp size={14} className="text-[#9CA3AF]" /> : <ChevronDown size={14} className="text-[#9CA3AF]" />}
            </button>
            {showInvoices && (
              <table className="w-full border-t border-[rgba(0,0,0,0.06)]">
                <thead>
                  <tr>
                    {["N°","Client","Date","Base HT","TVA","TTC"].map((h,i) => (
                      <th key={h} className={`text-[10.5px] font-semibold text-[#9CA3AF] uppercase tracking-[0.5px] px-4 py-2.5 bg-[#FAFAF6] ${i>2?"text-right":"text-left"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {calc.invoices.length === 0
                    ? <tr><td colSpan={6} className="px-4 py-6 text-center text-[12px] text-[#9CA3AF]">Aucune facture pour cette période</td></tr>
                    : calc.invoices.map(inv => (
                      <tr key={inv.id} className="border-t border-[rgba(0,0,0,0.04)] hover:bg-[#FAFAF6]">
                        <td className="px-4 py-2.5 text-[11.5px] text-[#6B7280]">
                          <Link href={`/invoices/${inv.id}`} className="hover:text-[#C8924A]">{inv.invoice_number}</Link>
                        </td>
                        <td className="px-4 py-2.5 text-[12px]">{inv.client_name}</td>
                        <td className="px-4 py-2.5 text-[11.5px] text-[#6B7280]">{fmtDate(inv.issue_date)}</td>
                        <td className="px-4 py-2.5 text-[12px] text-right">{fmtMAD(inv.subtotal)}</td>
                        <td className="px-4 py-2.5 text-[12px] text-right text-[#C8924A]">{fmtMAD(inv.tax_amount)}</td>
                        <td className="px-4 py-2.5 text-[12px] text-right font-semibold">{fmtMAD(inv.total)}</td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

        </div>

        {/* RIGHT: history panel */}
        <div>
          <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl overflow-hidden"
            style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <div className="px-4 py-2.5 border-b border-[rgba(0,0,0,0.07)] bg-[#F3F4F6]">
              <span className="text-[12px] font-bold text-[#374151] tracking-wide">Historique des déclarations</span>
            </div>
            {history.length > 0 ? (
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-[0.5px] px-3 py-2.5 bg-[#FAFAF6] text-left">Période</th>
                    <th className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-[0.5px] px-3 py-2.5 bg-[#FAFAF6] text-right">TVA due</th>
                    <th className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-[0.5px] px-3 py-2.5 bg-[#FAFAF6] text-right">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(decl => {
                    const due = Number(decl.tva_nette_due ?? decl.tva_nette ?? 0);
                    const st = decl.statut ?? decl.status;
                    return (
                      <tr key={decl.id} className="border-t border-[rgba(0,0,0,0.05)] hover:bg-[#FAFAF6]">
                        <td className="px-3 py-2.5 text-[12px] font-medium text-[#1A1A2E]">{decl.period_label}</td>
                        <td className="px-3 py-2.5 text-[11.5px] font-semibold text-right text-[#DC2626]">{fmtMAD(due)}</td>
                        <td className="px-3 py-2.5 text-right">
                          {(st === "filed" || st === "déposé")
                            ? <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#065F46] bg-[#D1FAE5] px-1.5 py-0.5 whitespace-nowrap"><CheckCircle size={10} aria-hidden="true" /> Déposée</span>
                            : st === "validé"
                              ? <span className="text-[10px] font-semibold text-[#92400E] bg-[#FEF3C7] px-1.5 py-0.5 whitespace-nowrap">🔒 Validée</span>
                              : <span className="text-[10px] font-semibold text-[#6B7280] bg-[#F3F4F6] px-1.5 py-0.5 whitespace-nowrap">📝 Brouillon</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p className="empty-state min-h-24 py-5">Aucune déclaration enregistrée. Créez une période pour commencer.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
