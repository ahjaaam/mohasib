"use client";

import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Transaction } from "@/types";
import { TRANSACTION_CATEGORIES } from "@/lib/utils";
import { getAccountLabel, getExpenseAccount, getRevenueAccount } from "@/lib/cgnc-mapping";
import { cgncAccounts } from "@/lib/cgnc-accounts";
import { ArrowLeftRight, CheckCircle, Plus, Upload, Filter, Link2, Loader2, X } from "lucide-react";
import BankImportModal from "./BankImportModal";
import AllocateTransactionModal from "./AllocateTransactionModal";
import { usePlanEntitlements } from "@/hooks/usePlanEntitlements";
import { useAccountOwnerId } from "@/hooks/useAccountOwner";
import { useGlobalPeriod } from "@/hooks/useGlobalPeriod";
import SortableTh, { compareValues, nextSort, type SortDirection } from "@/components/SortableTh";
import RevenueExpenseChart from "@/app/(app)/dashboard/RevenueExpenseChart";
import { buildFinanceChartData } from "@/lib/finance-chart";
import { periodForPreset } from "@/lib/global-period";
import { BANK_STATEMENT_PDF_MAX_PAGES } from "@/lib/bank-import-limits";

function fmt(n: number) { return n.toLocaleString("fr-MA") + " MAD"; }
function fmtDate(d: string) { return new Date(d).toLocaleDateString("fr-MA"); }

const today = new Date().toISOString().split("T")[0];

const ALL_CATS = ["Toutes", ...TRANSACTION_CATEGORIES.income, ...TRANSACTION_CATEGORIES.expense];
type TransactionSortKey = "date" | "description" | "category" | "source" | "debit" | "credit";

function sourceLabel(source: Transaction["source"] | null | undefined) {
  return source === "bank_import" ? "Relevé bancaire" : "Manuelle";
}

