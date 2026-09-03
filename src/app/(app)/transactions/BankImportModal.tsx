"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { translateError } from "@/lib/errors";
import { BANK_STATEMENT_PDF_MAX_PAGES, countBankStatementPdfPages } from "@/lib/bank-import-limits";
import { AlertTriangle, Ban, Check, Clock3, Download, ExternalLink, FileSpreadsheet, FileText, Image as ImageIcon, Loader2, Search, Trash2, Upload, X, XCircle } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExtractedTx {
  _id: string;
  date: string;       // YYYY-MM-DD
  description: string;
  amount: number;     // positive = income, negative = expense
  category: string;
  reference: string | null;
  checked: boolean;
  isDuplicate: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  userId: string;
  dossierId?: string | null;
  onImported: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BANKS = [
  "Attijariwafa Bank", "CIH Bank", "BMCE Bank (Bank of Africa)",
  "BCP (Banque Populaire)", "Société Générale Maroc",
  "BMCI", "Al Barid Bank", "Autre",
];

const ALL_CATEGORIES = [
  "Ventes", "Services", "Remboursement", "Autre revenu",
  "Achats", "Salaires", "Loyer", "Fournitures",
  "Transport", "Communication", "Fiscalité", "Banque", "Autre dépense",
];

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ─── Client-side file validation helpers ─────────────────────────────────────

async function countCSVRows(f: File): Promise<number> {
  const text = await f.text();
  return Math.max(text.split("\n").filter((r) => r.trim().length > 0).length - 1, 0);
}

async function countExcelRows(f: File): Promise<number> {
  const XLSX = await import("xlsx");
  const buffer = await f.arrayBuffer();
  const wb = XLSX.read(buffer);
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws).length;
};

function fmt(n: number) {
  return Math.abs(n).toLocaleString("fr-MA", { minimumFractionDigits: 2 }) + " MAD";
}

