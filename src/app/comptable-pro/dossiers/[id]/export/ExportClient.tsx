"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { translateError } from "@/lib/errors";
import { taxIncludedInAmount } from "@/lib/tax";
import {
  AlertCircle, BookMarked, CalendarDays, CheckCircle, Download,
  FileSpreadsheet, FileText, History, Package, RefreshCw,
} from "lucide-react";

const now = new Date();
const DOCUMENTS = [
  { id: "sales-xlsx", label: "Journal des Ventes", format: "Excel", icon: FileSpreadsheet },
  { id: "sales-pdf", label: "Journal des Ventes", format: "PDF", icon: FileText },
  { id: "purchases-xlsx", label: "Journal des Achats", format: "Excel", icon: FileSpreadsheet },
  { id: "ledger-xlsx", label: "Grand Livre (CGNC)", format: "Excel", icon: FileSpreadsheet },
  { id: "balance-xlsx", label: "Balance Comptable", format: "Excel", icon: FileSpreadsheet },
  { id: "tva-pdf", label: "Récapitulatif TVA", format: "PDF", icon: FileText },
  { id: "summary-pdf", label: "Synthèse Financière", format: "PDF", icon: FileText },
] as const;

type DocumentId = typeof DOCUMENTS[number]["id"];
type HistoryItem = { date: string; periodLabel: string; filename: string };
type Stats = { invoiceCount: number; invoiceTotal: number; expenseCount: number; expenseTotal: number; tvaCollected: number; tvaDeductible: number };
interface Props { dossier: { id: string; raison_sociale: string } }

function fmt(value: number) {
  return value.toLocaleString("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("fr-FR");
}
const expenseTax = taxIncludedInAmount;
function quarterRange(quarter: number, year: number) {
  const month = (quarter - 1) * 3;
  const end = new Date(year, month + 3, 0);
  return {
    start: `${year}-${String(month + 1).padStart(2, "0")}-01`,
    end: `${year}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`,
  };
}
function monthRange() {
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    start: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`,
    end: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`,
  };
}

