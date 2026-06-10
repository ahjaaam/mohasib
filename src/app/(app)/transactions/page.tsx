"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Transaction } from "@/types";
import { TRANSACTION_CATEGORIES } from "@/lib/utils";
import { ArrowLeftRight, Plus, Filter } from "lucide-react";
import BankImportModal from "./BankImportModal";

function fmt(n: number) { return n.toLocaleString("fr-MA") + " MAD"; }
function fmtDate(d: string) { return new Date(d).toLocaleDateString("fr-MA"); }

const today = new Date().toISOString().split("T")[0];

const ALL_CATS = ["Toutes", ...TRANSACTION_CATEGORIES.income, ...TRANSACTION_CATEGORIES.expense];

export default function TransactionsPage({ dossierId: propDossierId }: { dossierId?: string } = {}) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bankImportOpen, setBankImportOpen] = useState(false);

  // Filters
  const [filterDesc, setFilterDesc] = useState("");
  const [filterCat, setFilterCat] = useState("Toutes");
  const [filterAmount, setFilterAmount] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  const searchParams = useSearchParams();
  const dossierId = propDossierId ?? searchParams.get("dossier_id");
  const supabase = createClient();

  const [form, setForm] = useState({
    date: today,
    desc: "",
    cat: "Revenu",
    amount: "",
  });

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    const query = supabase.from("transactions").select("*, clients(id, name)");
    const { data } = await (dossierId
      ? query.eq("dossier_id", dossierId)
      : query.eq("user_id", user.id).is("dossier_id", null))
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
      ...(dossierId ? { dossier_id: dossierId } : {}),
    });
    setSaving(false);
    if (err) { setError(err.message); }
    else {
      setForm({ date: today, desc: "", cat: "Revenu", amount: "" });
      load();
    }
  }

  const currentMonth = today.slice(0, 7); // "YYYY-MM"
  const monthlyTx = transactions.filter((t) => t.date.slice(0, 7) === currentMonth);
  const income  = monthlyTx.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const expense = monthlyTx.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const balance = income - expense;

  const allFormCats = [...TRANSACTION_CATEGORIES.income, ...TRANSACTION_CATEGORIES.expense];

  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      if (filterDesc && !tx.description?.toLowerCase().includes(filterDesc.toLowerCase())) return false;
      if (filterCat !== "Toutes" && (tx.category ?? tx.type) !== filterCat) return false;
      if (filterAmount && !String(tx.amount).includes(filterAmount)) return false;
      if (filterFrom && tx.date < filterFrom) return false;
      if (filterTo && tx.date > filterTo) return false;
      return true;
    });
  }, [transactions, filterDesc, filterCat, filterAmount, filterFrom, filterTo]);

  const hasFilter = filterDesc || filterCat !== "Toutes" || filterAmount || filterFrom || filterTo;

  return (
    <div>
      <BankImportModal
        open={bankImportOpen}
        onClose={() => setBankImportOpen(false)}
        userId={userId}
        dossierId={dossierId}
        onImported={load}
      />

      {/* ─── Page header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(200,146,74,0.12)" }}>
            <ArrowLeftRight size={18} className="text-[#C8924A]" />
          </div>
          <div>
            <h1 className="text-[18px] font-bold text-[#1A1A2E] leading-none">Transactions</h1>
            <p className="text-[11px] text-[#9CA3AF] mt-0.5">Enregistrez et suivez vos mouvements financiers</p>
          </div>
        </div>
        <div className="relative group">
          <button className="btn btn-gold flex items-center gap-1.5" onClick={() => setBankImportOpen(true)}>
            <Plus size={13} /> Importer un relevé
          </button>
          <div className="absolute right-0 top-full mt-1.5 bg-[#0D1526] text-white text-[11px] rounded-md px-2.5 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
            PDF max 8 pages · CSV max 200 lignes
          </div>
        </div>
      </div>

      {/* KPIs — current month */}
      <div className="grid grid-cols-3 gap-2.5 mb-4">
        <div className="kpi">
          <div className="kpi-label">Encaissé <span className="text-[10px] font-normal text-[#9CA3AF] ml-1">ce mois</span></div>
          <div className="kpi-value text-[#059669]">{fmt(income)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Dépensé <span className="text-[10px] font-normal text-[#9CA3AF] ml-1">ce mois</span></div>
          <div className="kpi-value text-[#DC2626]">{fmt(expense)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Solde net <span className="text-[10px] font-normal text-[#9CA3AF] ml-1">ce mois</span></div>
          <div className={`kpi-value ${balance >= 0 ? "text-[#1A1A2E]" : "text-[#DC2626]"}`}>{fmt(balance)}</div>
        </div>
      </div>

      {/* ─── Filters ─────────────────────────────────────────────────────── */}
      <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl p-4 mb-3"
        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
        <div className="flex flex-wrap items-end gap-3">
          {/* Description */}
          <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
            <label className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-[0.5px]">Description</label>
            <input className="input" placeholder="Rechercher…" value={filterDesc}
              onChange={(e) => setFilterDesc(e.target.value)} />
          </div>

          {/* Catégorie */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-[0.5px]">Catégorie</label>
            <select className="input" value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
              {ALL_CATS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>

          {/* Montant */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-[0.5px]">Montant</label>
            <input className="input" placeholder="ex: 1500" value={filterAmount}
              onChange={(e) => setFilterAmount(e.target.value)} style={{ width: 120 }} />
          </div>

          {/* Date Du */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-[0.5px]">Du</label>
            <input type="date" className="input" value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)} />
          </div>

          {/* Date Au */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-[0.5px]">Au</label>
            <input type="date" className="input" value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)} />
          </div>

          {hasFilter && (
            <button
              onClick={() => { setFilterDesc(""); setFilterCat("Toutes"); setFilterAmount(""); setFilterFrom(""); setFilterTo(""); }}
              className="btn btn-outline text-[12px] pb-[9px]"
            >
              Réinitialiser
            </button>
          )}

          <div className="flex items-center gap-1.5 pb-[9px] ml-auto">
            <Filter size={12} className="text-[#9CA3AF]" />
            <span className="text-[11.5px] text-[#9CA3AF]">
              {filtered.length} résultat{filtered.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      {/* ─── Add transaction ──────────────────────────────────────────────── */}
      <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-[0.5px] mb-2">
        Nouvelle transaction
      </p>
      <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl p-3.5 mb-4">
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
              {allFormCats.map((c) => <option key={c}>{c}</option>)}
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
            disabled={saving}
            className="btn whitespace-nowrap"
            style={{
              height: 36, padding: "0 20px", borderRadius: 8, alignSelf: "flex-end",
              background: "#1A1A2E", color: "#fff",
            }}
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
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={4} className="text-center py-10 text-[#6B7280] text-[12px]">
                {hasFilter ? "Aucun résultat" : "Aucune transaction"}
              </td></tr>
            )}
            {filtered.map((tx) => (
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