function fmtElapsed(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function StatementPreview({ file, url }: { file: File | null; url: string | null }) {
  const isPdf = file?.type === "application/pdf" || file?.name.toLowerCase().endsWith(".pdf");
  const isImage = Boolean(file?.type.startsWith("image/"));

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-[#E5E7EB]" aria-label="Relevé bancaire original">
      <div className="flex h-10 flex-shrink-0 items-center justify-between border-b border-black/10 bg-[#F9FAFB] px-4">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.55px] text-[#6B7280]">Document original</span>
        {url && (
          <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-[#C8924A] hover:underline">
            <ExternalLink size={11} /> Ouvrir en plein écran
          </a>
        )}
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto">
        {!file || !url ? (
          <div className="p-8 text-center text-[12px] text-[#6B7280]">Aucun aperçu disponible</div>
        ) : isPdf ? (
          <iframe src={url} className="h-full min-h-[520px] w-full bg-white" title="Relevé bancaire PDF" />
        ) : isImage ? (
          <div className="flex min-h-full w-full items-start justify-center p-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="Relevé bancaire à vérifier" className="h-auto max-w-full bg-white shadow-lg" />
          </div>
        ) : (
          <div className="m-6 flex max-w-sm flex-col items-center rounded-xl border border-black/10 bg-white p-7 text-center shadow-sm">
            <FileSpreadsheet size={38} className="mb-3 text-[#C8924A]" />
            <p className="max-w-full truncate text-[13px] font-semibold text-[#1A1A2E]">{file.name}</p>
            <p className="mt-1 text-[11.5px] text-[#8A909B]">L’aperçu intégré n’est pas disponible pour ce format.</p>
            <a href={url} download={file.name} className="btn btn-outline mt-4 inline-flex items-center gap-1.5">
              <Download size={13} /> Télécharger le fichier
            </a>
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: number }) {
  const labels = ["Importation", "Analyse", "Vérification", "Terminé"];
  return (
    <div className="flex items-center gap-0 px-6 py-3 border-b border-[rgba(0,0,0,0.07)]">
      {labels.map((label, i) => {
        const n = i + 1;
        const done = step > n;
        const active = step === n;
        return (
          <div key={n} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-0.5">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                  done
                    ? "bg-[#0D1526] text-[#C8924A]"
                    : active
                    ? "bg-[#C8924A] text-white"
                    : "bg-[#F3F4F6] text-[#9CA3AF]"
                }`}
              >
                {done ? <Check size={10} /> : n}
              </div>
              <span className={`text-[9.5px] font-medium whitespace-nowrap ${active ? "text-[#C8924A]" : done ? "text-[#0D1526]" : "text-[#9CA3AF]"}`}>
                {label}
              </span>
            </div>
            {i < labels.length - 1 && (
              <div className={`h-[1.5px] flex-1 mx-1 mb-3.5 transition-all ${step > n ? "bg-[#C8924A]" : "bg-[#E5E7EB]"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function BankImportModal({ open, onClose, userId, dossierId, onImported }: Props) {
  const supabase = createClient();

  // Flow state
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [file, setFile] = useState<File | null>(null);
  const [bank, setBank] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState<{ used: number; limit: number; resetDate: string } | null>(null);

  // Processing
  const [analysisStartedAt, setAnalysisStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Review
  const [transactions, setTransactions] = useState<ExtractedTx[]>([]);
  const [period, setPeriod] = useState<string | null>(null);
  const [analysisUsage, setAnalysisUsage] = useState<{
    totalTokens: number;
    estimatedCostUsd: number;
  } | null>(null);
  const [filter, setFilter] = useState<"all" | "income" | "expense">("all");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [importing, setImporting] = useState(false);
  const [mobileReviewPane, setMobileReviewPane] = useState<"document" | "data">("document");
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);

  // Success
  const [importedStats, setImportedStats] = useState<{
    total: number; income: number; expense: number;
    incomeAmt: number; expenseAmt: number; skipped: number;
  } | null>(null);

  // Client-side file validation
  type FileValidation = {
    valid: boolean;
    type: "pdf" | "csv" | "xlsx" | "image";
    count: number;
    limit: number;
    sizeMB: string;
  };
  const [validating, setValidating] = useState(false);
  const [fileValidation, setFileValidation] = useState<FileValidation | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const analysisAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!file) {
      setFilePreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setFilePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (step !== 2 || analysisStartedAt === null) return;
    const updateElapsed = () => setElapsedSeconds(Math.floor((Date.now() - analysisStartedAt) / 1000));
    updateElapsed();
    const interval = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(interval);
  }, [step, analysisStartedAt]);

  // Reset when modal closes
  useEffect(() => {
    if (!open) {
      analysisAbortRef.current?.abort();
      analysisAbortRef.current = null;
      setTimeout(() => {
        setStep(1); setFile(null); setBank(""); setApiError(null);
        setAnalysisStartedAt(null); setElapsedSeconds(0); setTransactions([]); setPeriod(null); setAnalysisUsage(null);
        setFilter("all"); setSearch(""); setEditingId(null);
        setMobileReviewPane("document");
        setImportedStats(null); setFileValidation(null); setValidating(false); setLimitReached(null);
      }, 200);
    }
  }, [open]);

  // ── File handling ──────────────────────────────────────────────────────────

  const handleFile = useCallback(async (f: File) => {
    const name = f.name.toLowerCase();
    const isPDF = f.type === "application/pdf";
    const isImage = ["image/jpeg", "image/png", "image/webp", "image/jpg"].includes(f.type);
    const isXLSX = f.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || name.endsWith(".xlsx");
    const isXLS = f.type === "application/vnd.ms-excel" || name.endsWith(".xls");
    const isCSV = f.type === "text/csv" || f.type === "application/csv" || name.endsWith(".csv");

    if (!isPDF && !isImage && !isCSV && !isXLSX && !isXLS) {
      setApiError("Format non supporté. Utilisez PDF, CSV, Excel, JPG ou PNG.");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setApiError("Fichier trop volumineux. Maximum 10 MB.");
      return;
    }
    setApiError(null);
    setFile(f);
    setFileValidation(null);
    setValidating(true);
    try {
      const sizeMB = (f.size / 1024 / 1024).toFixed(1);
      if (isPDF) {
        const pages = countBankStatementPdfPages(await f.arrayBuffer());
        setFileValidation({ valid: pages <= BANK_STATEMENT_PDF_MAX_PAGES, type: "pdf", count: pages, limit: BANK_STATEMENT_PDF_MAX_PAGES, sizeMB });
      } else if (isXLSX || isXLS) {
        const rows = await countExcelRows(f);
        setFileValidation({ valid: rows <= 200, type: "xlsx", count: rows, limit: 200, sizeMB });
      } else if (isCSV) {
        const rows = await countCSVRows(f);
        setFileValidation({ valid: rows <= 200, type: "csv", count: rows, limit: 200, sizeMB });
      } else {
        setFileValidation({ valid: true, type: "image", count: 1, limit: 1, sizeMB });
      }
    } catch {
      // validation failed — allow through
      setFileValidation({ valid: true, type: isPDF ? "pdf" : "csv", count: 0, limit: isPDF ? BANK_STATEMENT_PDF_MAX_PAGES : 200, sizeMB: (f.size / 1024 / 1024).toFixed(1) });
    } finally {
      setValidating(false);
    }
  }, []);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  // ── Analyze ────────────────────────────────────────────────────────────────

  function closeModal() {
    analysisAbortRef.current?.abort();
    analysisAbortRef.current = null;
    onClose();
  }

  async function analyze() {
    if (!file) return;
    setStep(2);
    setApiError(null);
    setElapsedSeconds(0);
    setAnalysisStartedAt(Date.now());

    const fd = new FormData();
    fd.append("file", file);
    if (bank) fd.append("bank", bank);

    let res: Response;
    const controller = new AbortController();
    analysisAbortRef.current = controller;
    try {
      res = await fetch("/api/import/bank-statement", { method: "POST", body: fd, signal: controller.signal });
    } catch {
      if (controller.signal.aborted) return;
      setAnalysisStartedAt(null);
      setApiError("Connexion interrompue pendant l’analyse. Réessayez.");
      setStep(1);
      return;
    }
    analysisAbortRef.current = null;
    let result: any;
    try {
      result = await res.json();
    } catch {
      result = { error: "Erreur serveur inattendue. Réessayez." };
    }

    if (!res.ok || result.error) {
      if (result.error === "limit_reached") {
        setLimitReached({ used: result.used, limit: result.limit, resetDate: result.resetDate });
        setAnalysisStartedAt(null);
        await sleep(400);
        setStep(1);
        return;
      }
      setApiError(result.error || "Erreur d'analyse.");
      setAnalysisStartedAt(null);
      await sleep(600);
      setStep(1);
      return;
    }

    await sleep(700);
    await sleep(500);

    // Fetch existing transactions to detect duplicates
    const dupQuery = supabase.from("transactions").select("date, amount, type");
    const { data: existing } = await (dossierId
      ? dupQuery.eq("dossier_id", dossierId)
      : dupQuery.eq("user_id", userId));

    const existingSet = new Set(
      (existing ?? []).map((t: any) => {
        const signed = t.type === "income" ? Number(t.amount) : -Number(t.amount);
        return `${t.date}|${signed}`;
      })
    );

    const txs: ExtractedTx[] = (result.transactions as any[]).map((t, i) => {
      const amt = Number(t.amount ?? 0);
      const key = `${t.date}|${amt}`;
      const isDup = existingSet.has(key);
      return {
        _id: `${i}-${t.date}-${t.amount}-${Math.random().toString(36).slice(2, 6)}`,
        date: t.date,
        description: t.description,
        amount: amt,
        category: t.category,
        reference: t.reference ?? null,
        checked: !isDup,
        isDuplicate: isDup,
      };
    });

    setTransactions(txs);
    setPeriod(result.period ?? null);
    setAnalysisUsage(result.processing ? {
      totalTokens: Number(result.processing.total_tokens ?? 0),
      estimatedCostUsd: Number(result.processing.estimated_cost_usd ?? 0),
    } : null);
    setAnalysisStartedAt(null);
    setMobileReviewPane("document");
    setStep(3);
  }

  // ── Review helpers ─────────────────────────────────────────────────────────

  function toggleAll(checked: boolean) {
    setTransactions((prev) =>
      prev.map((t) => (t.isDuplicate ? t : { ...t, checked }))
    );
  }

  function toggleOne(id: string) {
    setTransactions((prev) =>
      prev.map((t) => (t._id === id ? { ...t, checked: !t.checked } : t))
    );
  }

  function deleteRow(id: string) {
    setTransactions((prev) => prev.filter((t) => t._id !== id));
  }

  function updateField(id: string, field: "date" | "description" | "category" | "reference", value: string) {
    setTransactions((prev) =>
      prev.map((t) => (t._id === id ? { ...t, [field]: value } : t))
    );
  }

  function updateAmount(id: string, value: string) {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return;
    setTransactions((prev) => prev.map((t) => (t._id === id ? { ...t, amount } : t)));
  }

  function startEdit(id: string, value: string) {
    setEditingId(id);
    setEditingValue(value);
  }

  function commitEdit(id: string) {
    if (editingId === id) {
      updateField(id, "description", editingValue.trim() || "Transaction");
      setEditingId(null);
    }
  }

  // Filtered view
  const filteredTxs = transactions.filter((t) => {
    const matchType =
      filter === "all" ||
      (filter === "income" && t.amount >= 0) ||
      (filter === "expense" && t.amount < 0);
    const matchSearch =
      !search || t.description.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  const selectedTxs = transactions.filter((t) => t.checked);
  const dupCount = transactions.filter((t) => t.isDuplicate).length;

  const totalIncome = selectedTxs.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalExpense = selectedTxs.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

  // ── Import ─────────────────────────────────────────────────────────────────

  async function doImport() {
    if (selectedTxs.length === 0 || !file) return;
    setImporting(true);

    const rows = selectedTxs.map((t) => ({
      user_id: userId,
      ...(dossierId ? { dossier_id: dossierId } : {}),
      type: t.amount >= 0 ? "income" : "expense",
      description: t.description,
      amount: Math.abs(t.amount),
      date: t.date,
      category: t.category || null,
      currency: "MAD",
      source: "bank_import",
      bank_reference: t.reference || null,
    }));

    let { error } = await supabase.from("transactions").insert(rows);

    // Graceful fallback: if new columns don't exist, retry without them
    if (error && (error.message.includes("source") || error.message.includes("bank_reference"))) {
      const simpleRows = rows.map((row) => Object.fromEntries(
        Object.entries(row).filter(([key]) => key !== "source" && key !== "bank_reference"),
      ));
      ({ error } = await supabase.from("transactions").insert(simpleRows));
    }

    if (error) {
      setImporting(false);
      toast.error(translateError(error), { duration: 8000 });
      return;
    }

    // Keep the original statement alongside the generated transactions.
    const archiveForm = new FormData();
    archiveForm.set("file", file);
    archiveForm.set("category", "Relevé bancaire");
    archiveForm.set("notes", period ? `Période : ${period}` : "");
    if (dossierId) archiveForm.set("dossierId", dossierId);

    let archiveError: string | null = null;
    try {
      const archiveResponse = await fetch("/api/archive/documents", {
        method: "POST",
        body: archiveForm,
      });
      if (!archiveResponse.ok) {
        const archiveResult = await archiveResponse.json().catch(() => ({}));
        archiveError = archiveResult.error || "Archivage du relevé impossible.";
      }
    } catch {
      archiveError = "Archivage du relevé impossible.";
    }

    const income = selectedTxs.filter((t) => t.amount > 0);
    const expense = selectedTxs.filter((t) => t.amount < 0);
    setImportedStats({
      total: selectedTxs.length,
      income: income.length,
      expense: expense.length,
      incomeAmt: income.reduce((s, t) => s + t.amount, 0),
      expenseAmt: expense.reduce((s, t) => s + Math.abs(t.amount), 0),
      skipped: transactions.length - selectedTxs.length,
    });
    if (dossierId) {
      await supabase.from("dossiers").update({ derniere_ecriture: new Date().toISOString() }).eq("id", dossierId);
    }
    setImporting(false);
    setStep(4);
    onImported();
    if (archiveError) {
      toast.error(`Transactions importées, mais ${archiveError.toLowerCase()}`, { duration: 8000 });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ backgroundColor: "rgba(13,21,38,0.6)", backdropFilter: "blur(4px)" }}
    >
      <div className={`flex h-[100dvh] w-full flex-col bg-white shadow-2xl ${step === 2 || step === 3 ? "" : "sm:h-[min(92vh,920px)] sm:max-w-[920px] sm:rounded-xl"}`}>

        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-[rgba(0,0,0,0.08)] px-4 py-3 sm:px-6 sm:py-4">
          <div>
            <h2 className="text-[14px] font-semibold text-[#1A1A2E]">
              Importer un relevé bancaire
            </h2>
            {period && step >= 3 && (
              <p className="text-[11.5px] text-[#C8924A] font-medium mt-0.5">{period}</p>
            )}
          </div>
          <button
            onClick={closeModal}
            className="text-[#6B7280] transition-colors hover:text-[#1A1A2E]"
            aria-label={step === 2 ? "Annuler l’analyse et fermer" : "Fermer"}
            title={step === 2 ? "Annuler l’analyse et fermer" : "Fermer"}
          >
            <X size={16} />
          </button>
        </div>

        {/* Step indicator */}
        <StepIndicator step={step} />

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">

          {/* ── STEP 1: Upload ────────────────────────────────────────────── */}
          {step === 1 && (
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6">

              {/* Hidden file input — single instance */}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.csv,.xlsx,.xls,image/jpeg,image/png,image/jpg,image/webp"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) { handleFile(f); e.target.value = ""; } }}
              />

              {/* Limits info — always visible */}
              <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg px-4 py-3 text-[#1E40AF]">
                <p className="text-[12.5px] font-semibold mb-1">Formats acceptés :</p>
                <ul className="text-[12px] flex flex-col gap-0.5">
                  <li className="flex items-center gap-1.5"><FileText size={13} /> PDF — maximum {BANK_STATEMENT_PDF_MAX_PAGES} pages</li>
                  <li className="flex items-center gap-1.5"><FileSpreadsheet size={13} /> CSV / Excel — maximum 200 lignes</li>
                  <li className="flex items-center gap-1.5"><ImageIcon size={13} /> Image (JPG, PNG) — 1 page max</li>
                </ul>
              </div>

              {/* Drop zone / validation states */}
              {!file || validating ? (
                <div
                  className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${
                    dragOver
                      ? "border-[#C8924A] bg-[rgba(200,146,74,0.06)]"
                      : "border-[rgba(0,0,0,0.15)] hover:border-[#C8924A] hover:bg-[rgba(200,146,74,0.03)]"
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                >
                  {validating ? (
                    <>
                      <Loader2 size={22} className="animate-spin text-[#C8924A]" />
                      <p className="text-[12.5px] text-[#6B7280]">Vérification du fichier...</p>
                    </>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-full bg-[#F3F4F6] flex items-center justify-center">
                        <Upload size={22} className="text-[#9CA3AF]" />
                      </div>
                      <div className="text-center">
                        <p className="text-[13px] font-medium text-[#1A1A2E]">Glissez votre relevé bancaire ici</p>
                        <p className="text-[12px] text-[#6B7280]">ou cliquez pour sélectionner</p>
                      </div>
                    </>
                  )}
                </div>
              ) : fileValidation && !fileValidation.valid ? (
                /* REJECTED */
                <div className="border border-[#FECACA] bg-[#FEF2F2] rounded-xl p-5 flex flex-col gap-3">
                  <p className="text-[13px] font-semibold text-[#DC2626] flex items-center gap-1.5"><XCircle size={14} /> Fichier trop volumineux</p>
                  <p className="text-[12px] font-medium text-[#374151]">{file.name}</p>
                  <p className="text-[12px] text-[#DC2626]">
                    {fileValidation.type === "pdf"
                      ? `Pages détectées : ${fileValidation.count} (limite : ${fileValidation.limit})`
                      : `Lignes détectées : ${fileValidation.count.toLocaleString("fr-MA")} (limite : ${fileValidation.limit})`}
                  </p>
                  <div className="text-[12px] text-[#374151] flex flex-col gap-1.5">
                    <p className="font-medium">Comment résoudre :</p>
                    {fileValidation.type === "pdf" ? (
                      <>
                        <p>• Divisez le PDF sur{" "}
                          <a href="https://smallpdf.com/split-pdf" target="_blank" rel="noopener noreferrer" className="text-[#C8924A] underline">smallpdf.com</a>
                        </p>
                        <a href="https://smallpdf.com/split-pdf" target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[12px] text-[#C8924A] border border-[#C8924A] rounded-lg px-3 py-1.5 w-fit hover:bg-[rgba(200,146,74,0.05)] transition-colors">
                          <ExternalLink size={13} /> Ouvrir smallpdf.com
                        </a>
                      </>
                    ) : (
                      <p>• Filtrez les dates dans Excel pour garder seulement 3 mois de transactions.</p>
                    )}
                  </div>
                  <button
                    onClick={() => { setFile(null); setFileValidation(null); fileInputRef.current?.click(); }}
                    className="text-[12px] text-[#C8924A] border border-[#C8924A] rounded-lg px-4 py-2 w-fit hover:bg-[rgba(200,146,74,0.05)] transition-colors"
                  >
                    ← Choisir un autre fichier
                  </button>
                </div>
              ) : fileValidation?.valid ? (
                /* VALID */
                <div className="border border-[#A7F3D0] bg-[#F0FDF4] rounded-xl p-5 flex flex-col gap-2">
                  <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[#065F46]">
                    <Check size={14} aria-hidden="true" /> Fichier valide
                  </p>
                  <p className="text-[12.5px] font-medium text-[#374151]">{file.name}</p>
                  <p className="text-[12px] text-[#6B7280]">
                    {fileValidation.type === "pdf"
                      ? `Pages : ${fileValidation.count} / ${fileValidation.limit}`
                      : fileValidation.type === "image"
                      ? "Image — 1 page"
                      : `Lignes : ${fileValidation.count.toLocaleString("fr-MA")} / ${fileValidation.limit}`}
                    {" · "}{fileValidation.sizeMB} MB
                  </p>
                  <button
                    onClick={() => { setFile(null); setFileValidation(null); fileInputRef.current?.click(); }}
                    className="text-[11px] text-[#6B7280] hover:text-[#374151] w-fit transition-colors mt-0.5"
                  >
                    ← Choisir un autre fichier
                  </button>
                </div>
              ) : null}

              {/* Bank selector */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-medium text-[#6B7280]">
                  Votre banque <span className="text-[#9CA3AF] font-normal">(optionnel — aide l'IA)</span>
                </label>
                <select
                  className="input max-w-xs"
                  value={bank}
                  onChange={(e) => setBank(e.target.value)}
                >
                  <option value="">Sélectionner votre banque...</option>
                  {BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>

              {apiError && (
                <div className="bg-[#FEE2E2] border border-[#FECACA] rounded-lg px-4 py-3 text-[12.5px] text-[#DC2626] flex items-center gap-1.5">
                  <XCircle size={14} /> {apiError}
                </div>
              )}

              <div className="mt-auto flex justify-end">
                <button
                  onClick={analyze}
                  disabled={!file || validating || !fileValidation?.valid}
                  className="btn btn-gold px-6 disabled:opacity-50"
                >
                  {fileValidation && !fileValidation.valid
                    ? "Fichier trop volumineux"
                    : "Extraire les transactions →"}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 2: Processing ────────────────────────────────────────── */}
          {step === 2 && (
            <div className="grid min-h-0 flex-1 md:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
              <div className="hidden min-h-0 md:flex md:flex-col">
                <StatementPreview file={file} url={filePreviewUrl} />
              </div>

              <section className="flex min-h-0 flex-col items-center justify-center overflow-y-auto border-l border-black/10 bg-[#F5F5F2] p-6 sm:p-10" aria-live="polite" aria-label="Progression de l’analyse IA">
                <div className="w-full max-w-lg overflow-hidden rounded-xl border border-black/10 bg-white shadow-[0_12px_35px_rgba(13,21,38,0.08)]">
                  <div className="h-1 bg-[#10B981]" aria-hidden="true" />
                  <div className="p-6 sm:p-7">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.65px] text-[#047857]">
                        <span className="h-2 w-2 rounded-full bg-[#10B981]" /> Analyse active
                      </div>
                      <div className="flex items-center gap-1.5 rounded-md border border-black/10 bg-[#FAFAFA] px-2.5 py-1.5 font-mono text-[12px] font-semibold text-[#374151]">
                        <Clock3 size={13} /> {fmtElapsed(elapsedSeconds)}
                      </div>
                    </div>

                    <h3 className="mt-5 text-[18px] font-semibold tracking-[-0.2px] text-[#1A1A2E]">
                      Lecture de votre relevé bancaire
                    </h3>
                    <p className="mt-1.5 text-[12px] leading-5 text-[#6B7280]">
                      Nous extrayons les opérations, contrôlons les montants et proposons une catégorie pour chaque ligne.
                    </p>

                    <div className="mt-5 flex items-center gap-3 rounded-lg border border-black/10 bg-[#FAFAF8] px-3.5 py-3">
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-black/10 bg-white text-[#6B7280]">
                        <FileText size={17} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-semibold text-[#1A1A2E]">{file?.name ?? "Relevé bancaire"}</p>
                        <p className="mt-0.5 text-[10.5px] text-[#8A909B]">
                          {fileValidation?.type === "pdf" && fileValidation.count > 0
                            ? `${fileValidation.count} pages · ${Math.ceil(fileValidation.count / 4)} groupes d’analyse`
                            : fileValidation?.type === "image"
                            ? "Image · 1 page"
                            : fileValidation ? `${fileValidation.count.toLocaleString("fr-MA")} ligne${fileValidation.count > 1 ? "s" : ""}` : "Document en cours de lecture"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 divide-y divide-black/5 border-y border-black/5">
                      <div className="flex items-center gap-3 py-3.5 text-[13px] font-semibold text-[#374151]">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#ECFDF5] text-[#059669]"><Check size={12} /></span>
                        <span>Fichier reçu</span>
                        <span className="ml-auto text-[11px] font-bold text-[#059669]">Terminé</span>
                      </div>
                      <div className="flex items-center gap-3 py-3.5 text-[13px] font-semibold text-[#1A1A2E]">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#FFF7ED] text-[#B7791F]"><Loader2 size={12} className="animate-spin" /></span>
                        <span>
                          {elapsedSeconds < 30
                            ? "Préparation et lecture du document"
                            : elapsedSeconds < 180
                            ? "Extraction et catégorisation"
                            : "Analyse détaillée des opérations"}
                        </span>
                        <span className="ml-auto text-[11px] font-bold text-[#B7791F]">En cours</span>
                      </div>
                      <div className="flex items-center gap-3 py-3.5 text-[13px] font-semibold text-[#8A909B]">
                        <span className="h-5 w-5 rounded-full border border-[#D1D5DB]" />
                        <span>Vérification des transactions</span>
                        <span className="ml-auto text-[11px] font-bold">À suivre</span>
                      </div>
                    </div>

                    <p className="mt-5 text-[11px] leading-5 text-[#7C838D]">
                      {fileValidation?.type === "pdf" && fileValidation.count > 4
                        ? "Les relevés longs peuvent prendre jusqu’à 10 minutes. Gardez cette fenêtre ouverte; le résultat s’affichera automatiquement."
                        : "Gardez cette fenêtre ouverte; le résultat s’affichera automatiquement dès que l’analyse sera terminée."}
                    </p>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* ── STEP 3: Review ────────────────────────────────────────────── */}
          {step === 3 && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="grid grid-cols-2 border-b border-black/10 bg-white p-1 md:hidden">
                {(["document", "data"] as const).map((pane) => (
                  <button
                    key={pane}
                    type="button"
                    onClick={() => setMobileReviewPane(pane)}
                    aria-pressed={mobileReviewPane === pane}
                    className={`min-h-10 rounded-md text-[12px] font-semibold transition-colors ${mobileReviewPane === pane ? "bg-[#0D1526] text-white" : "text-[#6B7280]"}`}
                  >
                    {pane === "document" ? "Document" : `Transactions (${transactions.length})`}
                  </button>
                ))}
              </div>

              <div className="grid min-h-0 flex-1 md:grid-cols-[minmax(360px,0.9fr)_minmax(620px,1.35fr)]">
                <div className={`${mobileReviewPane === "document" ? "flex" : "hidden"} min-h-0 flex-col md:flex`}>
                  <StatementPreview file={file} url={filePreviewUrl} />
                </div>

                <section className={`${mobileReviewPane === "data" ? "flex" : "hidden"} min-h-0 flex-col border-l border-black/10 bg-white md:flex`} aria-label="Transactions extraites à vérifier">
              {/* Summary header */}
              <div className="px-5 py-3 bg-[#FAFAF6] border-b border-[rgba(0,0,0,0.07)] flex-shrink-0">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]">
                  <span className="font-semibold text-[#1A1A2E]">
                    {transactions.length} transactions extraites
                  </span>
                  <span className="text-[#DC2626]">
                    {transactions.filter((t) => t.amount < 0).length} dépenses
                    {" "}(−{fmt(transactions.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0))})
                  </span>
                  <span className="text-[#059669]">
                    {transactions.filter((t) => t.amount > 0).length} revenus
                    {" "}(+{fmt(transactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0))})
                  </span>
                  <span className="ml-auto font-medium text-[#C8924A]">
                    {selectedTxs.length} sélectionnées
                  </span>
                </div>
              </div>

              {/* Duplicate warning */}
              {dupCount > 0 && (
                <div className="mx-5 mt-3 flex-shrink-0 bg-[#FEF3C7] border border-[#FDE68A] rounded-lg px-3.5 py-2.5 text-[12px] text-[#92400E] flex items-center gap-1.5">
                  <AlertTriangle size={14} className="flex-shrink-0" /> {dupCount} transaction{dupCount > 1 ? "s semblent" : " semble"} déjà exister dans votre journal — décochée{dupCount > 1 ? "s" : ""} automatiquement.
                </div>
              )}

              {/* Toolbar */}
              <div className="px-5 py-2.5 flex flex-wrap items-center gap-2 flex-shrink-0 border-b border-[rgba(0,0,0,0.06)]">
                <div className="relative flex-1 max-w-[260px]">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                  <input
                    className="input pl-7 py-1.5 text-[12px]"
                    placeholder="Rechercher..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-1 overflow-hidden rounded-full bg-[#F3F4F6] p-1" role="group" aria-label="Filtrer les transactions">
                  {(["all", "income", "expense"] as const).map((f) => {
                    const count = f === "all"
                      ? transactions.length
                      : transactions.filter((tx) => f === "income" ? tx.amount >= 0 : tx.amount < 0).length;
                    const activeClass = f === "all"
                      ? "bg-white text-[#1A1A2E] shadow-sm ring-1 ring-black/5"
                      : f === "income"
                      ? "bg-[#ECFDF5] text-[#047857] shadow-sm ring-1 ring-[#A7F3D0]"
                      : "bg-[#FEF2F2] text-[#B91C1C] shadow-sm ring-1 ring-[#FECACA]";
                    return (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFilter(f)}
                      aria-pressed={filter === f}
                      className={`flex min-h-8 items-center gap-1.5 rounded-full px-3 text-[11.5px] font-semibold transition-all ${filter === f ? activeClass : "text-[#6B7280] hover:bg-white/80 hover:text-[#374151]"}`}
                    >
                      <span>{f === "all" ? "Tous" : f === "income" ? "Revenus" : "Dépenses"}</span>
                      <span className={`rounded-full px-1.5 py-0.5 text-[9.5px] leading-none ${filter === f ? "bg-white/70" : "bg-white text-[#8A909B]"}`}>
                        {count.toLocaleString("fr-MA")}
                      </span>
                    </button>
                    );
                  })}
                </div>
                <div className="ml-auto flex gap-2">
                  <button
                    onClick={() => toggleAll(true)}
                    className="text-[11px] text-[#6B7280] hover:text-[#C8924A]"
                  >
                    Tout sélectionner
                  </button>
                  <span className="text-[#E5E7EB]">|</span>
                  <button
                    onClick={() => toggleAll(false)}
                    className="text-[11px] text-[#6B7280] hover:text-[#1A1A2E]"
                  >
                    Tout désélectionner
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="flex-1 overflow-auto">
                <table className="w-full min-w-[850px] text-[12px]">
                  <thead className="sticky top-0 bg-white border-b border-[rgba(0,0,0,0.07)] z-10">
                    <tr>
                      <th className="w-8 px-3 py-2.5"></th>
                      <th className="px-3 py-2.5 text-left text-[10.5px] font-semibold text-[#6B7280] uppercase tracking-[0.4px] w-24">Date</th>
                      <th className="px-3 py-2.5 text-left text-[10.5px] font-semibold text-[#6B7280] uppercase tracking-[0.4px]">Description</th>
                      <th className="px-3 py-2.5 text-left text-[10.5px] font-semibold text-[#6B7280] uppercase tracking-[0.4px] w-40">Catégorie</th>
                      <th className="px-3 py-2.5 text-left text-[10.5px] font-semibold text-[#6B7280] uppercase tracking-[0.4px] w-28">Référence</th>
                      <th className="px-3 py-2.5 text-right text-[10.5px] font-semibold text-[#6B7280] uppercase tracking-[0.4px] w-32">Montant</th>
                      <th className="w-8 px-2 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTxs.map((tx) => (
                      <tr
                        key={tx._id}
                        className={`border-b border-[rgba(0,0,0,0.04)] transition-colors ${
                          !tx.checked ? "opacity-50 bg-[#FAFAFA]" : "hover:bg-[#FAFAF6]"
                        } ${tx.isDuplicate ? "bg-[#FFFBEB]" : ""}`}
                      >
                        {/* Checkbox */}
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={tx.checked}
                            onChange={() => toggleOne(tx._id)}
                            className="w-3.5 h-3.5 accent-[#C8924A]"
                          />
                        </td>

                        {/* Date */}
                        <td className="px-3 py-2 text-[#6B7280] whitespace-nowrap">
                          <input
                            type="date"
                            value={tx.date}
                            onChange={(e) => updateField(tx._id, "date", e.target.value)}
                            className="w-[116px] rounded border border-transparent bg-transparent px-1 py-1 text-[11px] outline-none hover:border-black/10 focus:border-[#C8924A] focus:bg-white"
                            aria-label={`Date de ${tx.description}`}
                          />
                          {tx.isDuplicate && (
                            <span className="ml-1 text-[#D97706]" title="Transaction déjà importée"><AlertTriangle size={10} /></span>
                          )}
                        </td>

                        {/* Description (inline edit) */}
                        <td className="px-3 py-2 max-w-[240px]">
                          {editingId === tx._id ? (
                            <input
                              autoFocus
                              className="input py-0.5 text-[12px] w-full"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onBlur={() => commitEdit(tx._id)}
                              onKeyDown={(e) => { if (e.key === "Enter") commitEdit(tx._id); }}
                            />
                          ) : (
                            <span
                              className="cursor-text hover:underline hover:decoration-dashed hover:underline-offset-2 truncate block"
                              title={tx.description}
                              onClick={() => startEdit(tx._id, tx.description)}
                            >
                              {tx.description}
                            </span>
                          )}
                        </td>

                        {/* Category dropdown */}
                        <td className="px-3 py-2">
                          <select
                            className="input py-0.5 text-[11.5px] w-full"
                            value={tx.category}
                            onChange={(e) => updateField(tx._id, "category", e.target.value)}
                          >
                            {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </td>

                        {/* Bank reference */}
                        <td className="px-3 py-2">
                          <input
                            value={tx.reference ?? ""}
                            onChange={(e) => updateField(tx._id, "reference", e.target.value)}
                            placeholder="—"
                            className="w-full rounded border border-transparent bg-transparent px-1 py-1 text-[11px] text-[#6B7280] outline-none hover:border-black/10 focus:border-[#C8924A] focus:bg-white"
                            aria-label={`Référence de ${tx.description}`}
                          />
                        </td>

                        {/* Amount */}
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <input
                            type="number"
                            step="0.01"
                            value={tx.amount}
                            onChange={(e) => updateAmount(tx._id, e.target.value)}
                            className={`w-[112px] rounded border border-transparent bg-transparent px-1 py-1 text-right text-[11.5px] font-semibold outline-none hover:border-black/10 focus:border-[#C8924A] focus:bg-white ${tx.amount >= 0 ? "text-[#059669]" : "text-[#DC2626]"}`}
                            aria-label={`Montant de ${tx.description}`}
                          />
                        </td>

                        {/* Delete */}
                        <td className="px-2 py-2">
                          <button
                            onClick={() => deleteRow(tx._id)}
                            className="w-6 h-6 flex items-center justify-center rounded text-[#9CA3AF] hover:text-[#DC2626] hover:bg-[#FEE2E2] transition-colors"
                          >
                            <Trash2 size={11} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredTxs.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-[#9CA3AF] text-[12px]">
                          Aucune transaction correspondante
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Bottom bar */}
              <div className="px-4 py-3.5 border-t border-[rgba(0,0,0,0.08)] flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between flex-shrink-0 bg-white sm:px-5">
                <div className="text-[12px] text-[#6B7280]">
                  Sélection: <span className="font-semibold text-[#1A1A2E]">{selectedTxs.length}</span> transaction{selectedTxs.length !== 1 ? "s" : ""}
                  {selectedTxs.length > 0 && (
                    <span className="ml-2 text-[11.5px]">
                      <span className="text-[#059669]">+{fmt(totalIncome)}</span>
                      {" · "}
                      <span className="text-[#DC2626]">−{fmt(totalExpense)}</span>
                    </span>
                  )}
                </div>
                <div className="flex gap-2 sm:justify-end">
                  <button onClick={() => setStep(1)} className="btn btn-outline">
                    ← Retour
                  </button>
                  <button
                    onClick={doImport}
                    disabled={selectedTxs.length === 0 || importing}
                    className="btn btn-gold disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {importing
                      ? <><Loader2 size={13} className="animate-spin" /> Importation...</>
                      : `Importer ${selectedTxs.length} transaction${selectedTxs.length !== 1 ? "s" : ""} →`
                    }
                  </button>
                </div>
              </div>
                </section>
              </div>
            </div>
          )}

          {/* ── STEP 4: Success ───────────────────────────────────────────── */}
          {step === 4 && importedStats && (
            <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
              <div className="w-16 h-16 rounded-full bg-[#D1FAE5] flex items-center justify-center text-[#059669]">
                <Check size={28} strokeWidth={2.4} aria-hidden="true" />
              </div>

              <div className="text-center">
                <p className="text-[16px] font-bold text-[#1A1A2E]">
                  {importedStats.total} transactions importées avec succès !
                </p>
                <p className="mt-1 text-[11.5px] text-[#6B7280]">Confirmez chaque transaction dans la liste avant de créer son écriture comptable.</p>
                {period && <p className="text-[12.5px] text-[#C8924A] font-medium mt-1">{period}</p>}
                {analysisUsage && (
                  <p className="mt-1 text-[10.5px] text-[#9CA3AF]">
                    Analyse IA : {analysisUsage.totalTokens.toLocaleString("fr-MA")} jetons · coût estimé ${analysisUsage.estimatedCostUsd.toFixed(2)} USD
                  </p>
                )}
              </div>

              <div className="bg-[#FAFAF6] rounded-xl border border-[rgba(0,0,0,0.08)] p-5 w-full max-w-sm flex flex-col gap-2.5">
                <div className="flex justify-between text-[12.5px]">
                  <span className="text-[#6B7280]">Dépenses</span>
                  <span className="font-medium">
                    {importedStats.expense} transactions
                    <span className="text-[#DC2626] ml-1.5">−{fmt(importedStats.expenseAmt)}</span>
                  </span>
                </div>
                <div className="flex justify-between text-[12.5px]">
                  <span className="text-[#6B7280]">Revenus</span>
                  <span className="font-medium">
                    {importedStats.income} transactions
                    <span className="text-[#059669] ml-1.5">+{fmt(importedStats.incomeAmt)}</span>
                  </span>
                </div>
                {importedStats.skipped > 0 && (
                  <div className="flex justify-between text-[12.5px]">
                    <span className="text-[#6B7280]">Ignorées</span>
                    <span className="text-[#9CA3AF]">{importedStats.skipped} (doublons / décochées)</span>
                  </div>
                )}
                <div className="border-t border-[rgba(0,0,0,0.08)] pt-2.5 flex justify-between text-[12.5px]">
                  <span className="font-semibold text-[#1A1A2E]">Solde net importé</span>
                  <span className={`font-bold ${importedStats.incomeAmt - importedStats.expenseAmt >= 0 ? "text-[#059669]" : "text-[#DC2626]"}`}>
                    {importedStats.incomeAmt - importedStats.expenseAmt >= 0 ? "+" : "−"}
                    {fmt(Math.abs(importedStats.incomeAmt - importedStats.expenseAmt))}
                  </span>
                </div>
              </div>

              <button
                onClick={closeModal}
                className="btn btn-gold px-8"
              >
                Voir les transactions →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Limit-reached overlay */}
      {limitReached && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ backgroundColor: "rgba(13,21,38,0.7)" }}>
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full flex flex-col gap-4">
            <div className="w-12 h-12 rounded-full bg-[#FEE2E2] flex items-center justify-center mx-auto"><Ban size={24} className="text-[#DC2626]" /></div>
            <div className="text-center">
              <h3 className="text-[15px] font-bold text-[#1A1A2E] mb-1">Limite mensuelle atteinte</h3>
              <p className="text-[12.5px] text-[#6B7280]">
                Vous avez importé {limitReached.used}/{limitReached.limit} documents ce mois.
                Les imports seront disponibles à nouveau le <strong>{limitReached.resetDate}</strong>.
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setLimitReached(null)} className="btn btn-outline flex-1 justify-center">Fermer</button>
              <a href="/parametres" className="btn btn-gold flex-1 justify-center text-center">Voir l'abonnement →</a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