export default function ExportClient({ dossier }: Props) {
  const supabase = createClient();
  const [mode, setMode] = useState<"month" | "quarter" | "year" | "custom">("quarter");
  const [quarter, setQuarter] = useState(Math.ceil((now.getMonth() + 1) / 3));
  const [year, setYear] = useState(now.getFullYear());
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [selected, setSelected] = useState<Set<DocumentId>>(() => new Set(DOCUMENTS.map((doc) => doc.id)));
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const period = useMemo(() => {
    if (mode === "month") return monthRange();
    if (mode === "quarter") return quarterRange(quarter, year);
    if (mode === "year") return { start: `${year}-01-01`, end: `${year}-12-31` };
    return { start: customStart, end: customEnd };
  }, [mode, quarter, year, customStart, customEnd]);
  const periodLabel = mode === "quarter" ? `T${quarter}-${year}` : mode === "year" ? String(year)
    : mode === "month" ? new Date(`${period.start}T00:00:00`).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
    : period.start && period.end ? `${period.start}_${period.end}` : "Période";
  const safeDossier = dossier.raison_sociale.replace(/[^a-zA-Z0-9]/g, "_");
  const safePeriod = periodLabel.replace(/[^a-zA-Z0-9-]/g, "_");
  const zipName = `Mohasib_Export_${safeDossier}_${safePeriod}_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.zip`;
  const historyKey = `mohasib_dossier_export_history_${dossier.id}`;

  useEffect(() => {
    try { setHistory(JSON.parse(localStorage.getItem(historyKey) || "[]")); } catch {}
  }, [historyKey]);

  useEffect(() => {
    if (!period.start || !period.end) return;
    setDone(false);
    setError(null);
    fetchStats();
  }, [period.start, period.end, dossier.id]);

  async function fetchStats() {
    setLoadingStats(true);
    const [invoiceResult, transactionResult] = await Promise.all([
      supabase.from("invoices").select("total,tax_amount,status").eq("dossier_id", dossier.id).gte("issue_date", period.start).lte("issue_date", period.end),
      supabase.from("transactions").select("amount,type,tax_rate,tax_amount").eq("dossier_id", dossier.id).gte("date", period.start).lte("date", period.end),
    ]);
    const invoices = (invoiceResult.data ?? []).filter((invoice: any) => !["draft", "cancelled"].includes(invoice.status));
    const expenses = (transactionResult.data ?? []).filter((transaction: any) => transaction.type === "expense");
    setStats({
      invoiceCount: invoices.length,
      invoiceTotal: invoices.reduce((sum: number, invoice: any) => sum + Number(invoice.total || 0), 0),
      expenseCount: expenses.length,
      expenseTotal: expenses.reduce((sum: number, expense: any) => sum + Number(expense.amount || 0), 0),
      tvaCollected: invoices.reduce((sum: number, invoice: any) => sum + Number(invoice.tax_amount || 0), 0),
      tvaDeductible: expenses.reduce((sum: number, expense: any) => sum + expenseTax(expense), 0),
    });
    setLoadingStats(false);
  }

  function toggle(id: DocumentId) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setDone(false);
  }

  async function generatePackage() {
    if (!period.start || !period.end || selected.size === 0) return;
    setGenerating(true); setDone(false); setError(null); setProgress("Préparation des données...");
    try {
      const [invoiceResult, transactionResult, entryResult] = await Promise.all([
        supabase.from("invoices").select("*, clients(name,ice)").eq("dossier_id", dossier.id).gte("issue_date", period.start).lte("issue_date", period.end).order("issue_date"),
        supabase.from("transactions").select("*").eq("dossier_id", dossier.id).gte("date", period.start).lte("date", period.end).order("date"),
        supabase.from("dossier_ecritures").select("*").eq("dossier_id", dossier.id).gte("date", period.start).lte("date", period.end).order("date"),
      ]);
      if (invoiceResult.error) throw invoiceResult.error;
      if (transactionResult.error) throw transactionResult.error;
      if (entryResult.error) throw entryResult.error;

      const invoices = (invoiceResult.data ?? []).filter((invoice: any) => !["draft", "cancelled"].includes(invoice.status));
      const expenses = (transactionResult.data ?? []).filter((transaction: any) => transaction.type === "expense");
      const entries = entryResult.data ?? [];
      const XLSX = await import("xlsx");
      const { jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();

      const addSheet = (filename: string, sheetName: string, title: string, headers: string[], rows: any[][]) => {
        const sheet = XLSX.utils.aoa_to_sheet([[dossier.raison_sociale], [title], [], headers, ...rows]);
        sheet["!cols"] = headers.map(() => ({ wch: 22 }));
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
        zip.file(filename, XLSX.write(workbook, { bookType: "xlsx", type: "array" }));
      };
      const addHeader = (pdf: any, title: string) => {
        pdf.setFont("helvetica", "bold"); pdf.setFontSize(10); pdf.text(dossier.raison_sociale, 14, 18);
        pdf.setFontSize(15); pdf.text(title, pdf.internal.pageSize.width / 2, 26, { align: "center" });
        pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); pdf.setTextColor(100);
        pdf.text(`Période : ${periodLabel}`, pdf.internal.pageSize.width / 2, 33, { align: "center" });
      };
      const salesRows = invoices.map((invoice: any) => [
        fmtDate(invoice.issue_date), invoice.invoice_number, invoice.clients?.name ?? "—", invoice.clients?.ice ?? "—",
        Number(invoice.total || 0) - Number(invoice.tax_amount || 0), Number(invoice.tax_amount || 0), Number(invoice.total || 0), invoice.status,
      ]);
      const purchaseRows = expenses.map((expense: any) => [
        fmtDate(expense.date), expense.description, expense.category ?? "Autres", Number(expense.amount || 0) - expenseTax(expense),
        expenseTax(expense), Number(expense.amount || 0),
      ]);

      if (selected.has("sales-xlsx")) {
        setProgress("Journal des Ventes (Excel)");
        addSheet(`01_Journal_Ventes_${safePeriod}.xlsx`, "Journal des Ventes", `JOURNAL DES VENTES — ${periodLabel}`,
          ["Date", "N° Facture", "Client", "ICE", "HT", "TVA", "TTC", "Statut"], salesRows);
      }
      if (selected.has("sales-pdf")) {
        setProgress("Journal des Ventes (PDF)");
        const pdf = new jsPDF({ orientation: "landscape" }); addHeader(pdf, "JOURNAL DES VENTES");
        autoTable(pdf, { startY: 43, head: [["Date", "N° Facture", "Client", "ICE", "HT", "TVA", "TTC", "Statut"]], body: salesRows,
          headStyles: { fillColor: [13, 21, 38] }, styles: { fontSize: 8 } });
        zip.file(`02_Journal_Ventes_${safePeriod}.pdf`, pdf.output("arraybuffer"));
      }
      if (selected.has("purchases-xlsx")) {
        setProgress("Journal des Achats (Excel)");
        addSheet(`03_Journal_Achats_${safePeriod}.xlsx`, "Journal des Achats", `JOURNAL DES ACHATS — ${periodLabel}`,
          ["Date", "Description", "Catégorie", "HT estimé", "TVA estimée", "TTC"], purchaseRows);
      }

      const accountingRows = entries.map((entry: any) => [
        fmtDate(entry.date), entry.journal ?? "", entry.compte_cgnc ?? entry.numero_compte ?? entry.compte ?? "", entry.libelle ?? entry.description ?? "",
        Number(entry.debit || 0), Number(entry.credit || 0),
      ]);
      if (selected.has("ledger-xlsx")) {
        setProgress("Grand Livre (Excel)");
        addSheet(`04_Grand_Livre_${safePeriod}.xlsx`, "Grand Livre", `GRAND LIVRE — ${periodLabel}`,
          ["Date", "Journal", "Compte", "Libellé", "Débit", "Crédit"], accountingRows);
      }
      if (selected.has("balance-xlsx")) {
        setProgress("Balance Comptable (Excel)");
        const balance = new Map<string, { debit: number; credit: number }>();
        for (const row of accountingRows) {
          const account = String(row[2] || "Non affecté");
          const current = balance.get(account) ?? { debit: 0, credit: 0 };
          current.debit += Number(row[4] || 0); current.credit += Number(row[5] || 0); balance.set(account, current);
        }
        addSheet(`05_Balance_Comptable_${safePeriod}.xlsx`, "Balance", `BALANCE COMPTABLE — ${periodLabel}`,
          ["Compte", "Total débit", "Total crédit", "Solde"], [...balance].map(([account, value]) => [account, value.debit, value.credit, value.debit - value.credit]));
      }

      const tvaCollected = invoices.reduce((sum: number, invoice: any) => sum + Number(invoice.tax_amount || 0), 0);
      const tvaDeductible = expenses.reduce((sum: number, expense: any) => sum + expenseTax(expense), 0);
      if (selected.has("tva-pdf")) {
        setProgress("Récapitulatif TVA (PDF)");
        const pdf = new jsPDF(); addHeader(pdf, "RÉCAPITULATIF TVA");
        autoTable(pdf, { startY: 45, head: [["Indicateur", "Montant"]], body: [
          ["TVA collectée", `${fmt(tvaCollected)} MAD`], ["TVA déductible estimée", `${fmt(tvaDeductible)} MAD`],
          ["TVA nette due", `${fmt(tvaCollected - tvaDeductible)} MAD`],
        ], headStyles: { fillColor: [13, 21, 38] } });
        zip.file(`06_Recap_TVA_${safePeriod}.pdf`, pdf.output("arraybuffer"));
      }
      if (selected.has("summary-pdf")) {
        setProgress("Synthèse Financière (PDF)");
        const revenue = invoices.reduce((sum: number, invoice: any) => sum + Number(invoice.total || 0), 0);
        const expenseTotal = expenses.reduce((sum: number, expense: any) => sum + Number(expense.amount || 0), 0);
        const pdf = new jsPDF(); addHeader(pdf, "SYNTHÈSE FINANCIÈRE");
        autoTable(pdf, { startY: 45, head: [["Indicateur", "Valeur"]], body: [
          ["Chiffre d'affaires TTC", `${fmt(revenue)} MAD`], ["Charges TTC", `${fmt(expenseTotal)} MAD`],
          ["Résultat estimé", `${fmt(revenue - expenseTotal)} MAD`], ["Nombre de factures", invoices.length], ["Nombre de dépenses", expenses.length],
        ], headStyles: { fillColor: [13, 21, 38] } });
        zip.file(`07_Synthese_Financiere_${safePeriod}.pdf`, pdf.output("arraybuffer"));
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a"); link.href = url; link.download = zipName; link.click(); URL.revokeObjectURL(url);
      const nextHistory = [{ date: new Date().toISOString(), periodLabel, filename: zipName }, ...history].slice(0, 10);
      setHistory(nextHistory); localStorage.setItem(historyKey, JSON.stringify(nextHistory)); setDone(true);
    } catch (err: any) {
      setError(translateError(err));
    } finally {
      setGenerating(false); setProgress("");
    }
  }

  return (
    <div className="max-w-6xl">
      <div className="mb-5 flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[rgba(200,146,74,0.12)] text-[#C8924A]"><BookMarked size={18} /></div>
        <div><h1 className="text-[18px] font-bold leading-none text-[#1A1A2E]">Exports</h1><p className="mt-0.5 text-[11px] text-[#9CA3AF]">Exportez les données comptables de {dossier.raison_sociale}</p></div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="rounded-xl border border-[rgba(0,0,0,0.08)] bg-white p-5">
          <div className="mb-4 flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F3F4F6] text-[#6B7280]"><CalendarDays size={15} /></div><div><div className="text-[13px] font-semibold text-[#1A1A2E]">Période comptable</div><div className="text-[10.5px] text-[#9CA3AF]">Définissez la plage des données exportées</div></div></div>
          <div className="tabs mb-4">{(["month", "quarter", "year", "custom"] as const).map((item) => <button key={item} className={`tab ${mode === item ? "active" : ""}`} onClick={() => setMode(item)}>{item === "month" ? "Ce mois" : item === "quarter" ? "Trimestre" : item === "year" ? "Année" : "Personnalisé"}</button>)}</div>
          {mode === "quarter" && <div className="flex gap-3"><select className="input flex-1" value={quarter} onChange={(event) => setQuarter(Number(event.target.value))}>{[1, 2, 3, 4].map((item) => <option key={item} value={item}>T{item}</option>)}</select><select className="input w-28" value={year} onChange={(event) => setYear(Number(event.target.value))}>{[year - 2, year - 1, year, year + 1].map((item) => <option key={item}>{item}</option>)}</select></div>}
          {mode === "year" && <select className="input w-40" value={year} onChange={(event) => setYear(Number(event.target.value))}>{[year - 2, year - 1, year, year + 1].map((item) => <option key={item}>{item}</option>)}</select>}
          {mode === "custom" && <div className="flex items-center gap-3"><input type="date" className="input flex-1" value={customStart} onChange={(event) => setCustomStart(event.target.value)} /><span className="text-[12px] text-[#6B7280]">au</span><input type="date" className="input flex-1" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} /></div>}
          {period.start && period.end && <div className="mt-4 rounded-lg bg-[#F9F9F6] px-3 py-2.5 text-[11.5px] text-[#6B7280]"><strong className="text-[#1A1A2E]">{fmtDate(period.start)}</strong> → <strong className="text-[#1A1A2E]">{fmtDate(period.end)}</strong></div>}
        </section>

        <section className="rounded-xl border border-[rgba(0,0,0,0.08)] bg-white p-5">
          <div className="mb-3 flex items-center justify-between"><div className="text-[13px] font-semibold text-[#1A1A2E]">Aperçu de la période</div>{loadingStats && <RefreshCw size={13} className="animate-spin text-[#6B7280]" />}</div>
          {stats && stats.invoiceCount + stats.expenseCount > 0 ? <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[["Factures", stats.invoiceCount, stats.invoiceTotal], ["Dépenses", stats.expenseCount, stats.expenseTotal], ["TVA collectée", fmt(stats.tvaCollected), "MAD"], ["TVA nette due", fmt(Math.max(0, stats.tvaCollected - stats.tvaDeductible)), "MAD"]].map(([label, value, detail]) => <div className="kpi p-3" key={String(label)}><div className="kpi-label">{label}</div><div className="kpi-value text-[17px]">{value}</div><div className="text-[11px] text-[#6B7280]">{typeof detail === "number" ? `${fmt(detail)} MAD` : detail}</div></div>)}
          </div> : <div className="flex items-center gap-2 rounded-lg border border-[rgba(217,119,6,0.2)] bg-[#FEF3C7] px-3 py-2.5 text-[12px] text-[#92400E]"><AlertCircle size={13} /> {loadingStats ? "Chargement des données..." : "Aucune donnée pour cette période."}</div>}
          <div className="mt-3 flex items-center gap-2 text-[11px] text-[#6B7280]"><Package size={12} /> {selected.size} document{selected.size !== 1 ? "s" : ""} sélectionné{selected.size !== 1 ? "s" : ""}</div>
        </section>
      </div>

      <section className="mt-4 rounded-xl border border-[rgba(0,0,0,0.08)] bg-white p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><div className="text-[13px] font-semibold text-[#1A1A2E]">Documents inclus dans le package</div><div className="mt-0.5 text-[10.5px] text-[#9CA3AF]">Sélectionnez uniquement les fichiers dont vous avez besoin</div></div><div className="flex gap-2"><button onClick={() => setSelected(new Set(DOCUMENTS.map((doc) => doc.id)))} className="btn btn-sm border-[#E7D3B5] bg-[#FAF3E8] text-[#9A6528]">Tout sélectionner</button><button onClick={() => setSelected(new Set())} className="btn btn-sm border-[#D1D5DB] bg-[#F3F4F6] text-[#4B5563]">Effacer</button></div></div>
        <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">{DOCUMENTS.map((doc) => { const active = selected.has(doc.id); const Icon = doc.icon; return <button type="button" key={doc.id} onClick={() => toggle(doc.id)} className={`flex min-h-[68px] items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors ${active ? "border-[rgba(200,146,74,0.45)] bg-[#FFF7ED]" : "border-[rgba(0,0,0,0.16)] bg-[#FAFAF6] shadow-[0_1px_2px_rgba(13,21,38,0.05)] hover:bg-[#F0EDE5]"}`}><span className={`flex h-9 w-9 items-center justify-center rounded-lg ${active ? "bg-[#C8924A] text-white" : "bg-[#F3F4F6] text-[#6B7280]"}`}><Icon size={16} /></span><span className="min-w-0 flex-1"><span className="block text-[11.5px] font-semibold text-[#1A1A2E]">{doc.label}</span><span className="mt-0.5 block text-[10.5px] text-[#9CA3AF]">{doc.format}</span></span>{active && <CheckCircle size={15} className="text-[#C8924A]" />}</button>; })}</div>
        {generating && <div className="mb-4 flex items-center gap-2 rounded-lg bg-[#FAF3E8] px-3 py-2.5 text-[12px] text-[#9A6528]"><RefreshCw size={13} className="animate-spin" /> {progress}</div>}
        {done && <div className="mb-4 flex items-center gap-2 rounded-lg border border-[rgba(5,150,105,0.2)] bg-[#D1FAE5] px-3 py-2 text-[12.5px] text-[#059669]"><CheckCircle size={14} /> Package généré et téléchargé avec succès !</div>}
        {error && <div className="mb-4 flex items-center gap-2 rounded-lg border border-[rgba(220,38,38,0.2)] bg-[#FEE2E2] px-3 py-2 text-[12.5px] text-[#DC2626]"><AlertCircle size={14} /> {error}</div>}
        <button className="btn btn-gold w-full justify-center py-3 text-[14px] disabled:cursor-not-allowed disabled:opacity-50" onClick={generatePackage} disabled={generating || !period.start || !period.end || selected.size === 0}><Download size={16} /> {generating ? "Génération en cours..." : "Générer le package d'export"}</button>
        <div className="mt-2 truncate text-center text-[10.5px] text-[#6B7280]">{zipName}</div>
      </section>

      {history.length > 0 && <section className="mt-4 rounded-xl border border-[rgba(0,0,0,0.08)] bg-white p-5"><div className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-[#1A1A2E]"><History size={14} className="text-[#C8924A]" /> Historique des exports de ce dossier</div>{history.map((item, index) => <div key={index} className="flex items-center justify-between border-b border-[rgba(0,0,0,0.06)] py-2 text-[12px] last:border-0"><span className="font-medium text-[#1A1A2E]">{item.periodLabel} <span className="font-normal text-[#6B7280]">— {new Date(item.date).toLocaleDateString("fr-FR")}</span></span><span className="hidden max-w-[240px] truncate text-[10.5px] text-[#6B7280] md:block">{item.filename}</span></div>)}</section>}
    </div>
  );
}
