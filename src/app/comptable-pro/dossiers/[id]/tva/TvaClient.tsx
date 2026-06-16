"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import {
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Receipt, CheckCircle, Download,
  AlertTriangle, Info,
} from "lucide-react";
import { usePlanEntitlements } from "@/hooks/usePlanEntitlements";
import { useAccountOwnerId } from "@/hooks/useAccountOwner";
import { translateError } from "@/lib/errors";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CalcResult {
  ca_total: number;
  ca_7: number; ca_10: number; ca_14: number; ca_20: number;
  tva_7: number; tva_10: number; tva_14: number; tva_20: number;
  tva_collectee_total: number;
  deductions_charges: number;
  deductions_immobilisations: number;
  deductions_total: number;
  credit_reporte: number;
  nb_factures: number;
  droits_timbre: number;
  tva_nette_due: number;
  credit_tva: number;
  ca_exercice_annuel: number;
  invoices: InvRow[];
  deductions: DedRow[];
}

interface InvRow {
  id: string; invoice_number: string; client_name: string;
  issue_date: string; subtotal: number; tax_amount: number; total: number;
}
interface DedRow {
  id: string; date_facture: string; numero_facture: string;
  fournisseur_nom: string; fournisseur_if: string; fournisseur_ice: string;
  designation: string; montant_ht: number; taux_tva: number; montant_tva: number;
  mode_paiement: string; date_paiement: string; prorata: number;
  tva_deductible: number; type_deduction: string;
}
interface HistoryRow {
  id: string; periode: string; tva_collectee: number;
  tva_deductible: number; net_du: number; statut: string; date_depot: string | null;
}
interface Dossier {
  id: string; raison_sociale: string; ice: string | null;
  if_fiscal: string | null; rc: string | null; regime_tva: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function n(x: number) { return Number(x) || 0; }
function fmtMAD(x: number) {
  return n(x).toLocaleString("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " MAD";
}
function fmtDate(d: string) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("fr-MA", { day: "2-digit", month: "2-digit", year: "2-digit" });
}
function toISO(d: Date) { return d.toISOString().split("T")[0]; }

const MONTHS_FR = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

function getPeriodDates(regime: string, year: number, month: number, quarter: number) {
  if (regime === "Mensuel") {
    return { start: toISO(new Date(year, month - 1, 1)), end: toISO(new Date(year, month, 0)) };
  }
  const qm = (quarter - 1) * 3;
  return { start: toISO(new Date(year, qm, 1)), end: toISO(new Date(year, qm + 3, 0)) };
}
function getPeriodLabel(regime: string, year: number, month: number, quarter: number) {
  if (regime === "Mensuel") return `${MONTHS_FR[month - 1]} ${year}`;
  return `T${quarter} ${year} (${["Jan–Mar","Avr–Jun","Jul–Sep","Oct–Déc"][quarter - 1]})`;
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
    <input type="number" step="0.01" min="0" value={value || ""}
      onChange={e => onChange(Number(e.target.value) || 0)}
      disabled={disabled}
      className="input text-right text-[12px] w-[140px]" style={{ height: 30 }} />
  );
}

