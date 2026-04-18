"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Transaction } from "@/types";
import { TRANSACTION_CATEGORIES } from "@/lib/utils";
import { Paperclip, X, Loader2 } from "lucide-react";
import BankImportModal from "./BankImportModal";

function fmt(n: number) { return n.toLocaleString("fr-MA") + " MAD"; }
function fmtDate(d: string) { return new Date(d).toLocaleDateString("fr-MA"); }

const today = new Date().toISOString().split("T")[0];

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bankImportOpen, setBankImportOpen] = useState(false);
  const supabase = createClient();

  const [form, setForm] = useState({
    date: today,
    desc: "",
    cat: "Revenu",
    amount: "",
  });

  // Receipt upload state
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    const { data } = await supabase
      .from("transactions")
      .select("*, clients(id, name)")
      .eq("user_id", user.id)
      .order("date", { ascending: false });
    setTransactions(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  // Focus form when topbar "+ Transaction" clicked
  const amtRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const handler = () => amtRef.current?.focus();
    document.addEventListener("focus-tx-form", handler);
    return () => document.removeEventListener("focus-tx-form", handler);
  }, []);

  // Open bank import modal from topbar button
  useEffect(() => {
    const handler = () => setBankImportOpen(true);
    document.addEventListener("bank-import-open", handler);
    return () => document.removeEventListener("bank-import-open", handler);
  }, []);

  async function handleReceiptUpload(file: File) {
    setReceiptFile(file);
    setOcrLoading(true);
    setOcrError(null);

    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch("/api/ocr", { method: "POST", body: fd });
      const json = await res.json();

      if (!res.ok) { setOcrError(json.error ?? "Erreur OCR"); return; }

      const ocr = json.ocr ?? {};
      setReceiptId(json.receipt?.id ?? null);

      // Pre-fill form with extracted data
      setForm((f) => ({
        date: ocr.date ?? f.date,
        desc: ocr.vendor
          ? `${ocr.vendor}${ocr.description ? " — " + ocr.description : ""}`
          : ocr.description ?? f.desc,
        cat: ocr.category ?? f.cat,
        amount: ocr.amount != null
          ? (ocr.type === "expense" ? `-${ocr.amount}` : String(ocr.amount))
          : f.amount,
      }));
    } catch {
      setOcrError("Impossible de traiter le reçu.");
    } finally {
      setOcrLoading(false);
    }
  }

  function clearReceipt() {
    setReceiptFile(null);
    setReceiptId(null);
    setOcrError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function addTransaction() {
    if (!form.desc || !form.amount) { setError("Remplissez la description et le montant."); return; }
    setSaving(true);
    setError(null);
    const amt = parseFloat(form.amount);
    const type = amt >= 0 ? "income" : "expense";
    const { error: err } = await supabase.from("transactions").insert({
      user_id: userId,
      type,
      description: form.desc,
      amount: Math.abs(amt),
      date: form.date,
      category: form.cat || null,
      currency: "MAD",
      ...(receiptId ? { receipt_id: receiptId } : {}),
    });
    setSaving(false);
    if (err) { setError(err.message); }
    else {
      // Mark receipt as matched if linked
      if (receiptId) {
        await supabase.from("receipts").update({ status: "matched" }).eq("id", receiptId);
      }
      setForm({ date: today, desc: "", cat: "Revenu", amount: "" });
      clearReceipt();
      load();
    }
  }

  const income = transactions.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const expense = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const balance = income - expense;

  const allCats = [...TRANSACTION_CATEGORIES.income, ...TRANSACTION_CATEGORIES.expense];

  return (
    <div>
      <BankImportModal
        open={bankImportOpen}
        onClose={() => setBankImportOpen(false)}
        userId={userId}
        onImported={load}
      />
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-2.5 mb-3.5">
        <div className="kpi">
          <div className="kpi-label">Encaissé</div>
          <div className="kpi-value text-[#059669]">{fmt(income)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Dépensé</div>
          <div className="kpi-value text-[#DC2626]">{fmt(expense)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Solde net</div>
          <div className={`kpi-value ${balance >= 0 ? "text-[#1A1A2E]" : "text-[#DC2626]"}`}>{fmt(balance)}</div>
        </div>
      </div>

      {/* Inline add form */}
      <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl p-3.5 mb-3">
        {/* Receipt upload bar */}
        <div className="flex items-center gap-2 mb-2.5 pb-2.5 border-b border-[rgba(0,0,0,0.06)]">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleReceiptUpload(f);
            }}
          />
          {!receiptFile ? (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 text-[11.5px] text-[#6B7280] hover:text-[#C8924A] transition-colors"
            >
              <Paperclip size={13} />
              Importer un reçu (OCR auto)
            </button>
          ) : (
            <div className="flex items-center gap-2">
              {ocrLoading ? (
                <span className="flex items-center gap-1.5 text-[11.5px] text-[#C8924A]">
                  <Loader2 size={13} className="animate-spin" />
                  Analyse en cours...
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-[11.5px] text-[#059669]">
                  <Paperclip size={13} />
                  {receiptFile.name}
                  {receiptId && " · Reçu lié"}
                </span>
              )}
              <button onClick={clearReceipt} className="text-[#6B7280] hover:text-[#DC2626] transition-colors">
                <X size={13} />
              </button>
            </div>
          )}
          {ocrError && <span className="text-[11px] text-[#DC2626] ml-2">{ocrError}</span>}
        </div>

        {/* Form fields */}
        <div className="grid gap-2 items-end" style={{ gridTemplateColumns: "120px 1fr 140px 130px auto" }}>
          <div className="flex flex-col gap-1">
            <label className="text-[10.5px] font-medium text-[#6B7280]">Date</label>
            <input type="date" className="input" value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10.5px] font-medium text-[#6B7280]">Description</label>
            <input className="input" placeholder="ex: Loyer bureau..." value={form.desc}
              onChange={(e) => setForm((f) => ({ ...f, desc: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && addTransaction()} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10.5px] font-medium text-[#6B7280]">Catégorie</label>
            <select className="input" value={form.cat}
              onChange={(e) => setForm((f) => ({ ...f, cat: e.target.value }))}>
              {allCats.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10.5px] font-medium text-[#6B7280]">Montant (MAD)</label>
            <input ref={amtRef} type="number" step="0.01" className="input" placeholder="-500 ou 5000"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && addTransaction()} />
          </div>
          <button
            onClick={addTransaction}
            disabled={saving || ocrLoading}
            className="btn btn-gold whitespace-nowrap"
            style={{ height: 36, padding: "0 20px", borderRadius: 8, alignSelf: "flex-end" }}
          >
            {saving ? "..." : "Ajouter"}
          </button>
        </div>
      </div>

      {error && <p className="text-[12px] text-[#DC2626] bg-[#FEE2E2] rounded-lg px-3 py-2 mb-3">{error}</p>}

      {/* Table */}
      <div className="tbl">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Catégorie</th>
              <th>Montant</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={4} className="text-center py-8 text-[#6B7280] text-[12px]">Chargement...</td></tr>
            )}
            {!loading && transactions.length === 0 && (
              <tr><td colSpan={4} className="text-center py-10 text-[#6B7280] text-[12px]">Aucune transaction</td></tr>
            )}
            {transactions.map((tx) => (
              <tr key={tx.id}>
                <td className="text-[#6B7280]">{fmtDate(tx.date)}</td>
                <td>{tx.description}</td>
                <td>
                  <span className={`badge ${tx.type === "income" ? "b-paid" : "b-draft"}`}>
                    {tx.category ?? tx.type}
                  </span>
                </td>
                <td className={`font-semibold ${tx.type === "income" ? "text-[#059669]" : "text-[#DC2626]"}`}>
                  {tx.type === "income" ? "+" : "-"}{fmt(Math.abs(Number(tx.amount)))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