export default function TransactionsPage({ dossierId: propDossierId }: { dossierId?: string } = {}) {
  const ownerId = useAccountOwnerId();
  const { period: globalPeriod } = useGlobalPeriod();
  const entitlements = usePlanEntitlements();
  const searchParams = useSearchParams();
  const requestedSearch = searchParams.get("search") ?? "";
  const requestedAction = searchParams.get("action");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addTransactionOpen, setAddTransactionOpen] = useState(requestedAction === "expense");
  const [bankImportOpen, setBankImportOpen] = useState(false);
  const [allocationTransaction, setAllocationTransaction] = useState<Transaction | null>(null);
  const [allocationCounts, setAllocationCounts] = useState<Record<string, number>>({});
  const [bookedTransactionIds, setBookedTransactionIds] = useState<Set<string>>(new Set());
  const [confirmingTransaction, setConfirmingTransaction] = useState<Transaction | null>(null);
  const [bookingTransaction, setBookingTransaction] = useState(false);
  const [accountingAccount, setAccountingAccount] = useState("");

  // Filters
  const [filterDescState, setFilterDescState] = useState({ source: requestedSearch, value: requestedSearch });
  const filterDesc = filterDescState.source === requestedSearch ? filterDescState.value : requestedSearch;
  const setFilterDesc = (value: string) => setFilterDescState({ source: requestedSearch, value });
  const [filterCat, setFilterCat] = useState("Toutes");
  const [filterAmount, setFilterAmount] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [sortKey, setSortKey] = useState<TransactionSortKey>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  useEffect(() => {
    setFilterFrom(globalPeriod.start);
    setFilterTo(globalPeriod.end);
  }, [globalPeriod.start, globalPeriod.end]);

  const dossierId = propDossierId ?? searchParams.get("dossier_id");
  const supabase = createClient();

  const [form, setForm] = useState({
    date: today,
    desc: "",
    cat: requestedAction === "expense" ? "Autre dépense" : "Revenu",
    amount: "",
    piece: "",
  });

  async function load(runAutoMatch = true) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(ownerId);
    const query = supabase.from("transactions").select("*, clients(id, name)");
    const { data } = await (dossierId
      ? query.eq("dossier_id", dossierId)
      : query.eq("user_id", ownerId).is("dossier_id", null))
      .order("date", { ascending: false });
    const rows = (data ?? []) as Transaction[];
    setTransactions(rows);
    if (rows.length) {
      const transactionIds = rows.map(row => row.id);
      const [{ data: allocations }, { data: bookedEntries }] = await Promise.all([
        supabase
          .from("invoice_payments")
          .select("transaction_id")
          .in("transaction_id", transactionIds)
          .eq("allocation_status", "confirmed"),
        supabase
          .from("ecritures_comptables")
          .select("source_id")
          .eq("source_type", "bank")
          .in("source_id", transactionIds),
      ]);
      setBookedTransactionIds(new Set((bookedEntries ?? []).map(entry => entry.source_id).filter(Boolean)));
      const counts: Record<string, number> = {};
      for (const allocation of allocations ?? []) {
        if (!allocation.transaction_id) continue;
        counts[allocation.transaction_id] = (counts[allocation.transaction_id] ?? 0) + 1;
      }
      setAllocationCounts(counts);
      setLoading(false);
      const unmatchedIds = rows.filter(row => !counts[row.id]).slice(0, 25).map(row => row.id);
      if (runAutoMatch && unmatchedIds.length) {
        const response = await fetch("/api/payment-allocations/auto-match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transaction_ids: unmatchedIds }),
        });
        if (response.ok) {
          const result = await response.json();
          if (Number(result.matched ?? 0) > 0) {
            await load(false);
            return;
          }
        }
      }
    } else {
      setAllocationCounts({});
      setBookedTransactionIds(new Set());
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // Open the modal when the topbar "+ Transaction" action is clicked.
  useEffect(() => {
    const handler = () => setAddTransactionOpen(true);
    document.addEventListener("focus-tx-form", handler);
    return () => document.removeEventListener("focus-tx-form", handler);
  }, []);

  // Open bank import modal from topbar button
  useEffect(() => {
    if (!entitlements.features.bank_import) return;
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
      reference: form.piece || null,
      currency: "MAD",
      source: "manual",
      ...(dossierId ? { dossier_id: dossierId } : {}),
    });
    setSaving(false);
    if (err) { setError(err.message); }
    else {
      setForm({ date: today, desc: "", cat: "Revenu", amount: "", piece: "" });
      setAddTransactionOpen(false);
      load();
    }
  }

  function closeAddTransactionModal() {
    if (saving) return;
    setAddTransactionOpen(false);
    setError(null);
  }

  async function confirmTransactionBooking() {
    if (!confirmingTransaction || !accountingAccount || bookingTransaction) return;
    setBookingTransaction(true);
    setError(null);
    const response = await fetch("/api/accounting/book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "bank",
        transactionIds: [confirmingTransaction.id],
        accountOverrides: { [confirmingTransaction.id]: accountingAccount },
        dossierId: dossierId ?? null,
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(result.message ?? result.error ?? "La comptabilisation a échoué.");
      setBookingTransaction(false);
      return;
    }
    setBookedTransactionIds(current => new Set(current).add(confirmingTransaction.id));
    setBookingTransaction(false);
    setConfirmingTransaction(null);
  }

  function openTransactionConfirmation(transaction: Transaction) {
    const suggestedAccount = transaction.type === "income"
      ? getRevenueAccount(transaction.category ?? "")
      : getExpenseAccount(transaction.category ?? "");
    setError(null);
    setAccountingAccount(suggestedAccount);
    setConfirmingTransaction(transaction);
  }

  const currentMonth = today.slice(0, 7); // "YYYY-MM"
  const monthlyTx = transactions.filter((t) => t.date.slice(0, 7) === currentMonth);
  const income  = monthlyTx.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const expense = monthlyTx.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const balance = income - expense;
  const currentMonthPeriod = periodForPreset("this_month");
  const currentMonthLabel = new Date(`${currentMonthPeriod.start}T00:00:00`).toLocaleDateString("fr-MA", {
    month: "long",
    year: "numeric",
  });
  const chartData = buildFinanceChartData(monthlyTx, currentMonthPeriod);

  const allFormCats = [...TRANSACTION_CATEGORIES.income, ...TRANSACTION_CATEGORIES.expense];

  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      if (filterDesc) {
        const query = filterDesc.toLowerCase();
        const searchable = [
          tx.description,
          tx.category,
          tx.reference,
          tx.notes,
          tx.fournisseur,
          tx.if_fournisseur,
          tx.ice_fournisseur,
        ];
        if (!searchable.some((value) => value?.toLowerCase().includes(query))) return false;
      }
      if (filterCat !== "Toutes" && (tx.category ?? tx.type) !== filterCat) return false;
      if (filterAmount && !String(tx.amount).includes(filterAmount)) return false;
      if (filterFrom && tx.date < filterFrom) return false;
      if (filterTo && tx.date > filterTo) return false;
      return true;
    });
  }, [transactions, filterDesc, filterCat, filterAmount, filterFrom, filterTo]);

  function handleSort(nextKey: TransactionSortKey) {
    const next = nextSort(sortKey, sortDirection, nextKey);
    setSortKey(next.key);
    setSortDirection(next.direction);
  }

  const sorted = useMemo(() => {
    const valueFor = (tx: Transaction, key: TransactionSortKey): string | number | null => {
      switch (key) {
        case "date": return tx.date;
        case "description": return tx.description ?? "";
        case "category": return tx.category ?? tx.type ?? "";
        case "source": return sourceLabel(tx.source);
        case "debit": return tx.type === "expense" ? Number(tx.amount ?? 0) : null;
        case "credit": return tx.type === "income" ? Number(tx.amount ?? 0) : null;
        default: return "";
      }
    };
    return [...filtered].sort((a, b) => compareValues(valueFor(a, sortKey), valueFor(b, sortKey), sortDirection));
  }, [filtered, sortKey, sortDirection]);

  const hasFilter = filterDesc || filterCat !== "Toutes" || filterAmount || filterFrom || filterTo;

  return (
    <div>
      {entitlements.features.bank_import && <BankImportModal
        open={bankImportOpen}
        onClose={() => setBankImportOpen(false)}
        userId={userId}
        dossierId={dossierId}
        onImported={load}
      />}
      {allocationTransaction && (
        <AllocateTransactionModal
          transaction={allocationTransaction}
          dossierId={dossierId}
          onClose={() => setAllocationTransaction(null)}
          onSaved={load}
        />
      )}
      {confirmingTransaction && (() => {
        const amount = Math.abs(Number(confirmingTransaction.amount));
        const isIncome = confirmingTransaction.type === "income";
        const counterpartAccount = accountingAccount;
        const selectableAccounts = cgncAccounts.filter(account => isIncome
          ? account.code.startsWith("7") || account.code.startsWith("3") || account.code.startsWith("4")
          : account.code.startsWith("6") || account.code.startsWith("2") || account.code.startsWith("4"));
        return (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !bookingTransaction) setConfirmingTransaction(null);
            }}
          >
            <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
                <div>
                  <h2 className="text-[16px] font-bold text-[#1A1A2E]">Vérifier et comptabiliser</h2>
                  <p className="mt-0.5 text-[11px] text-[#8A909B]">Aucune écriture ne sera créée avant votre confirmation.</p>
                </div>
                <button disabled={bookingTransaction} onClick={() => setConfirmingTransaction(null)} className="rounded-md p-2 text-[#6B7280] hover:bg-gray-100 disabled:opacity-50"><X size={18} /></button>
              </div>
              <div className="grid gap-3 border-b border-gray-100 bg-[#FAFAF8] px-5 py-4 sm:grid-cols-3">
                <div><div className="text-[10px] font-semibold uppercase text-[#9CA3AF]">Date</div><div className="mt-1 text-[12px] font-medium">{fmtDate(confirmingTransaction.date)}</div></div>
                <div><div className="text-[10px] font-semibold uppercase text-[#9CA3AF]">Description</div><div className="mt-1 truncate text-[12px] font-medium">{confirmingTransaction.description}</div></div>
                <div><div className="text-[10px] font-semibold uppercase text-[#9CA3AF]">Montant</div><div className="mt-1 text-[12px] font-semibold">{fmt(amount)}</div></div>
              </div>
              <div className="px-5 pt-5">
                <label className="block">
                  <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#8A909B]">Compte comptable</span>
                  <select className="input w-full" value={accountingAccount} onChange={(event) => setAccountingAccount(event.target.value)}>
                    {selectableAccounts.map(account => <option key={account.code} value={account.code}>{account.code} — {account.label}</option>)}
                  </select>
                </label>
              </div>
              <div className="p-5">
                <div className="mb-2 text-[11px] font-bold text-[#1A1A2E]">Aperçu de l’écriture · Journal BQ</div>
                <div className="overflow-hidden rounded-lg border border-black/10">
                  <table className="w-full text-[11px]">
                    <thead className="bg-[#FAFAF8] text-[9.5px] uppercase text-[#9CA3AF]"><tr><th className="px-3 py-2 text-left">Compte</th><th className="px-3 py-2 text-left">Libellé</th><th className="px-3 py-2 text-right">Débit</th><th className="px-3 py-2 text-right">Crédit</th></tr></thead>
                    <tbody className="divide-y divide-gray-100">
                      <tr><td className="px-3 py-2 font-mono font-semibold text-[#C8924A]">{isIncome ? "5141" : counterpartAccount}</td><td className="px-3 py-2">{getAccountLabel(isIncome ? "5141" : counterpartAccount)}</td><td className="px-3 py-2 text-right font-semibold">{fmt(amount)}</td><td className="px-3 py-2 text-right text-[#9CA3AF]">—</td></tr>
                      <tr><td className="px-3 py-2 font-mono font-semibold text-[#C8924A]">{isIncome ? counterpartAccount : "5141"}</td><td className="px-3 py-2">{getAccountLabel(isIncome ? counterpartAccount : "5141")}</td><td className="px-3 py-2 text-right text-[#9CA3AF]">—</td><td className="px-3 py-2 text-right font-semibold">{fmt(amount)}</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
              {error && <p className="mx-5 mb-4 rounded-lg bg-[#FEE2E2] px-3 py-2 text-[12px] text-[#DC2626]">{error}</p>}
              <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-4">
                <button disabled={bookingTransaction} onClick={() => setConfirmingTransaction(null)} className="btn btn-outline">Annuler</button>
                <button disabled={bookingTransaction || !accountingAccount} onClick={confirmTransactionBooking} className="btn btn-gold">
                  {bookingTransaction ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                  {bookingTransaction ? "Comptabilisation…" : "Confirmer et créer l’écriture"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
      {addTransactionOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(13,21,38,0.5)", backdropFilter: "blur(4px)" }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeAddTransactionModal();
          }}
        >
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h2 className="font-semibold text-[#1A1A2E]">Nouvelle transaction</h2>
                <p className="mt-0.5 text-[11px] text-[#9CA3AF]">Enregistrez un nouveau mouvement financier</p>
              </div>
              <button
                type="button"
                onClick={closeAddTransactionModal}
                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                aria-label="Fermer"
              >
                <X size={18} />
              </button>
            </div>

            <form
              className="space-y-4 p-5"
              onSubmit={(event) => {
                event.preventDefault();
                addTransaction();
              }}
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label className="label">Date</label>
                  <input type="date" className="input" value={form.date}
                    onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="label">N° de pièce</label>
                  <input className="input" placeholder="Virement, chèque..." value={form.piece}
                    onChange={(e) => setForm((f) => ({ ...f, piece: e.target.value }))} />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="label">Description</label>
                <input autoFocus className="input" placeholder="ex: Loyer bureau..." value={form.desc}
                  onChange={(e) => setForm((f) => ({ ...f, desc: e.target.value }))} />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label className="label">Catégorie</label>
                  <select className="input" value={form.cat}
                    onChange={(e) => setForm((f) => ({ ...f, cat: e.target.value }))}>
                    {allFormCats.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="label">Montant (MAD)</label>
                  <input type="number" step="0.01" className="input" placeholder="-500 ou 5000"
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
                  <p className="text-[10.5px] text-[#9CA3AF]">Utilisez un montant négatif pour une dépense.</p>
                </div>
              </div>

              {error && <p className="rounded-lg bg-[#FEE2E2] px-3 py-2 text-[12px] text-[#DC2626]">{error}</p>}

              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={closeAddTransactionModal} className="btn btn-outline">
                  Annuler
                </button>
                <button
                  data-permission="accounting:create"
                  type="submit"
                  disabled={saving}
                  className="btn bg-[#1A1A2E] text-white hover:bg-[#292941]"
                >
                  {saving ? "Enregistrement..." : "Ajouter la transaction"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Page header ──────────────────────────────────────────────────── */}
      <div className="mb-5 flex flex-col items-stretch justify-between gap-4 xl:flex-row xl:items-center">
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
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center xl:shrink-0">
          <button
            type="button"
            data-permission="accounting:create"
            className="inline-flex h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[#D7DADF] bg-white px-3.5 text-[12px] font-medium text-[#374151] transition-colors hover:border-[#B8BEC8] hover:bg-[#F8F9FB] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C8924A] sm:h-9 sm:w-[184px]"
            onClick={() => {
              setError(null);
              setAddTransactionOpen(true);
            }}
          >
            <Plus size={15} strokeWidth={1.75} aria-hidden="true" /> Nouvelle transaction
          </button>
          {entitlements.features.bank_import && <div className="relative group">
            <button type="button" data-permission="accounting:create" aria-describedby="bank-import-limits" className="inline-flex h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[#111621] bg-[#111621] px-3.5 text-[12px] font-medium text-white transition-colors hover:border-[#25334B] hover:bg-[#25334B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C8924A] sm:h-9 sm:w-[184px]" onClick={() => setBankImportOpen(true)}>
              <Upload size={15} strokeWidth={1.75} aria-hidden="true" /> Importer un relevé
            </button>
            <div id="bank-import-limits" role="tooltip" className="absolute right-0 top-full mt-1.5 bg-[#0D1526] text-white text-[11px] rounded-md px-2.5 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity pointer-events-none z-10">
              PDF max {BANK_STATEMENT_PDF_MAX_PAGES} pages · CSV max 200 lignes
            </div>
          </div>}
        </div>
      </div>

      {/* KPIs + chart — current month */}
      <div className="mb-4 grid grid-cols-1 items-stretch gap-2.5 lg:h-[210px] lg:grid-cols-[minmax(220px,0.65fr)_minmax(0,2fr)]">
        <div className="grid h-[210px] min-h-0 grid-rows-[repeat(3,minmax(0,1fr))] gap-2.5 overflow-hidden">
          <div className="kpi flex min-h-0 flex-col justify-center !px-4 !py-2">
            <div className="kpi-label !mb-1">Encaissé <span className="ml-1 text-[10px] font-normal text-[#9CA3AF]">ce mois</span></div>
            <div className="kpi-value !mb-0 !text-[20px] text-[#059669]">{fmt(income)}</div>
          </div>
          <div className="kpi flex min-h-0 flex-col justify-center !px-4 !py-2">
            <div className="kpi-label !mb-1">Dépensé <span className="ml-1 text-[10px] font-normal text-[#9CA3AF]">ce mois</span></div>
            <div className="kpi-value !mb-0 !text-[20px] text-[#DC2626]">{fmt(expense)}</div>
          </div>
          <div className="kpi flex min-h-0 flex-col justify-center !px-4 !py-2">
            <div className="kpi-label !mb-1">Solde net <span className="ml-1 text-[10px] font-normal text-[#9CA3AF]">ce mois</span></div>
            <div className={`kpi-value !mb-0 !text-[20px] ${balance >= 0 ? "text-[#1A1A2E]" : "text-[#DC2626]"}`}>{fmt(balance)}</div>
          </div>
        </div>
        <div className="h-[210px] min-h-0 [&_.revenue-expense-chart]:h-full">
          <RevenueExpenseChart data={chartData} periodLabel={currentMonthLabel} />
        </div>
      </div>

      {/* ─── Filters ─────────────────────────────────────────────────────── */}
      <div className="relative mb-3 rounded-xl border border-[rgba(0,0,0,0.08)] bg-white p-4 pr-12"
        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
        {hasFilter && (
          <button
            type="button"
            onClick={() => {
              setFilterDesc("");
              setFilterCat("Toutes");
              setFilterAmount("");
              setFilterFrom("");
              setFilterTo("");
            }}
            className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-md text-[#9CA3AF] transition-colors hover:bg-[#F3F4F6] hover:text-[#374151]"
            aria-label="Effacer les filtres"
            title="Effacer les filtres"
          >
            <X size={15} />
          </button>
        )}
        <div className="flex flex-wrap items-end gap-3">
          {/* Description */}
          <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
            <label className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-[0.5px]">Recherche</label>
            <input className="input" placeholder="Description, fournisseur, référence…" value={filterDesc}
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

          <div className="flex items-center gap-1.5 pb-[9px] ml-auto">
            <Filter size={12} className="text-[#9CA3AF]" />
            <span className="text-[11.5px] text-[#9CA3AF]">
              {filtered.length} résultat{filtered.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="tbl">
        <table>
          <thead>
            <tr>
              <SortableTh sortKey="date" label="Date" activeKey={sortKey} direction={sortDirection} onSort={handleSort} />
              <SortableTh sortKey="description" label="Description" activeKey={sortKey} direction={sortDirection} onSort={handleSort} className="w-[290px] max-w-[290px]" />
              <SortableTh sortKey="category" label="Catégorie" activeKey={sortKey} direction={sortDirection} onSort={handleSort} />
              <SortableTh sortKey="source" label="Source" activeKey={sortKey} direction={sortDirection} onSort={handleSort} />
              <th>Affectation</th>
              <th>Comptabilisation</th>
              <SortableTh sortKey="debit" label="Débit" activeKey={sortKey} direction={sortDirection} onSort={handleSort} align="left" />
              <SortableTh sortKey="credit" label="Crédit" activeKey={sortKey} direction={sortDirection} onSort={handleSort} align="left" />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} className="loading-cell">Chargement...</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={8} className="text-center py-10 text-[#6B7280] text-[12px]">
                {hasFilter ? "Aucun résultat" : "Aucune transaction"}
              </td></tr>
            )}
            {sorted.map((tx) => (
              <tr key={tx.id}>
                <td className="text-[#6B7280]">{fmtDate(tx.date)}</td>
                <td className="w-[290px] max-w-[290px]">
                  <span className="block truncate" title={tx.description}>{tx.description}</span>
                </td>
                <td>
                  <span className={`badge ${tx.type === "income" ? "b-paid" : "b-draft"}`}>
                    {tx.category ?? tx.type}
                  </span>
                </td>
                <td>
                  <span className={`badge ${tx.source === "bank_import" ? "b-paid" : "b-draft"}`}>
                    {sourceLabel(tx.source)}
                  </span>
                </td>
                <td>
                  <button
                    data-permission="accounting:create"
                    onClick={() => setAllocationTransaction(tx)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-black/10 px-2 py-1 text-[10.5px] font-semibold text-[#374151] transition-colors hover:border-[#C8924A]/50 hover:bg-[#FFF9EF] hover:text-[#8A5D20]"
                  >
                    <Link2 size={11} />
                    {allocationCounts[tx.id]
                      ? `${allocationCounts[tx.id]} document${allocationCounts[tx.id] > 1 ? "s" : ""}`
                      : "Non affectée"}
                  </button>
                </td>
                <td>
                  {bookedTransactionIds.has(tx.id) ? (
                    <span className="badge b-paid">Comptabilisée</span>
                  ) : (
                    <button
                      data-permission="accounting:create"
                      onClick={() => openTransactionConfirmation(tx)}
                      className="inline-flex items-center whitespace-nowrap rounded-md border border-emerald-600 px-2 py-1 text-[10.5px] font-semibold text-emerald-700 hover:bg-emerald-50"
                    >
                      Confirmer
                    </button>
                  )}
                </td>
                <td className={`text-left font-semibold ${tx.type === "expense" ? "text-[#DC2626]" : "text-[#9CA3AF]"}`}>
                  {tx.type === "expense" ? fmt(Math.abs(Number(tx.amount))) : "—"}
                </td>
                <td className={`text-left font-semibold ${tx.type === "income" ? "text-[#059669]" : "text-[#9CA3AF]"}`}>
                  {tx.type === "income" ? fmt(Math.abs(Number(tx.amount))) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
