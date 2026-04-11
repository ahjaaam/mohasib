"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { X, Upload, Loader2, Search, Trash2, Check } from "lucide-react";

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

const PROCESSING_STEPS = [
  "📄 Lecture du document...",
  "🔍 Extraction des transactions...",
  "🤖 Catégorisation par IA...",
  "✓ Analyse terminée !",
];

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function fmt(n: number) {
  return Math.abs(n).toLocaleString("fr-MA", { minimumFractionDigits: 2 }) + " MAD";
}

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("fr-MA", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
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

export default function BankImportModal({ open, onClose, userId, onImported }: Props) {
  const supabase = createClient();

  // Flow state
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [file, setFile] = useState<File | null>(null);
  const [bank, setBank] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Processing
  const [processingStep, setProcessingStep] = useState(0);

  // Review
  const [transactions, setTransactions] = useState<ExtractedTx[]>([]);
  const [period, setPeriod] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "income" | "expense">("all");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [importing, setImporting] = useState(false);

  // Success
  const [importedStats, setImportedStats] = useState<{
    total: number; income: number; expense: number;
    incomeAmt: number; expenseAmt: number; skipped: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset when modal closes
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setStep(1); setFile(null); setBank(""); setApiError(null);
        setProcessingStep(0); setTransactions([]); setPeriod(null);
        setFilter("all"); setSearch(""); setEditingId(null);
        setImportedStats(null);
      }, 200);
    }
  }, [open]);

  // ── File handling ──────────────────────────────────────────────────────────

  const handleFile = useCallback((f: File) => {
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/jpg", "image/webp"];
    if (!allowed.includes(f.type)) {
      setApiError("Format non supporté. Utilisez PDF, JPG ou PNG.");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setApiError("Fichier trop volumineux. Maximum 10MB.");
      return;
    }
    setApiError(null);
    setFile(f);
  }, []);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  // ── Analyze ────────────────────────────────────────────────────────────────

  async function analyze() {
    if (!file) return;
    setStep(2);
    setApiError(null);
    setProcessingStep(0);

    // Animation timers
    const t1 = setTimeout(() => setProcessingStep(1), 700);
    const t2 = setTimeout(() => setProcessingStep(2), 2800);

    const fd = new FormData();
    fd.append("file", file);
    if (bank) fd.append("bank", bank);

    const res = await fetch("/api/import/bank-statement", { method: "POST", body: fd });
    const result = await res.json();

    clearTimeout(t1);
    clearTimeout(t2);

    if (!res.ok || result.error) {
      setApiError(result.error || "Erreur d'analyse.");
      setProcessingStep(0);
      await sleep(600);
      setStep(1);
      return;
    }

    setProcessingStep(3); // categorizing
    await sleep(700);
    setProcessingStep(4); // done
    await sleep(500);

    // Fetch existing transactions to detect duplicates
    const { data: existing } = await supabase
      .from("transactions")
      .select("date, amount, type")
      .eq("user_id", userId);

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

  function updateField(id: string, field: "description" | "category", value: string) {
    setTransactions((prev) =>
      prev.map((t) => (t._id === id ? { ...t, [field]: value } : t))
    );
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
    if (selectedTxs.length === 0) return;
    setImporting(true);

    const rows = selectedTxs.map((t) => ({
      user_id: userId,
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
      const simpleRows = rows.map(({ source: _s, bank_reference: _b, ...r }) => r);
      ({ error } = await supabase.from("transactions").insert(simpleRows));
    }

    setImporting(false);

    if (error) {
      toast.error(error.message, { duration: 8000 });
      return;
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
    setStep(4);
    onImported();
  }

  // ─────────────────────────────────────────────────────────────────────────
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ backgroundColor: "rgba(13,21,38,0.6)", backdropFilter: "blur(4px)" }}
    >
      <div className="bg-white w-full sm:rounded-xl shadow-2xl flex flex-col"
        style={{ maxWidth: 920, height: "clamp(500px, 92vh, 920px)" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(0,0,0,0.08)] flex-shrink-0">
          <div>
            <h2 className="text-[14px] font-semibold text-[#1A1A2E]">
              Importer un relevé bancaire
            </h2>
            {period && step >= 3 && (
              <p className="text-[11.5px] text-[#C8924A] font-medium mt-0.5">{period}</p>
            )}
          </div>
          <button onClick={onClose} className="text-[#6B7280] hover:text-[#1A1A2E] transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Step indicator */}
        <StepIndicator step={step} />

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">

          {/* ── STEP 1: Upload ────────────────────────────────────────────── */}
          {step === 1 && (
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">

              {/* Drop zone */}
              <div
                className={`relative border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${
                  dragOver
                    ? "border-[#C8924A] bg-[rgba(200,146,74,0.06)]"
                    : file
                    ? "border-[#059669] bg-[#F0FDF4]"
                    : "border-[rgba(0,0,0,0.15)] hover:border-[#C8924A] hover:bg-[rgba(200,146,74,0.03)]"
                }`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,image/jpeg,image/png,image/jpg,image/webp"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                />
                {file ? (
                  <>
                    <div className="text-3xl">📄</div>
                    <p className="text-[13px] font-semibold text-[#059669]">{file.name}</p>
                    <p className="text-[11.5px] text-[#6B7280]">
                      {(file.size / 1024 / 1024).toFixed(1)} MB — Cliquez pour changer
                    </p>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-full bg-[#F3F4F6] flex items-center justify-center">
                      <Upload size={22} className="text-[#9CA3AF]" />
                    </div>
                    <div className="text-center">
                      <p className="text-[13px] font-medium text-[#1A1A2E]">
                        Glissez votre relevé bancaire ici
                      </p>
                      <p className="text-[12px] text-[#6B7280]">ou cliquez pour sélectionner</p>
                    </div>
                    <p className="text-[11px] text-[#9CA3AF]">
                      PDF, JPG, PNG — max 10 MB
                    </p>
                  </>
                )}
              </div>

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
                <div className="bg-[#FEE2E2] border border-[#FECACA] rounded-lg px-4 py-3 text-[12.5px] text-[#DC2626]">
                  ❌ {apiError}
                </div>
              )}

              <div className="mt-auto flex justify-end">
                <button
                  onClick={analyze}
                  disabled={!file}
                  className="btn btn-gold px-6 disabled:opacity-50"
                >
                  Analyser le relevé →
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 2: Processing ────────────────────────────────────────── */}
          {step === 2 && (
            <div className="flex-1 flex flex-col items-center justify-center gap-8 p-8">
              <div className="w-16 h-16 rounded-full bg-[#0D1526] flex items-center justify-center">
                <Loader2 size={28} className="text-[#C8924A] animate-spin" />
              </div>

              <div className="flex flex-col gap-3 w-full max-w-xs">
                {PROCESSING_STEPS.map((label, i) => {
                  const done = processingStep > i;
                  const active = processingStep === i;
                  return (
                    <div
                      key={i}
                      className={`flex items-center gap-3 text-[13px] transition-all ${
                        done ? "text-[#059669]" : active ? "text-[#1A1A2E] font-medium" : "text-[#9CA3AF]"
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] ${
                          done
                            ? "bg-[#059669] text-white"
                            : active
                            ? "bg-[#C8924A] text-white"
                            : "bg-[#F3F4F6]"
                        }`}
                      >
                        {done ? <Check size={10} /> : active ? <Loader2 size={9} className="animate-spin" /> : i + 1}
                      </div>
                      {label}
                    </div>
                  );
                })}
              </div>

              <p className="text-[11.5px] text-[#9CA3AF] text-center max-w-xs">
                L'IA analyse votre relevé. Cette opération peut prendre jusqu'à 30 secondes.
              </p>
            </div>
          )}

          {/* ── STEP 3: Review ────────────────────────────────────────────── */}
          {step === 3 && (
            <div className="flex-1 flex flex-col min-h-0">
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
                <div className="mx-5 mt-3 flex-shrink-0 bg-[#FEF3C7] border border-[#FDE68A] rounded-lg px-3.5 py-2.5 text-[12px] text-[#92400E]">
                  ⚠️ {dupCount} transaction{dupCount > 1 ? "s semblent" : " semble"} déjà exister dans votre journal — décochée{dupCount > 1 ? "s" : ""} automatiquement.
                </div>
              )}

              {/* Toolbar */}
              <div className="px-5 py-2.5 flex items-center gap-2 flex-shrink-0 border-b border-[rgba(0,0,0,0.06)]">
                <div className="relative flex-1 max-w-[260px]">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                  <input
                    className="input pl-7 py-1.5 text-[12px]"
                    placeholder="Rechercher..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="flex rounded-lg overflow-hidden border border-[rgba(0,0,0,0.1)]">
                  {(["all", "income", "expense"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${
                        filter === f ? "bg-[#0D1526] text-[#C8924A]" : "text-[#6B7280] hover:bg-[#F9FAFB]"
                      }`}
                    >
                      {f === "all" ? "Tous" : f === "income" ? "Revenus" : "Dépenses"}
                    </button>
                  ))}
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
              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-[12px]">
                  <thead className="sticky top-0 bg-white border-b border-[rgba(0,0,0,0.07)] z-10">
                    <tr>
                      <th className="w-8 px-3 py-2.5"></th>
                      <th className="px-3 py-2.5 text-left text-[10.5px] font-semibold text-[#6B7280] uppercase tracking-[0.4px] w-24">Date</th>
                      <th className="px-3 py-2.5 text-left text-[10.5px] font-semibold text-[#6B7280] uppercase tracking-[0.4px]">Description</th>
                      <th className="px-3 py-2.5 text-left text-[10.5px] font-semibold text-[#6B7280] uppercase tracking-[0.4px] w-40">Catégorie</th>
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
                          {fmtDate(tx.date)}
                          {tx.isDuplicate && (
                            <span className="ml-1 text-[9px] text-[#D97706]" title="Transaction déjà importée">⚠</span>
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

                        {/* Amount */}
                        <td className={`px-3 py-2 text-right font-semibold whitespace-nowrap ${
                          tx.amount >= 0 ? "text-[#059669]" : "text-[#DC2626]"
                        }`}>
                          {tx.amount >= 0 ? "+" : "−"}{fmt(tx.amount)}
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
                        <td colSpan={6} className="text-center py-8 text-[#9CA3AF] text-[12px]">
                          Aucune transaction correspondante
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Bottom bar */}
              <div className="px-5 py-3.5 border-t border-[rgba(0,0,0,0.08)] flex items-center justify-between flex-shrink-0 bg-white">
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
                <div className="flex gap-2">
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
            </div>
          )}

          {/* ── STEP 4: Success ───────────────────────────────────────────── */}
          {step === 4 && importedStats && (
            <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
              <div className="w-16 h-16 rounded-full bg-[#D1FAE5] flex items-center justify-center text-2xl">
                ✓
              </div>

              <div className="text-center">
                <p className="text-[16px] font-bold text-[#1A1A2E]">
                  {importedStats.total} transactions importées avec succès !
                </p>
                {period && <p className="text-[12.5px] text-[#C8924A] font-medium mt-1">{period}</p>}
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
                onClick={onClose}
                className="btn btn-gold px-8"
              >
                Voir les transactions →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
