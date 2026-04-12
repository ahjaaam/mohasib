"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, FileText, CheckCircle, Send } from "lucide-react";
import {
  fetchTVAData, markAsFiled, fetchDeclarationHistory,
  type TVAData, type TVADeclaration,
} from "./actions";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtMAD(n: number): string {
  return n.toLocaleString("fr-MA", { maximumFractionDigits: 0 }) + " MAD";
}

function toISO(d: Date): string {
  return d.toISOString().split("T")[0];
}

const MONTHS_FR = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const MONTHS_SHORT = ["jan", "fév", "mar", "avr", "mai", "jun", "jul", "aoû", "sep", "oct", "nov", "déc"];

function getPeriodDates(regime: string, year: number, month: number, quarter: number) {
  if (regime === "Mensuel") {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);
    return { start: toISO(start), end: toISO(end) };
  } else {
    const qStartMonth = (quarter - 1) * 3; // 0-indexed
    const qEndMonth = qStartMonth + 2;
    const start = new Date(year, qStartMonth, 1);
    const end = new Date(year, qEndMonth + 1, 0);
    return { start: toISO(start), end: toISO(end) };
  }
}

function getDeadline(regime: string, year: number, month: number, quarter: number): Date {
  if (regime === "Mensuel") {
    return new Date(year, month, 20); // 20th of following month (month is 1-indexed, so month as 0-indexed = next month)
  }
  const deadlineMonths = [3, 6, 9, 0]; // Apr, Jul, Oct, Jan (0-indexed)
  const deadlineYear = quarter === 4 ? year + 1 : year;
  return new Date(deadlineYear, deadlineMonths[quarter - 1], 20);
}

function getPeriodLabel(regime: string, year: number, month: number, quarter: number): string {
  if (regime === "Mensuel") return `${MONTHS_FR[month - 1]} ${year}`;
  const qLabels = ["Jan–Mar", "Avr–Jun", "Jul–Sep", "Oct–Déc"];
  return `T${quarter} ${year} (${qLabels[quarter - 1]})`;
}