const EMPTY: CalcResult = {
  ca_total: 0, ca_7: 0, ca_10: 0, ca_14: 0, ca_20: 0,
  tva_7: 0, tva_10: 0, tva_14: 0, tva_20: 0, tva_collectee_total: 0,
  deductions_charges: 0, deductions_immobilisations: 0, deductions_total: 0,
  credit_reporte: 0, nb_factures: 0, droits_timbre: 0,
  tva_nette_due: 0, credit_tva: 0, ca_exercice_annuel: 0,
  invoices: [], deductions: [],
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function TvaClient({ dossier }: { dossier: Dossier }) {
  const ownerId = useAccountOwnerId();
  const entitlements = usePlanEntitlements();
  const supabase = createClient();
  const now = new Date();
  const regime = (dossier.regime_tva ?? "mensuel").toLowerCase() === "trimestriel"
    ? "Trimestriel" : "Mensuel";
  const [year, setYear]       = useState(now.getFullYear());
  const [month, setMonth]     = useState(now.getMonth() + 1);
  const [quarter, setQuarter] = useState(Math.ceil((now.getMonth() + 1) / 3));

  const [calc, setCalc]         = useState<CalcResult>(EMPTY);
  const [loading, setLoading]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [lastCalc, setLastCalc] = useState<string | null>(null);
  const [history, setHistory]   = useState<HistoryRow[]>([]);
  const [showInvoices, setShowInvoices]   = useState(false);
  const [showDeductions, setShowDeductions] = useState(false);
  const [statut, setStatut]     = useState<"brouillon"|"validé"|"déposé">("brouillon");
  const [confirmValidate, setConfirmValidate] = useState(false);
  const [generatingEDI, setGeneratingEDI] = useState(false);

  // Overrides
  const [caExporte, setCaExporte]       = useState(0);
  const [caExonere, setCaExonere]       = useState(0);
  const [caHorsChamp, setCaHorsChamp]   = useState(0);
  const [caSuspension, setCaSuspension] = useState(0);
  const [odTva, setOdTva]               = useState(0);
  const [odTvaNote, setOdTvaNote]       = useState("");

  const { start, end } = getPeriodDates(regime, year, month, quarter);
  const periodLabel    = getPeriodLabel(regime, year, month, quarter);
  const deadline       = getDeadline(regime, year, month, quarter);
  const daysLeft       = daysUntil(deadline);
  const periodKey      = `${year}-${String(regime === "Mensuel" ? month : (quarter - 1) * 3 + 1).padStart(2, "0")}`;

  function prevPeriod() {
    if (regime === "Mensuel") { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); }
    else { if (quarter === 1) { setQuarter(4); setYear(y => y - 1); } else setQuarter(q => q - 1); }
  }
  function nextPeriod() {
    if (regime === "Mensuel") { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); }
    else { if (quarter === 4) { setQuarter(1); setYear(y => y + 1); } else setQuarter(q => q + 1); }
  }

  const loadHistory = useCallback(async () => {
    const { data } = await supabase.from("dossier_tva").select("*")
      .eq("dossier_id", dossier.id).order("periode", { ascending: false }).limit(24);
    setHistory((data ?? []) as HistoryRow[]);
  }, [dossier.id]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const recalculate = useCallback(async () => {
    setLoading(true);

    const [invRes, expRes, lastDeclRes, yearInvRes] = await Promise.all([
      supabase.from("invoices")
        .select("id, invoice_number, subtotal, tax_rate, tax_amount, total, issue_date, items, clients(name)")
        .eq("dossier_id", dossier.id)
        .not("status", "in", '("draft","cancelled")')
        .gte("issue_date", start).lte("issue_date", end)
        .order("issue_date"),
      supabase.from("transactions")
        .select("id, description, category, date, amount, tva_rate, tva_amount, fournisseur, if_fournisseur, ice_fournisseur, mode_paiement, date_paiement, compte_comptable")
        .eq("dossier_id", dossier.id)
        .eq("type", "expense")
        .gte("date", start).lte("date", end)
        .order("date"),
      supabase.from("dossier_tva").select("net_du")
        .eq("dossier_id", dossier.id)
        .lt("periode", periodKey)
        .order("periode", { ascending: false }).limit(1),
      supabase.from("invoices").select("subtotal")
        .eq("dossier_id", dossier.id)
        .not("status", "in", '("draft","cancelled")')
        .gte("issue_date", `${start.slice(0,4)}-01-01`)
        .lte("issue_date", `${start.slice(0,4)}-12-31`),
    ]);

    // Section B: CA by rate
    let ca_7 = 0, ca_10 = 0, ca_14 = 0, ca_20 = 0;
    const invoices: InvRow[] = [];

    for (const inv of (invRes.data ?? []) as any[]) {
      const items = (inv.items ?? []) as any[];
      const hasItemRates = items.some((it: any) => it.tva_rate != null);
      if (hasItemRates && items.length > 0) {
        for (const it of items) {
          const rate = Number(it.tva_rate ?? inv.tax_rate ?? 20);
          const ht = Number(it.amount ?? 0);
          if (rate === 7) ca_7 += ht; else if (rate === 10) ca_10 += ht;
          else if (rate === 14) ca_14 += ht; else ca_20 += ht;
        }
      } else {
        const rate = Number(inv.tax_rate ?? 20);
        const ht = Number(inv.subtotal ?? 0);
        if (rate === 7) ca_7 += ht; else if (rate === 10) ca_10 += ht;
        else if (rate === 14) ca_14 += ht; else ca_20 += ht;
      }
      invoices.push({
        id: inv.id, invoice_number: inv.invoice_number,
        client_name: inv.clients?.name ?? "—",
        issue_date: inv.issue_date,
        subtotal: Number(inv.subtotal), tax_amount: Number(inv.tax_amount), total: Number(inv.total),
      });
    }

    const ca_total = ca_7 + ca_10 + ca_14 + ca_20;
    const tva_7  = ca_7  * 0.07;
    const tva_10 = ca_10 * 0.10;
    const tva_14 = ca_14 * 0.14;
    const tva_20 = ca_20 * 0.20;
    const tva_collectee_total = tva_7 + tva_10 + tva_14 + tva_20;

    // Section E: Deductions
    let deductions_charges = 0, deductions_immobilisations = 0;
    const deductions: DedRow[] = [];

    for (const exp of (expRes.data ?? []) as any[]) {
      const rate = Number(exp.tva_rate ?? 20);
      const ht   = Number(exp.amount ?? 0);
      const tva  = exp.tva_amount != null ? Number(exp.tva_amount) : ht * rate / 100;
      const isImmo = exp.compte_comptable?.startsWith("2") ?? false;
      if (isImmo) deductions_immobilisations += tva; else deductions_charges += tva;
      deductions.push({
        id: exp.id,
        date_facture: exp.date,
        numero_facture: "",
        fournisseur_nom: exp.fournisseur ?? exp.description ?? "—",
        fournisseur_if: exp.if_fournisseur ?? "",
        fournisseur_ice: exp.ice_fournisseur ?? "",
        designation: exp.description ?? "—",
        montant_ht: ht, taux_tva: rate, montant_tva: tva,
        mode_paiement: exp.mode_paiement ?? "",
        date_paiement: exp.date_paiement ?? exp.date,
        prorata: 100, tva_deductible: tva,
        type_deduction: isImmo ? "immobilisation" : "charge",
      });
    }

    const deductions_total = deductions_charges + deductions_immobilisations;
    const lastDecl = (lastDeclRes.data ?? [])[0];
    const credit_reporte = Math.max(0, -(Number(lastDecl?.net_du ?? 0)));

    const nb_factures = invoices.length;
    const droits_timbre = nb_factures * 2;

    const totalDed = deductions_total + credit_reporte;
    const raw = tva_collectee_total + droits_timbre - totalDed;
    const tva_nette_due = Math.max(0, raw);
    const credit_tva    = Math.max(0, -raw);

    const ca_exercice_annuel = (yearInvRes.data ?? []).reduce(
      (s: number, inv: any) => s + Number(inv.subtotal ?? 0), 0
    );

    setCalc({
      ca_total, ca_7, ca_10, ca_14, ca_20,
      tva_7, tva_10, tva_14, tva_20, tva_collectee_total,
      deductions_charges, deductions_immobilisations, deductions_total,
      credit_reporte, nb_factures, droits_timbre,
      tva_nette_due, credit_tva, ca_exercice_annuel,
      invoices, deductions,
    });
    setLastCalc(new Date().toLocaleTimeString("fr-MA", { hour: "2-digit", minute: "2-digit" }));
    setLoading(false);
  }, [dossier.id, start, end, periodKey]);

  useEffect(() => { recalculate(); }, [recalculate]);

  // Sync statut when period or history changes
  useEffect(() => {
    const found = history.find(h => h.periode === periodKey);
    if (found) {
      const s = found.statut;
      setStatut(s === "deposee" || s === "déposé" ? "déposé" : s === "validé" ? "validé" : "brouillon");
    } else {
      setStatut("brouillon");
    }
  }, [periodKey, history]);

  // ── Derived totals ─────────────────────────────────────────────────────────
  const caImposable = calc.ca_total - n(caExporte) - n(caExonere) - n(caHorsChamp) - n(caSuspension);
  const tvaExigible = calc.tva_collectee_total + n(odTva);
  const totalDed    = calc.deductions_total + calc.credit_reporte;
  const raw         = tvaExigible + calc.droits_timbre - totalDed;
  const tvaNetteDue = Math.max(0, raw);
  const creditTVA   = Math.max(0, -raw);
  const isFiled     = statut === "déposé";

  // ── Save ───────────────────────────────────────────────────────────────────
  async function handleSave(newStatut: "brouillon"|"validé"|"déposé") {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("dossier_tva").upsert({
      dossier_id: dossier.id,
      fiduciaire_user_id: ownerId,
      periode: periodKey,
      tva_collectee: calc.tva_collectee_total,
      tva_deductible: calc.deductions_total,
      net_du: tvaNetteDue > 0 ? tvaNetteDue : -creditTVA,
      statut: newStatut === "déposé" ? "deposee" : newStatut,
      date_depot: newStatut === "déposé" ? new Date().toISOString() : null,
    }, { onConflict: "dossier_id,periode" });
    setSaving(false);
    setConfirmValidate(false);
    if (error) { toast.error(translateError(error)); return; }
    setStatut(newStatut);
    await loadHistory();
    toast.success(newStatut === "déposé" ? "Déclaration marquée comme déposée ✓" : "Déclaration validée ✓");
  }

  // ── EDI ────────────────────────────────────────────────────────────────────
  async function handleEDI() {
    setGeneratingEDI(true);
    try {
      const JSZip   = (await import("jszip")).default;
      const esc     = (s: string) => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
      const n2      = (x: number) => n(x).toFixed(2);
      const ifNum   = dossier.if_fiscal ?? "";
      const ice     = dossier.ice ?? "";
      const rs      = dossier.raison_sociale;
      const yearStr = String(year);
      const monthStr = String(regime === "Mensuel" ? month : (quarter - 1) * 3 + 1).padStart(2, "0");

      const lignesB = [20,14,10,7].map(r => {
        const ca  = r===20?calc.ca_20:r===14?calc.ca_14:r===10?calc.ca_10:calc.ca_7;
        const tva = r===20?calc.tva_20:r===14?calc.tva_14:r===10?calc.tva_10:calc.tva_7;
        return ca > 0 ? `\n    <LigneImposable taux="${r}"><BaseHT>${n2(ca)}</BaseHT><TVA>${n2(tva)}</TVA></LigneImposable>` : "";
      }).join("");

      const lignesDed = calc.deductions.map((d,i) => `
    <Deduction numero="${i+1}">
      <DateFacture>${d.date_facture}</DateFacture>
      <Fournisseur>${esc(d.fournisseur_nom)}</Fournisseur>
      <IF>${esc(d.fournisseur_if)}</IF>
      <ICE>${esc(d.fournisseur_ice)}</ICE>
      <Designation>${esc(d.designation)}</Designation>
      <MontantHT>${n2(d.montant_ht)}</MontantHT><Taux>${d.taux_tva}</Taux>
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
      <Annee>${yearStr}</Annee><Mois>${monthStr}</Mois><Regime>${regime}</Regime>
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
    <TotalImposable>${n2(caImposable)}</TotalImposable>
    <TotalTVA>${n2(calc.tva_collectee_total)}</TotalTVA>
  </SectionB>
  <SectionD>
    <TVAExigible>${n2(tvaExigible)}</TVAExigible>
    <ODTVA>${n2(odTva)}</ODTVA>
  </SectionD>
  <SectionE>
    <DroitsTimbre>${n2(calc.droits_timbre)}</DroitsTimbre>
    <ReleveDeductions>${lignesDed}
    </ReleveDeductions>
    <DeductionsTotal>${n2(calc.deductions_total)}</DeductionsTotal>
    <CreditReporte>${n2(calc.credit_reporte)}</CreditReporte>
  </SectionE>
  <SectionF>
    <TVANetteDue>${n2(tvaNetteDue)}</TVANetteDue>
    <CreditTVA>${n2(creditTVA)}</CreditTVA>
  </SectionF>
</DeclarationTVA>`;

      const zip  = new JSZip();
      zip.file("declaration.xml", xml);
      const blob = await zip.generateAsync({ type: "blob" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url;
      a.download = `TVA_${ifNum||rs.replace(/\s+/g,"_")}_${yearStr}_${monthStr}.zip`;
      a.click(); URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[EDI]", err);
      toast.error("Erreur lors de la génération EDI");
    }
    setGeneratingEDI(false);
  }

  const statutBadge = isFiled ? "bg-[#D1FAE5] text-[#065F46]"
    : statut === "validé" ? "bg-[#FEF3C7] text-[#92400E]"
    : "bg-[#F3F4F6] text-[#6B7280]";
  const statutLabel = isFiled ? "✅ Déposée"
    : statut === "validé" ? "🔒 Validée" : "📝 Brouillon";

  // ─── Render ───────────────────────────────────────────────────────────────

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
              {dossier.raison_sociale}
              <span className="ml-2 inline-block bg-[#F3F4F6] text-[#374151] text-[10.5px] font-medium px-2 py-0.5 rounded-full">{regime}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10.5px] font-semibold px-2.5 py-1 rounded-lg ${statutBadge}`}>{statutLabel}</span>
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

      {/* ── Confirm validate ────────────────────────────────────────────────── */}
      {confirmValidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <p className="text-[14px] font-bold text-[#1A1A2E] mb-2">Valider la déclaration ?</p>
            <p className="text-[12.5px] text-[#6B7280] mb-5">
              Une fois validée, les montants sont figés. Vous pourrez ensuite la marquer comme déposée.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmValidate(false)} className="btn btn-outline text-[12px]">Annuler</button>
              <button data-permission="tva_declaration:validate" onClick={() => handleSave("validé")} disabled={saving} className="btn btn-gold text-[12px]">
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
          {[1,2,3].map(i => <div key={i} className="bg-white rounded-xl border border-[rgba(0,0,0,0.07)] h-28" />)}
        </div>
      ) : (
        <>
          {/* SECTION A */}
          <SectionCard title="A — Chiffre d'affaires total">
            <table className="w-full">
              <thead><tr><TH>Ligne</TH><TH>Désignation</TH><TH right>Montant (MAD)</TH></tr></thead>
              <tbody>
                <tr>
                  <TD>01</TD>
                  <TD>CA total réalisé au titre de la période</TD>
                  <TD right bold>{fmtMAD(calc.ca_total)}</TD>
                </tr>
                {([
                  ["02","Dont : CA à l'exportation", caExporte, setCaExporte],
                  ["03","Dont : CA exonéré (Art. 91, 92, 94, 95)", caExonere, setCaExonere],
                  ["04","Dont : CA hors champ de la TVA", caHorsChamp, setCaHorsChamp],
                  ["05","Dont : CA réalisé en suspension de TVA", caSuspension, setCaSuspension],
                ] as [string, string, number, (v:number)=>void][]).map(([code, label, val, setter]) => (
                  <tr key={code}>
                    <TD>{code}</TD>
                    <TD><span className="text-[#6B7280]">{label}</span></TD>
                    <TD right><NumInput value={val} onChange={setter} disabled={isFiled} /></TD>
                  </tr>
                ))}
                <tr className="bg-[#FAFAF6]">
                  <TD bold>—</TD>
                  <TD bold>CA imposable (01 − 02 − 03 − 04 − 05)</TD>
                  <TD right bold color="#C8924A">{fmtMAD(caImposable)}</TD>
                </tr>
              </tbody>
            </table>
          </SectionCard>

          {/* SECTION B */}
          <SectionCard title="B — Chiffre d'affaires imposable par taux">
            <table className="w-full">
              <thead><tr><TH>Taux TVA</TH><TH right>Base imposable HT (MAD)</TH><TH right>TVA correspondante (MAD)</TH></tr></thead>
              <tbody>
                {[
                  { rate: 20, ca: calc.ca_20, tva: calc.tva_20 },
                  { rate: 14, ca: calc.ca_14, tva: calc.tva_14 },
                  { rate: 10, ca: calc.ca_10, tva: calc.tva_10 },
                  { rate:  7, ca: calc.ca_7,  tva: calc.tva_7  },
                ].map(({ rate, ca, tva }) => (
                  <tr key={rate}>
                    <TD>
                      <span className="inline-block bg-[#F3F4F6] text-[#374151] text-[11px] font-semibold px-2 py-0.5 rounded-full">{rate}%</span>
                    </TD>
                    <TD right>{ca > 0 ? fmtMAD(ca) : <span className="text-[#D1D5DB]">—</span>}</TD>
                    <TD right>{tva > 0 ? fmtMAD(tva) : <span className="text-[#D1D5DB]">—</span>}</TD>
                  </tr>
                ))}
                <tr className="bg-[#FAFAF6]">
                  <TD bold>TOTAL</TD>
                  <TD right bold>{fmtMAD(caImposable)}</TD>
                  <TD right bold color="#C8924A">{fmtMAD(calc.tva_collectee_total)}</TD>
                </tr>
              </tbody>
            </table>
          </SectionCard>

          {/* SECTION D */}
          <SectionCard title="D — Calcul de la TVA exigible">
            <table className="w-full">
              <thead><tr><TH>Désignation</TH><TH right>Montant (MAD)</TH></tr></thead>
              <tbody>
                {[20,14,10,7].map(r => {
                  const tva = r===20?calc.tva_20:r===14?calc.tva_14:r===10?calc.tva_10:calc.tva_7;
                  if (tva === 0) return null;
                  return <tr key={r}><TD>TVA facturée sur ventes à {r}%</TD><TD right>{fmtMAD(tva)}</TD></tr>;
                })}
                <tr>
                  <TD>
                    <div>
                      <span className="text-[#6B7280]">Opérations Diverses TVA (OD)</span>
                      <input className="input ml-2 text-[11.5px] w-[220px]" placeholder="Note justificative…"
                        value={odTvaNote} onChange={e => setOdTvaNote(e.target.value)} disabled={isFiled} />
                    </div>
                  </TD>
                  <TD right><NumInput value={odTva} onChange={setOdTva} disabled={isFiled} /></TD>
                </tr>
                <tr className="bg-[#FAFAF6]">
                  <TD bold>TVA exigible totale (= TVA collectée + OD)</TD>
                  <TD right bold color="#C8924A">{fmtMAD(tvaExigible)}</TD>
                </tr>
              </tbody>
            </table>
          </SectionCard>

          {/* SECTION E */}
          <SectionCard title="E — Les déductions">
            <div className="p-4">
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-[#F3F4F6] rounded-lg p-3 text-center">
                  <div className="text-[10.5px] font-medium text-[#6B7280] uppercase tracking-[0.5px] mb-1">Sur charges</div>
                  <div className="text-[14px] font-bold text-[#1A1A2E]">{fmtMAD(calc.deductions_charges)}</div>
                </div>
                <div className="bg-[#F3F4F6] rounded-lg p-3 text-center">
                  <div className="text-[10.5px] font-medium text-[#6B7280] uppercase tracking-[0.5px] mb-1">Sur immobilisations</div>
                  <div className="text-[14px] font-bold text-[#1A1A2E]">{fmtMAD(calc.deductions_immobilisations)}</div>
                </div>
                <div className="bg-[#EFF6FF] rounded-lg p-3 text-center border border-[rgba(37,99,235,0.15)]">
                  <div className="text-[10.5px] font-medium text-[#6B7280] uppercase tracking-[0.5px] mb-1">Crédit reporté</div>
                  <div className="text-[14px] font-bold text-[#1D4ED8]">{fmtMAD(calc.credit_reporte)}</div>
                </div>
              </div>

              <button onClick={() => setShowDeductions(v => !v)}
                className="w-full flex items-center justify-between text-[12px] font-medium text-[#374151] mb-2 hover:text-[#C8924A] transition-colors">
                <span>Relevé des déductions ({calc.deductions.length} ligne{calc.deductions.length !== 1 ? "s" : ""})</span>
                {showDeductions ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {showDeductions && (
                calc.deductions.length > 0 ? (
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
                        {calc.deductions.map((d, i) => (
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
                                d.type_deduction === "immobilisation" ? "bg-[#EFF6FF] text-[#1D4ED8]" : "bg-[#F3F4F6] text-[#6B7280]"}`}>
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
                            {fmtMAD(calc.deductions.reduce((s,d) => s+d.montant_ht, 0))}
                          </td>
                          <td /><td className="px-3 py-2 text-[12px] font-bold text-right text-[#3B82F6]">
                            {fmtMAD(calc.deductions.reduce((s,d) => s+d.montant_tva, 0))}
                          </td>
                          <td /><td /><td />
                          <td className="px-3 py-2 text-[12px] font-bold text-right text-[#059669]">{fmtMAD(calc.deductions_total)}</td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <p className="text-[12px] text-[#9CA3AF] py-3 text-center">Aucune déduction pour cette période</p>
                )
              )}
            </div>
          </SectionCard>

          {/* DROITS DE TIMBRE */}
          <SectionCard title="Droits de timbre">
            <div className="p-4 flex items-center justify-between gap-6">
              <div>
                <p className="text-[12.5px] text-[#374151]">
                  <strong>{calc.nb_factures}</strong> facture{calc.nb_factures !== 1 ? "s" : ""} émise{calc.nb_factures !== 1 ? "s" : ""} sur la période
                </p>
                <p className="text-[11px] text-[#9CA3AF] mt-1">Droits de timbre = 2 MAD × {calc.nb_factures} facture{calc.nb_factures !== 1 ? "s" : ""}</p>
                <p className="text-[10.5px] text-[#9CA3AF] mt-0.5 flex items-center gap-1">
                  <Info size={11} /> Dus sur chaque facture de vente (art. 252 CGI Maroc)
                </p>
              </div>
              <div className="text-[22px] font-bold text-[#1A1A2E] flex-shrink-0">{fmtMAD(calc.droits_timbre)}</div>
            </div>
          </SectionCard>

          {/* SECTION F */}
          <div className="bg-white rounded-xl overflow-hidden mb-4"
            style={{ border: "2px solid #C8924A", boxShadow: "0 2px 8px rgba(200,146,74,0.15)" }}>
            <div className="px-4 py-2.5 border-b border-[rgba(200,146,74,0.2)]" style={{ background: "#C8924A" }}>
              <span className="text-[12px] font-bold text-white tracking-wide">F — Résultat de la déclaration</span>
            </div>
            <div className="p-5">
              <div className="space-y-2.5 mb-5">
                {[
                  ["TVA exigible totale", tvaExigible, "#DC2626"],
                  ["(−) Déductions sur charges + immobilisations", calc.deductions_total, "#059669"],
                  ["(−) Crédit reporté de la période précédente", calc.credit_reporte, "#059669"],
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

              {tvaNetteDue > 0 && !isFiled && (
                <div className="border-t border-[rgba(0,0,0,0.07)] pt-4 mb-4">
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
                {statut === "brouillon" && !isFiled && (
                  <button data-permission="tva_declaration:validate" onClick={() => setConfirmValidate(true)} disabled={saving}
                    className="btn btn-outline flex items-center gap-1.5 text-[12px] border-[#C8924A] text-[#C8924A] hover:bg-[#FFF7ED]">
                    <CheckCircle size={12} /> Valider
                  </button>
                )}
                {entitlements.features.tva_edi && <button data-permission="tva_declaration:prepare" onClick={handleEDI} disabled={generatingEDI}
                  className="btn btn-gold flex items-center gap-1.5 text-[12px]">
                  <Download size={13} /> {generatingEDI ? "Génération…" : "Fichier EDI (XML)"}
                </button>}
                {!isFiled && (
                  <button data-permission="tva_declaration:validate" onClick={() => handleSave("déposé")} disabled={saving}
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

          {/* Annual summary */}
          <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl p-4 mb-4">
            <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-[0.5px] mb-3">
              Situation de l'exercice {year}
            </p>
            <div>
              <div className="text-[11px] text-[#9CA3AF]">CA exercice (Jan–Déc {year})</div>
              <div className="text-[16px] font-bold text-[#1A1A2E]">{fmtMAD(calc.ca_exercice_annuel)}</div>
            </div>
          </div>

          {/* Invoices collapsible */}
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
                        <td className="px-4 py-2.5 text-[11.5px] text-[#6B7280]">{inv.invoice_number}</td>
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
                    <th className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-[0.5px] px-3 py-2.5 bg-[#FAFAF6] text-right">Net dû</th>
                    <th className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-[0.5px] px-3 py-2.5 bg-[#FAFAF6] text-right">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(h => (
                    <tr key={h.id} className="border-t border-[rgba(0,0,0,0.05)] hover:bg-[#FAFAF6]">
                      <td className="px-3 py-2.5 text-[12px] font-medium text-[#1A1A2E]">{h.periode}</td>
                      <td className={`px-3 py-2.5 text-[11.5px] font-semibold text-right ${h.net_du >= 0 ? "text-[#DC2626]" : "text-[#059669]"}`}>
                        {fmtMAD(Math.abs(h.net_du))}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {h.statut === "deposee"
                          ? <span className="text-[10px] font-semibold text-[#065F46] bg-[#D1FAE5] px-1.5 py-0.5 rounded-full whitespace-nowrap">✅ Déposée</span>
                          : h.statut === "validé"
                            ? <span className="text-[10px] font-semibold text-[#92400E] bg-[#FEF3C7] px-1.5 py-0.5 rounded-full whitespace-nowrap">🔒 Validée</span>
                            : <span className="text-[10px] font-semibold text-[#6B7280] bg-[#F3F4F6] px-1.5 py-0.5 rounded-full whitespace-nowrap">📝 Brouillon</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-[12px] text-[#9CA3AF] p-4 text-center">Aucune déclaration enregistrée.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