function daysUntil(d: Date): number {
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Company {
  raison_sociale?: string;
  ice?: string;
  if_number?: string;
  rc?: string;
  address?: string;
  city?: string;
  tva_regime?: string;
  tva_assujetti?: boolean;
  tva_taux_defaut?: number;
}

interface Props {
  company: Company | null;
  userName: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function TVACalculator({ company, userName }: Props) {
  const defaultRegime = company?.tva_regime === "Trimestriel" ? "Trimestriel" : "Mensuel";
  const now = new Date();

  const [regime, setRegime] = useState(defaultRegime);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-indexed
  const [quarter, setQuarter] = useState(Math.ceil((now.getMonth() + 1) / 3));
  const [data, setData] = useState<TVAData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandInvoices, setExpandInvoices] = useState(false);
  const [expandExpenses, setExpandExpenses] = useState(false);
  const [history, setHistory] = useState<TVADeclaration[]>([]);
  const [filing, setFiling] = useState(false);
  const [filedPeriods, setFiledPeriods] = useState<Set<string>>(new Set());
  const [generatingPDF, setGeneratingPDF] = useState(false);

  const { start, end } = getPeriodDates(regime, year, month, quarter);
  const deadline = getDeadline(regime, year, month, quarter);
  const periodLabel = getPeriodLabel(regime, year, month, quarter);
  const daysLeft = daysUntil(deadline);
  const periodKey = `${start}|${end}`;
  const isFiled = filedPeriods.has(periodKey);

  // Load history once
  useEffect(() => {
    fetchDeclarationHistory().then((h) => {
      setHistory(h);
      const filed = new Set(h.filter((d) => d.status === "filed").map((d) => `${d.period_start}|${d.period_end}`));
      setFiledPeriods(filed);
    });
  }, []);

  // Fetch TVA data on period change
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setData(null);
    const res = await fetchTVAData(start, end);
    if (res.error) setError(res.error);
    else setData(res.data ?? null);
    setLoading(false);
  }, [start, end]);

  useEffect(() => { load(); }, [load]);

  // Period navigation
  function prevPeriod() {
    if (regime === "Mensuel") {
      if (month === 1) { setMonth(12); setYear((y) => y - 1); }
      else setMonth((m) => m - 1);
    } else {
      if (quarter === 1) { setQuarter(4); setYear((y) => y - 1); }
      else setQuarter((q) => q - 1);
    }
  }
  function nextPeriod() {
    if (regime === "Mensuel") {
      if (month === 12) { setMonth(1); setYear((y) => y + 1); }
      else setMonth((m) => m + 1);
    } else {
      if (quarter === 4) { setQuarter(1); setYear((y) => y + 1); }
      else setQuarter((q) => q + 1);
    }
  }

  async function handleMarkFiled() {
    if (!data) return;
    setFiling(true);
    await markAsFiled({
      periodStart: start, periodEnd: end, periodLabel, regime,
      tvaCollectee: data.totalCollectee,
      tvaDeductible: data.totalDeductible,
      tvaNette: data.totalNette,
    });
    setFiledPeriods((prev) => new Set([...prev, periodKey]));
    const h = await fetchDeclarationHistory();
    setHistory(h);
    setFiling(false);
  }

  async function handleGeneratePDF() {
    if (!data) return;
    setGeneratingPDF(true);
    try {
      const res = await fetch("/api/tva/declaration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company, userName, periodLabel, regime,
          periodStart: start, periodEnd: end,
          deadline: deadline.toLocaleDateString("fr-MA", { day: "numeric", month: "long", year: "numeric" }),
          collectee: data.collectee,
          deductible: data.deductible,
          totalCollectee: data.totalCollectee,
          totalDeductible: data.totalDeductible,
          totalNette: data.totalNette,
        }),
      });
      if (!res.ok) throw new Error("Erreur génération PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `TVA_${periodLabel.replace(/\s/g, "_")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Erreur lors de la génération du PDF");
    }
    setGeneratingPDF(false);
  }

  const netColor = !data ? "" : data.totalNette > 0 ? "text-[#DC2626]" : data.totalNette < 0 ? "text-[#059669]" : "text-[#6B7280]";

  return (
    <div className="max-w-4xl">
      {/* ─── Period Selector ───────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        {/* Regime tabs */}
        <div className="flex border border-[rgba(0,0,0,0.1)] rounded-lg overflow-hidden w-fit">
          {["Mensuel", "Trimestriel"].map((r) => (
            <button
              key={r}
              onClick={() => { setRegime(r); setExpandInvoices(false); setExpandExpenses(false); }}
              className={`px-4 py-2 text-[12.5px] font-medium transition-colors ${
                regime === r
                  ? "bg-[#0D1526] text-white"
                  : "bg-white text-[#6B7280] hover:bg-[#F3F4F6]"
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Period picker */}
        <div className="flex items-center gap-2">
          <button onClick={prevPeriod} className="w-8 h-8 rounded-lg border border-[rgba(0,0,0,0.12)] flex items-center justify-center text-[#6B7280] hover:bg-[#F3F4F6] transition-colors">
            <ChevronLeft size={15} />
          </button>
          <span className="text-[13.5px] font-semibold text-[#1A1A2E] min-w-[160px] text-center">{periodLabel}</span>
          <button onClick={nextPeriod} className="w-8 h-8 rounded-lg border border-[rgba(0,0,0,0.12)] flex items-center justify-center text-[#6B7280] hover:bg-[#F3F4F6] transition-colors">
            <ChevronRight size={15} />
          </button>
        </div>

        {/* Status badge */}
        <div className={`flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg ${
          isFiled
            ? "bg-[#D1FAE5] text-[#065F46]"
            : daysLeft < 0
              ? "bg-[#FEE2E2] text-[#991B1B]"
              : daysLeft <= 7
                ? "bg-[#FEE2E2] text-[#991B1B]"
                : "bg-[#FEF3C7] text-[#92400E]"
        }`}>
          {isFiled ? "✅ Déclarée" : daysLeft < 0 ? `🔴 En retard de ${Math.abs(daysLeft)}j` : `⏰ Due le ${deadline.toLocaleDateString("fr-MA", { day: "numeric", month: "short" })}`}
        </div>
      </div>

      {/* ─── Warning: overdue ──────────────────────────────────────────── */}
      {!isFiled && daysLeft < 0 && (
        <div className="bg-[#FEE2E2] border border-[rgba(220,38,38,0.2)] rounded-lg px-4 py-3 mb-4 text-[12px] text-[#991B1B]">
          🔴 Cette déclaration était due le{" "}
          <strong>{deadline.toLocaleDateString("fr-MA", { day: "numeric", month: "long", year: "numeric" })}</strong>.
          Vous êtes en retard de <strong>{Math.abs(daysLeft)} jours</strong>.
        </div>
      )}
      {!isFiled && daysLeft >= 0 && daysLeft <= 7 && (
        <div className="bg-[#FEE2E2] border border-[rgba(220,38,38,0.15)] rounded-lg px-4 py-3 mb-4 text-[12px] text-[#991B1B]">
          ⚠️ Date limite dans <strong>{daysLeft} jour{daysLeft > 1 ? "s" : ""}</strong> — {deadline.toLocaleDateString("fr-MA", { day: "numeric", month: "long", year: "numeric" })}
        </div>
      )}

      {/* ─── Loading skeleton ──────────────────────────────────────────── */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 animate-pulse">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white border border-[rgba(0,0,0,0.07)] rounded-xl p-4 h-40">
              <div className="h-3 bg-[#F3F4F6] rounded w-1/3 mb-4" />
              <div className="h-3 bg-[#F3F4F6] rounded w-full mb-2" />
              <div className="h-3 bg-[#F3F4F6] rounded w-3/4 mb-2" />
              <div className="h-3 bg-[#F3F4F6] rounded w-full" />
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="bg-[#FEE2E2] border border-[rgba(220,38,38,0.2)] rounded-lg px-4 py-3 mb-4 text-[12px] text-[#991B1B]">
          Erreur: {error}
        </div>
      )}

      {!loading && data && (
        <>
          {data.invoices.length === 0 && (
            <div className="bg-white border border-[rgba(0,0,0,0.07)] rounded-xl px-5 py-10 text-center mb-4" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
              <div className="text-3xl mb-2">📄</div>
              <p className="text-[13px] font-medium text-[#6B7280]">Aucune facture trouvée pour cette période</p>
              <p className="text-[11.5px] text-[#9CA3AF] mt-1">Créez des factures ou sélectionnez une autre période.</p>
            </div>
          )}

          {/* ─── TVA Collectée ─────────────────────────────────────────── */}
          {data.collectee.length > 0 && (
            <div className="bg-white rounded-xl border border-[rgba(0,0,0,0.07)] mb-3 overflow-hidden" style={{ borderLeft: "3px solid #C8924A", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
              <div className="px-4 py-3 border-b border-[rgba(0,0,0,0.06)]">
                <div className="text-[12.5px] font-semibold text-[#1A1A2E]">TVA Collectée</div>
                <div className="text-[11px] text-[#9CA3AF]">Sur vos ventes — {data.invoices.length} facture{data.invoices.length > 1 ? "s" : ""}</div>
              </div>
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="text-left text-[10.5px] text-[#9CA3AF] font-medium uppercase tracking-[0.5px] px-4 py-2.5 bg-[#FAFAF6]">Taux TVA</th>
                    <th className="text-right text-[10.5px] text-[#9CA3AF] font-medium uppercase tracking-[0.5px] px-4 py-2.5 bg-[#FAFAF6]">Base HT</th>
                    <th className="text-right text-[10.5px] text-[#9CA3AF] font-medium uppercase tracking-[0.5px] px-4 py-2.5 bg-[#FAFAF6]">TVA</th>
                  </tr>
                </thead>
                <tbody>
                  {data.collectee.map((row) => (
                    <tr key={row.rate} className="border-t border-[rgba(0,0,0,0.05)]">
                      <td className="px-4 py-2.5 text-[12.5px] text-[#1A1A2E]">Ventes à {row.rate}%</td>
                      <td className="px-4 py-2.5 text-[12.5px] text-right text-[#374151]">{fmt(row.baseHT)}</td>
                      <td className="px-4 py-2.5 text-[12.5px] text-right font-semibold text-[#1A1A2E]">{fmt(row.tvaAmount)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-[rgba(0,0,0,0.1)] bg-[#FAFAF6]">
                    <td className="px-4 py-2.5 text-[12.5px] font-bold text-[#1A1A2E]">TOTAL</td>
                    <td className="px-4 py-2.5 text-[12.5px] font-bold text-right">{fmt(data.collectee.reduce((s, r) => s + r.baseHT, 0))}</td>
                    <td className="px-4 py-2.5 text-[12.5px] font-bold text-right text-[#C8924A]">{fmt(data.totalCollectee)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* ─── TVA Déductible ────────────────────────────────────────── */}
          {data.deductible.length > 0 && (
            <div className="bg-white rounded-xl border border-[rgba(0,0,0,0.07)] mb-3 overflow-hidden" style={{ borderLeft: "3px solid #3B82F6", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
              <div className="px-4 py-3 border-b border-[rgba(0,0,0,0.06)]">
                <div className="text-[12.5px] font-semibold text-[#1A1A2E]">TVA Déductible</div>
                <div className="text-[11px] text-[#9CA3AF]">Sur vos achats — {data.expenses.length} dépense{data.expenses.length > 1 ? "s" : ""}</div>
              </div>
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="text-left text-[10.5px] text-[#9CA3AF] font-medium uppercase tracking-[0.5px] px-4 py-2.5 bg-[#FAFAF6]">Catégorie</th>
                    <th className="text-right text-[10.5px] text-[#9CA3AF] font-medium uppercase tracking-[0.5px] px-4 py-2.5 bg-[#FAFAF6]">Base HT</th>
                    <th className="text-right text-[10.5px] text-[#9CA3AF] font-medium uppercase tracking-[0.5px] px-4 py-2.5 bg-[#FAFAF6]">TVA</th>
                  </tr>
                </thead>
                <tbody>
                  {data.deductible.map((row) => (
                    <tr key={row.category} className="border-t border-[rgba(0,0,0,0.05)]">
                      <td className="px-4 py-2.5 text-[12.5px] text-[#1A1A2E]">{row.category}</td>
                      <td className="px-4 py-2.5 text-[12.5px] text-right text-[#374151]">{fmt(row.baseHT)}</td>
                      <td className="px-4 py-2.5 text-[12.5px] text-right font-semibold text-[#1A1A2E]">{fmt(row.tvaAmount)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-[rgba(0,0,0,0.1)] bg-[#FAFAF6]">
                    <td className="px-4 py-2.5 text-[12.5px] font-bold text-[#1A1A2E]">TOTAL</td>
                    <td className="px-4 py-2.5 text-[12.5px] font-bold text-right">{fmt(data.deductible.reduce((s, r) => s + r.baseHT, 0))}</td>
                    <td className="px-4 py-2.5 text-[12.5px] font-bold text-right text-[#3B82F6]">{fmt(data.totalDeductible)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* ─── TVA Nette Summary ─────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-[rgba(0,0,0,0.07)] mb-4 p-5" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-[#6B7280]">TVA Collectée</span>
                <span className="font-medium text-[#1A1A2E]">+ {fmtMAD(data.totalCollectee)}</span>
              </div>
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-[#6B7280]">TVA Déductible</span>
                <span className="font-medium text-[#1A1A2E]">− {fmtMAD(data.totalDeductible)}</span>
              </div>
              <div className="border-t border-[rgba(0,0,0,0.08)] pt-3 flex items-center justify-between">
                <span className="text-[14px] font-bold text-[#1A1A2E]">TVA NETTE DUE</span>
                <span className={`text-[20px] font-bold ${netColor}`}>
                  {fmtMAD(Math.abs(data.totalNette))}
                  {data.totalNette > 0 ? " à payer" : data.totalNette < 0 ? " crédit" : ""}
                </span>
              </div>
            </div>
            {data.totalNette < 0 && (
              <div className="bg-[#D1FAE5] border border-[rgba(5,150,105,0.2)] rounded-lg px-3 py-2.5 text-[11.5px] text-[#065F46] mb-3">
                💡 Vous avez un crédit TVA de <strong>{fmtMAD(Math.abs(data.totalNette))}</strong>. Ce montant sera reporté sur la prochaine période.
              </div>
            )}
            {!isFiled && data.totalNette > 0 && (
              <div className="flex items-center justify-between text-[12px] text-[#6B7280]">
                <span>À payer avant le <strong className="text-[#1A1A2E]">{deadline.toLocaleDateString("fr-MA", { day: "numeric", month: "long", year: "numeric" })}</strong></span>
                <span className={`font-semibold ${daysLeft < 0 ? "text-[#DC2626]" : daysLeft <= 7 ? "text-[#DC2626]" : daysLeft <= 30 ? "text-[#D97706]" : "text-[#059669]"}`}>
                  {daysLeft < 0 ? `En retard de ${Math.abs(daysLeft)}j` : `Dans ${daysLeft} jour${daysLeft > 1 ? "s" : ""}`}
                </span>
              </div>
            )}
          </div>

          {/* ─── Collapsible details ───────────────────────────────────── */}
          <div className="flex flex-col gap-2 mb-5">
            {/* Invoices */}
            <div className="bg-white rounded-xl border border-[rgba(0,0,0,0.07)] overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
              <button
                onClick={() => setExpandInvoices((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[#FAFAF6] transition-colors"
              >
                <span className="text-[12.5px] font-medium text-[#1A1A2E]">
                  📄 Factures incluses ({data.invoices.length})
                </span>
                {expandInvoices ? <ChevronUp size={14} className="text-[#9CA3AF]" /> : <ChevronDown size={14} className="text-[#9CA3AF]" />}
              </button>
              {expandInvoices && (
                <table className="w-full border-t border-[rgba(0,0,0,0.06)]">
                  <thead>
                    <tr>
                      <th className="text-left text-[10.5px] text-[#9CA3AF] font-medium uppercase tracking-[0.5px] px-4 py-2 bg-[#FAFAF6]">N°</th>
                      <th className="text-left text-[10.5px] text-[#9CA3AF] font-medium uppercase tracking-[0.5px] px-4 py-2 bg-[#FAFAF6]">Client</th>
                      <th className="text-left text-[10.5px] text-[#9CA3AF] font-medium uppercase tracking-[0.5px] px-4 py-2 bg-[#FAFAF6]">Date</th>
                      <th className="text-right text-[10.5px] text-[#9CA3AF] font-medium uppercase tracking-[0.5px] px-4 py-2 bg-[#FAFAF6]">Base HT</th>
                      <th className="text-right text-[10.5px] text-[#9CA3AF] font-medium uppercase tracking-[0.5px] px-4 py-2 bg-[#FAFAF6]">TVA</th>
                      <th className="text-right text-[10.5px] text-[#9CA3AF] font-medium uppercase tracking-[0.5px] px-4 py-2 bg-[#FAFAF6]">TTC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.invoices.map((inv) => (
                      <tr key={inv.id} className="border-t border-[rgba(0,0,0,0.05)] hover:bg-[#FAFAF6]">
                        <td className="px-4 py-2.5 text-[11.5px] text-[#6B7280] font-medium">
                          <Link href={`/invoices/${inv.id}`} className="hover:text-[#C8924A]">{inv.invoice_number}</Link>
                        </td>
                        <td className="px-4 py-2.5 text-[12px] text-[#1A1A2E]">{inv.client_name}</td>
                        <td className="px-4 py-2.5 text-[11.5px] text-[#6B7280]">
                          {new Date(inv.issue_date).toLocaleDateString("fr-MA", { day: "2-digit", month: "2-digit" })}
                        </td>
                        <td className="px-4 py-2.5 text-[12px] text-right">{fmt(inv.subtotal)}</td>
                        <td className="px-4 py-2.5 text-[12px] text-right text-[#C8924A]">{fmt(inv.tax_amount)}</td>
                        <td className="px-4 py-2.5 text-[12px] text-right font-semibold">{fmt(inv.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Expenses */}
            {data.expenses.length > 0 && (
              <div className="bg-white rounded-xl border border-[rgba(0,0,0,0.07)] overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                <button
                  onClick={() => setExpandExpenses((v) => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[#FAFAF6] transition-colors"
                >
                  <span className="text-[12.5px] font-medium text-[#1A1A2E]">
                    💸 Dépenses incluses ({data.expenses.length})
                  </span>
                  {expandExpenses ? <ChevronUp size={14} className="text-[#9CA3AF]" /> : <ChevronDown size={14} className="text-[#9CA3AF]" />}
                </button>
                {expandExpenses && (
                  <table className="w-full border-t border-[rgba(0,0,0,0.06)]">
                    <thead>
                      <tr>
                        <th className="text-left text-[10.5px] text-[#9CA3AF] font-medium uppercase tracking-[0.5px] px-4 py-2 bg-[#FAFAF6]">Description</th>
                        <th className="text-left text-[10.5px] text-[#9CA3AF] font-medium uppercase tracking-[0.5px] px-4 py-2 bg-[#FAFAF6]">Catégorie</th>
                        <th className="text-left text-[10.5px] text-[#9CA3AF] font-medium uppercase tracking-[0.5px] px-4 py-2 bg-[#FAFAF6]">Date</th>
                        <th className="text-right text-[10.5px] text-[#9CA3AF] font-medium uppercase tracking-[0.5px] px-4 py-2 bg-[#FAFAF6]">Montant HT</th>
                        <th className="text-right text-[10.5px] text-[#9CA3AF] font-medium uppercase tracking-[0.5px] px-4 py-2 bg-[#FAFAF6]">TVA ({`${data.expenses[0]?.tva_rate ?? 20}%`})</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.expenses.map((exp) => (
                        <tr key={exp.id} className="border-t border-[rgba(0,0,0,0.05)] hover:bg-[#FAFAF6]">
                          <td className="px-4 py-2.5 text-[12px] text-[#1A1A2E] max-w-[160px] truncate">{exp.description}</td>
                          <td className="px-4 py-2.5 text-[11.5px] text-[#6B7280]">{exp.category}</td>
                          <td className="px-4 py-2.5 text-[11.5px] text-[#6B7280]">
                            {new Date(exp.date).toLocaleDateString("fr-MA", { day: "2-digit", month: "2-digit" })}
                          </td>
                          <td className="px-4 py-2.5 text-[12px] text-right">{fmt(exp.amount)}</td>
                          <td className="px-4 py-2.5 text-[12px] text-right text-[#3B82F6]">{fmt(exp.tva_amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>

          {/* ─── Actions ───────────────────────────────────────────────── */}
          <div className="flex flex-wrap gap-2 mb-8">
            <button
              onClick={handleGeneratePDF}
              disabled={generatingPDF}
              className="btn btn-gold"
            >
              <FileText size={13} />
              {generatingPDF ? "Génération…" : "Générer la déclaration PDF"}
            </button>
            {!isFiled && (
              <button
                onClick={handleMarkFiled}
                disabled={filing}
                className="btn btn-outline"
              >
                <CheckCircle size={13} />
                {filing ? "Enregistrement…" : "Marquer comme déclarée"}
              </button>
            )}
            <button
              onClick={async () => {
                await handleGeneratePDF();
                window.open(`https://wa.me/?text=${encodeURIComponent(`Déclaration TVA ${periodLabel} — Voir pièce jointe générée par Mohasib`)}`);
              }}
              className="btn btn-outline"
            >
              <Send size={13} />
              Envoyer au fiduciaire
            </button>
          </div>
        </>
      )}

      {/* ─── Declaration History ──────────────────────────────────────── */}
      {history.length > 0 && (
        <div>
          <div className="text-[10.5px] font-semibold text-[#6B7280] uppercase tracking-[0.7px] mb-2.5 pl-2.5 border-l-[3px] border-[#C8924A] mt-7">
            Historique des déclarations
          </div>
          <div className="bg-white rounded-xl border border-[rgba(0,0,0,0.07)] overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left text-[10.5px] text-[#9CA3AF] font-medium uppercase tracking-[0.5px] px-4 py-3 bg-[#FAFAF6]">Période</th>
                  <th className="text-right text-[10.5px] text-[#9CA3AF] font-medium uppercase tracking-[0.5px] px-4 py-3 bg-[#FAFAF6]">TVA due</th>
                  <th className="text-left text-[10.5px] text-[#9CA3AF] font-medium uppercase tracking-[0.5px] px-4 py-3 bg-[#FAFAF6]">Statut</th>
                  <th className="text-left text-[10.5px] text-[#9CA3AF] font-medium uppercase tracking-[0.5px] px-4 py-3 bg-[#FAFAF6]">Déclarée le</th>
                </tr>
              </thead>
              <tbody>
                {history.map((decl) => (
                  <tr key={decl.id} className="border-t border-[rgba(0,0,0,0.05)] hover:bg-[#FAFAF6]">
                    <td className="px-4 py-3 text-[12.5px] font-medium text-[#1A1A2E]">{decl.period_label}</td>
                    <td className={`px-4 py-3 text-[12.5px] font-semibold text-right ${Number(decl.tva_nette) >= 0 ? "text-[#DC2626]" : "text-[#059669]"}`}>
                      {fmtMAD(Math.abs(Number(decl.tva_nette)))}
                    </td>
                    <td className="px-4 py-3">
                      {decl.status === "filed"
                        ? <span className="text-[11px] font-semibold text-[#065F46] bg-[#D1FAE5] px-2 py-0.5 rounded-full">✅ Déclarée</span>
                        : <span className="text-[11px] font-semibold text-[#6B7280] bg-[#F3F4F6] px-2 py-0.5 rounded-full">📝 En attente</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#6B7280]">
                      {decl.filed_at
                        ? new Date(decl.filed_at).toLocaleDateString("fr-MA", { day: "2-digit", month: "2-digit", year: "numeric" })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
