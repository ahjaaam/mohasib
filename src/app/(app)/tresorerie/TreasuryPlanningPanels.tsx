"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  ArrowRight,
  BrainCircuit,
  CalendarRange,
  CheckCircle2,
  CreditCard,
  Landmark,
  Loader2,
  Plus,
  RefreshCw,
  Repeat2,
  ShieldAlert,
  WalletCards,
  X,
} from "lucide-react";
import type { CustomerPaymentBehavior, ReceivableRecommendation, RecurringExpense, TreasurySnapshot } from "@/lib/treasury";

type Account = {
  id: string;
  name: string;
  account_type: string;
  bank_name: string | null;
  current_balance: number;
  overdraft_limit: number;
  financing_limit: number;
  financing_used: number;
  annual_rate: number | null;
};

type Budget = { id: string; week_start: string; inflow_budget: number; outflow_budget: number; notes: string | null };
type Transfer = { id: string; transfer_date: string; amount: number; reference: string | null; from_account?: { name?: string } | { name?: string }[]; to_account?: { name?: string } | { name?: string }[] };
type Panel = "budget" | "accounts" | "intelligence";

function mad(value: number) {
  return `${Number(value || 0).toLocaleString("fr-MA", { maximumFractionDigits: 0 })} MAD`;
}

function iso(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return iso(date);
}

function monday(value = new Date()) {
  const date = new Date(value);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  return iso(date);
}

function relationName(value: Transfer["from_account"]) {
  return Array.isArray(value) ? value[0]?.name || "Compte" : value?.name || "Compte";
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-[10px] font-semibold text-[#6B7280]">{label}</span>{children}</label>;
}

const inputClass = "h-9 w-full border border-black/[0.12] bg-white px-2.5 text-[11px] text-[#242836] outline-none focus:border-[#C8924A]";

export default function TreasuryPlanningPanels({
  snapshot,
  basePath,
  dossierId,
  accounts: initialAccounts,
  budgets: initialBudgets,
  transfers,
  recurringExpenses,
  paymentBehaviors,
  recommendations,
}: {
  snapshot: TreasurySnapshot;
  basePath: string;
  dossierId?: string;
  accounts: Account[];
  budgets: Budget[];
  transfers: Transfer[];
  recurringExpenses: RecurringExpense[];
  paymentBehaviors: CustomerPaymentBehavior[];
  recommendations: ReceivableRecommendation[];
}) {
  const router = useRouter();
  const [panel, setPanel] = useState<Panel>("budget");
  const [busy, setBusy] = useState(false);
  const [accountFormOpen, setAccountFormOpen] = useState(false);
  const [accountForm, setAccountForm] = useState({ name: "", accountType: "bank", bankName: "", currentBalance: "", overdraftLimit: "", financingLimit: "", financingUsed: "", annualRate: "" });
  const [transferForm, setTransferForm] = useState({ fromAccountId: "", toAccountId: "", amount: "", transferDate: iso(new Date()), reference: "" });
  const [budgetForm, setBudgetForm] = useState({ weekStart: monday(), inflowBudget: "", outflowBudget: "", notes: "" });
  const accounts = initialAccounts;
  const budgets = initialBudgets;

  async function submit(payload: Record<string, unknown>, success: string) {
    setBusy(true);
    try {
      const response = await fetch("/api/treasury", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, dossierId }) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Opération impossible");
      toast.success(success);
      router.refresh();
      return true;
    } catch (error: any) {
      toast.error(error.message || "Une erreur est survenue");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveAccount(event: React.FormEvent) {
    event.preventDefault();
    const ok = await submit({ action: "save_account", ...accountForm }, "Compte de trésorerie enregistré");
    if (ok) {
      setAccountFormOpen(false);
      setAccountForm({ name: "", accountType: "bank", bankName: "", currentBalance: "", overdraftLimit: "", financingLimit: "", financingUsed: "", annualRate: "" });
    }
  }

  async function createTransfer(event: React.FormEvent) {
    event.preventDefault();
    const ok = await submit({ action: "create_transfer", ...transferForm }, "Virement interne enregistré");
    if (ok) setTransferForm((value) => ({ ...value, amount: "", reference: "" }));
  }

  async function saveBudget(event: React.FormEvent) {
    event.preventDefault();
    const ok = await submit({ action: "save_budget", ...budgetForm }, "Budget hebdomadaire enregistré");
    if (ok) setBudgetForm((value) => ({ ...value, inflowBudget: "", outflowBudget: "", notes: "" }));
  }

  const liquidity = accounts.reduce((sum, account) => sum + Number(account.current_balance) + Number(account.overdraft_limit), 0);
  const financingAvailable = accounts.reduce((sum, account) => sum + Math.max(Number(account.financing_limit) - Number(account.financing_used), 0), 0);
  const weeks = useMemo(() => {
    const start = monday();
    return Array.from({ length: 8 }, (_, index) => {
      const weekStart = addDays(start, index * 7);
      const weekEnd = addDays(weekStart, 6);
      const flows = snapshot.flows.filter((flow) => flow.date >= weekStart && flow.date <= weekEnd);
      const projectedIn = flows.filter((flow) => flow.direction === "in").reduce((sum, flow) => sum + flow.amount, 0);
      const projectedOut = flows.filter((flow) => flow.direction === "out").reduce((sum, flow) => sum + flow.amount, 0);
      const budget = budgets.find((item) => item.week_start === weekStart);
      return { weekStart, weekEnd, projectedIn, projectedOut, budget };
    });
  }, [snapshot, budgets]);

  const tabs: Array<[Panel, string, React.ReactNode]> = [
    ["budget", "Budget hebdomadaire", <CalendarRange size={14} key="budget" />],
    ["accounts", "Comptes & financement", <Landmark size={14} key="accounts" />],
    ["intelligence", "Analyses IA", <BrainCircuit size={14} key="intelligence" />],
  ];

  return (
    <section className="mt-5 border border-black/[0.08] bg-white">
      <div className="flex gap-1 overflow-x-auto border-b border-black/[0.07] p-2">
        {tabs.map(([value, label, icon]) => (
          <button key={value} type="button" onClick={() => setPanel(value)} className={`flex shrink-0 items-center gap-1.5 px-3 py-2 text-[10.5px] font-semibold ${panel === value ? "bg-[#1A1A2E] text-white" : "text-[#6B7280] hover:bg-[#F7F7F5]"}`}>{icon}{label}</button>
        ))}
      </div>

      {panel === "budget" && (
        <div className="p-4">
          <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div><h2 className="text-[13px] font-bold text-[#1A1A2E]">Budget de trésorerie sur 8 semaines</h2><p className="text-[10.5px] text-[#9CA3AF]">Comparez votre enveloppe aux flux actuellement prévus.</p></div>
          </div>
          <div className="overflow-x-auto border border-black/[0.07]">
            <table className="min-w-[720px] w-full text-left">
              <thead className="bg-[#F8F8F5] text-[9.5px] uppercase tracking-[0.06em] text-[#8A8F98]"><tr><th className="px-3 py-2.5">Semaine</th><th className="px-3 py-2.5 text-right">Entrées prévues</th><th className="px-3 py-2.5 text-right">Budget entrées</th><th className="px-3 py-2.5 text-right">Sorties prévues</th><th className="px-3 py-2.5 text-right">Budget sorties</th><th className="px-3 py-2.5 text-right">Écart net</th></tr></thead>
              <tbody className="divide-y divide-black/[0.06]">
                {weeks.map((week) => {
                  const netVariance = week.budget ? (week.projectedIn - week.projectedOut) - (Number(week.budget.inflow_budget) - Number(week.budget.outflow_budget)) : 0;
                  return <tr key={week.weekStart} className="text-[10.5px]"><td className="px-3 py-2.5 font-semibold text-[#242836]">{new Date(`${week.weekStart}T12:00:00`).toLocaleDateString("fr-MA", { day: "2-digit", month: "short" })}</td><td className="px-3 py-2.5 text-right text-[#047857]">{mad(week.projectedIn)}</td><td className="px-3 py-2.5 text-right text-[#6B7280]">{week.budget ? mad(week.budget.inflow_budget) : "—"}</td><td className="px-3 py-2.5 text-right text-[#B91C1C]">{mad(week.projectedOut)}</td><td className="px-3 py-2.5 text-right text-[#6B7280]">{week.budget ? mad(week.budget.outflow_budget) : "—"}</td><td className={`px-3 py-2.5 text-right font-semibold ${netVariance < 0 ? "text-[#B91C1C]" : "text-[#047857]"}`}>{week.budget ? `${netVariance >= 0 ? "+" : ""}${mad(netVariance)}` : "À définir"}</td></tr>;
                })}
              </tbody>
            </table>
          </div>
          <form onSubmit={saveBudget} className="mt-4 grid grid-cols-1 gap-2.5 border border-[#E8D8BE] bg-[#FFFBF4] p-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1.2fr_auto] lg:items-end">
            <Field label="Semaine du"><input type="date" required value={budgetForm.weekStart} onChange={(e) => setBudgetForm({ ...budgetForm, weekStart: e.target.value })} className={inputClass} /></Field>
            <Field label="Budget encaissements"><input type="number" min="0" step="0.01" required value={budgetForm.inflowBudget} onChange={(e) => setBudgetForm({ ...budgetForm, inflowBudget: e.target.value })} className={inputClass} placeholder="0 MAD" /></Field>
            <Field label="Budget décaissements"><input type="number" min="0" step="0.01" required value={budgetForm.outflowBudget} onChange={(e) => setBudgetForm({ ...budgetForm, outflowBudget: e.target.value })} className={inputClass} placeholder="0 MAD" /></Field>
            <Field label="Note"><input value={budgetForm.notes} onChange={(e) => setBudgetForm({ ...budgetForm, notes: e.target.value })} className={inputClass} placeholder="Hypothèse ou action" /></Field>
            <button disabled={busy} className="btn btn-primary btn-sm h-9 disabled:opacity-50">{busy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Enregistrer</button>
          </form>
        </div>
      )}

      {panel === "accounts" && (
        <div className="p-4">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <div className="bg-[#111621] p-4 text-white"><p className="text-[9.5px] uppercase tracking-[0.08em] text-white/45">Liquidité avec découvert</p><p className="mt-2 text-[20px] font-bold">{mad(liquidity)}</p></div>
            <div className="border border-black/[0.08] p-4"><p className="text-[9.5px] uppercase tracking-[0.08em] text-[#8A8F98]">Financement disponible</p><p className="mt-2 text-[20px] font-bold text-[#1A1A2E]">{mad(financingAvailable)}</p></div>
            <button type="button" onClick={() => setAccountFormOpen(true)} className="flex min-h-[86px] items-center justify-center gap-2 border border-dashed border-[#C8924A] bg-[#FFFBF4] text-[11px] font-semibold text-[#8A5E25]"><Plus size={15} />Ajouter un compte ou financement</button>
          </div>

          {accounts.length ? <div className="mt-4 grid grid-cols-1 gap-2.5 lg:grid-cols-2">{accounts.map((account) => {
            const available = Number(account.current_balance) + Number(account.overdraft_limit) + Math.max(Number(account.financing_limit) - Number(account.financing_used), 0);
            return <div key={account.id} className="border border-black/[0.08] p-3.5"><div className="flex items-start justify-between gap-3"><div className="flex gap-2.5"><div className="flex h-8 w-8 items-center justify-center bg-[#F3EADF] text-[#8A5E25]">{account.account_type === "financing" ? <CreditCard size={15} /> : <WalletCards size={15} />}</div><div><p className="text-[11.5px] font-bold text-[#242836]">{account.name}</p><p className="text-[9.5px] text-[#9CA3AF]">{account.bank_name || (account.account_type === "cash" ? "Caisse" : "Compte de trésorerie")}</p></div></div><p className={`text-[13px] font-bold ${Number(account.current_balance) < 0 ? "text-[#B91C1C]" : "text-[#1A1A2E]"}`}>{mad(account.current_balance)}</p></div><div className="mt-3 grid grid-cols-3 gap-2 border-t border-black/[0.06] pt-2.5 text-[9.5px]"><div><p className="text-[#9CA3AF]">Découvert</p><p className="mt-0.5 font-semibold text-[#525866]">{mad(account.overdraft_limit)}</p></div><div><p className="text-[#9CA3AF]">Financement utilisé</p><p className="mt-0.5 font-semibold text-[#525866]">{mad(account.financing_used)}</p></div><div><p className="text-[#9CA3AF]">Disponible total</p><p className="mt-0.5 font-semibold text-[#047857]">{mad(available)}</p></div></div></div>;
          })}</div> : <div className="mt-4 border border-dashed border-black/[0.12] py-8 text-center"><Landmark size={21} className="mx-auto text-[#C8CBD0]" /><p className="mt-2 text-[11px] font-semibold text-[#6B7280]">Aucun compte configuré</p><p className="text-[10px] text-[#9CA3AF]">Ajoutez vos comptes pour suivre soldes, découverts et financements.</p></div>}

          {accountFormOpen && <form onSubmit={saveAccount} className="relative mt-4 grid grid-cols-1 gap-2.5 border border-[#E8D8BE] bg-[#FFFBF4] p-4 sm:grid-cols-2 lg:grid-cols-4"><button type="button" onClick={() => setAccountFormOpen(false)} className="absolute right-2 top-2 text-[#9CA3AF]"><X size={15} /></button><Field label="Nom du compte"><input required value={accountForm.name} onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })} className={inputClass} placeholder="Compte Attijari" /></Field><Field label="Type"><select value={accountForm.accountType} onChange={(e) => setAccountForm({ ...accountForm, accountType: e.target.value })} className={inputClass}><option value="bank">Compte bancaire</option><option value="cash">Caisse</option><option value="credit">Ligne de crédit</option><option value="financing">Financement</option></select></Field><Field label="Banque"><input value={accountForm.bankName} onChange={(e) => setAccountForm({ ...accountForm, bankName: e.target.value })} className={inputClass} /></Field><Field label="Solde actuel"><input type="number" step="0.01" required value={accountForm.currentBalance} onChange={(e) => setAccountForm({ ...accountForm, currentBalance: e.target.value })} className={inputClass} /></Field><Field label="Plafond découvert"><input type="number" min="0" step="0.01" value={accountForm.overdraftLimit} onChange={(e) => setAccountForm({ ...accountForm, overdraftLimit: e.target.value })} className={inputClass} /></Field><Field label="Ligne de financement"><input type="number" min="0" step="0.01" value={accountForm.financingLimit} onChange={(e) => setAccountForm({ ...accountForm, financingLimit: e.target.value })} className={inputClass} /></Field><Field label="Financement utilisé"><input type="number" min="0" step="0.01" value={accountForm.financingUsed} onChange={(e) => setAccountForm({ ...accountForm, financingUsed: e.target.value })} className={inputClass} /></Field><Field label="Taux annuel %"><input type="number" min="0" step="0.01" value={accountForm.annualRate} onChange={(e) => setAccountForm({ ...accountForm, annualRate: e.target.value })} className={inputClass} /></Field><div className="sm:col-span-2 lg:col-span-4"><button disabled={busy} className="btn btn-primary btn-sm disabled:opacity-50">{busy ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}Enregistrer le compte</button></div></form>}

          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div><h3 className="mb-2 text-[11.5px] font-bold text-[#242836]">Virement inter-comptes</h3>{accounts.length >= 2 ? <form onSubmit={createTransfer} className="space-y-2.5 border border-black/[0.08] p-3"><div className="grid grid-cols-2 gap-2"><Field label="Depuis"><select required value={transferForm.fromAccountId} onChange={(e) => setTransferForm({ ...transferForm, fromAccountId: e.target.value })} className={inputClass}><option value="">Sélectionner</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></Field><Field label="Vers"><select required value={transferForm.toAccountId} onChange={(e) => setTransferForm({ ...transferForm, toAccountId: e.target.value })} className={inputClass}><option value="">Sélectionner</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></Field></div><div className="grid grid-cols-2 gap-2"><Field label="Montant"><input required type="number" min="0.01" step="0.01" value={transferForm.amount} onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })} className={inputClass} /></Field><Field label="Date"><input required type="date" value={transferForm.transferDate} onChange={(e) => setTransferForm({ ...transferForm, transferDate: e.target.value })} className={inputClass} /></Field></div><Field label="Référence"><input value={transferForm.reference} onChange={(e) => setTransferForm({ ...transferForm, reference: e.target.value })} className={inputClass} /></Field><button disabled={busy} className="btn btn-primary btn-sm disabled:opacity-50"><Repeat2 size={13} />Enregistrer le virement</button></form> : <p className="border border-dashed border-black/[0.12] p-4 text-[10.5px] text-[#8A8F98]">Deux comptes sont nécessaires pour enregistrer un virement interne.</p>}</div>
            <div><h3 className="mb-2 text-[11.5px] font-bold text-[#242836]">Derniers virements</h3><div className="border border-black/[0.08]">{transfers.length ? transfers.map((transfer) => <div key={transfer.id} className="flex items-center justify-between gap-2 border-b border-black/[0.06] px-3 py-2.5 last:border-0"><div className="min-w-0"><p className="truncate text-[10.5px] font-semibold text-[#525866]">{relationName(transfer.from_account)} → {relationName(transfer.to_account)}</p><p className="text-[9.5px] text-[#9CA3AF]">{new Date(`${transfer.transfer_date}T12:00:00`).toLocaleDateString("fr-MA")}{transfer.reference ? ` · ${transfer.reference}` : ""}</p></div><p className="shrink-0 text-[10.5px] font-bold text-[#1A1A2E]">{mad(transfer.amount)}</p></div>) : <p className="p-4 text-[10.5px] text-[#9CA3AF]">Aucun virement enregistré.</p>}</div></div>
          </div>
        </div>
      )}

      {panel === "intelligence" && (
        <div className="grid grid-cols-1 gap-5 p-4 xl:grid-cols-3">
          <div><div className="mb-3 flex items-center gap-2"><BrainCircuit size={15} className="text-[#C8924A]" /><div><h2 className="text-[12px] font-bold text-[#1A1A2E]">Créances à prioriser</h2><p className="text-[9.5px] text-[#9CA3AF]">Score montant, retard et comportement</p></div></div><div className="space-y-2">{recommendations.length ? recommendations.map((item) => <Link key={item.invoiceId} href={`${basePath}/factures/${item.invoiceId}`} className="block border border-black/[0.08] p-3 hover:border-[#C8924A]"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-[10.5px] font-bold text-[#242836]">{item.client} · {item.invoiceNumber}</p><p className="mt-0.5 text-[9.5px] text-[#8A8F98]">{item.reason}</p></div><span className={`shrink-0 px-1.5 py-0.5 text-[9px] font-bold ${item.priority === "critical" ? "bg-[#FEE2E2] text-[#991B1B]" : item.priority === "high" ? "bg-[#FEF3C7] text-[#92400E]" : "bg-[#F3F4F6] text-[#6B7280]"}`}>{item.score}/100</span></div><div className="mt-2 flex items-center justify-between"><span className="text-[10.5px] font-bold text-[#1A1A2E]">{mad(item.amount)}</span><span className="flex items-center gap-1 text-[9.5px] font-semibold text-[#8A5E25]">Relancer <ArrowRight size={9} /></span></div></Link>) : <p className="border border-dashed border-black/[0.12] p-4 text-[10.5px] text-[#9CA3AF]">Aucune créance ouverte à prioriser.</p>}</div></div>

          <div><div className="mb-3 flex items-center gap-2"><RefreshCw size={15} className="text-[#C8924A]" /><div><h2 className="text-[12px] font-bold text-[#1A1A2E]">Dépenses récurrentes détectées</h2><p className="text-[9.5px] text-[#9CA3AF]">Cadence et montant issus des transactions</p></div></div><div className="space-y-2">{recurringExpenses.length ? recurringExpenses.map((item) => <div key={item.key} className="border border-black/[0.08] p-3"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-[10.5px] font-bold text-[#242836]">{item.label}</p><p className="text-[9.5px] text-[#9CA3AF]">{item.occurrences} occurrences · environ tous les {item.intervalDays} jours</p></div><span className={`shrink-0 h-2 w-2 rounded-full ${item.confidence === "high" ? "bg-[#10B981]" : "bg-[#F59E0B]"}`} title={`Confiance ${item.confidence}`} /></div><div className="mt-2 flex items-center justify-between"><span className="text-[10.5px] font-bold text-[#B91C1C]">{mad(item.averageAmount)}</span><span className="text-[9.5px] text-[#6B7280]">Prochaine : {new Date(`${item.nextDate}T12:00:00`).toLocaleDateString("fr-MA")}</span></div></div>) : <p className="border border-dashed border-black/[0.12] p-4 text-[10.5px] text-[#9CA3AF]">Pas encore assez d’historique pour détecter une cadence fiable.</p>}</div></div>

          <div><div className="mb-3 flex items-center gap-2"><ShieldAlert size={15} className="text-[#C8924A]" /><div><h2 className="text-[12px] font-bold text-[#1A1A2E]">Comportement de paiement</h2><p className="text-[9.5px] text-[#9CA3AF]">Prédiction fondée sur les factures soldées</p></div></div><div className="space-y-2">{paymentBehaviors.length ? paymentBehaviors.slice(0, 8).map((item) => <div key={item.clientId} className="border border-black/[0.08] p-3"><div className="flex items-center justify-between gap-2"><p className="truncate text-[10.5px] font-bold text-[#242836]">{item.name}</p><span className={`px-1.5 py-0.5 text-[9px] font-bold ${item.risk === "high" ? "bg-[#FEE2E2] text-[#991B1B]" : item.risk === "medium" ? "bg-[#FEF3C7] text-[#92400E]" : "bg-[#D1FAE5] text-[#065F46]"}`}>{item.risk === "high" ? "Risque élevé" : item.risk === "medium" ? "À surveiller" : "Fiable"}</span></div><div className="mt-2 grid grid-cols-3 gap-2 text-[9.5px]"><div><p className="text-[#9CA3AF]">Retard moyen</p><p className="font-semibold text-[#525866]">{Math.max(item.averageDelayDays, 0)} j</p></div><div><p className="text-[#9CA3AF]">À l’heure</p><p className="font-semibold text-[#525866]">{item.onTimeRate}%</p></div><div><p className="text-[#9CA3AF]">Historique</p><p className="font-semibold text-[#525866]">{item.paidInvoices} facture{item.paidInvoices > 1 ? "s" : ""}</p></div></div></div>) : <p className="border border-dashed border-black/[0.12] p-4 text-[10.5px] text-[#9CA3AF]">Les prédictions apparaîtront après les premiers encaissements datés.</p>}</div><div className="mt-3 flex gap-2 bg-[#F8F8F5] p-3 text-[9.5px] leading-4 text-[#6B7280]"><BrainCircuit size={13} className="mt-0.5 shrink-0 text-[#C8924A]" /><p>Les recommandations sont explicables et recalculées depuis vos données. Elles ne déclenchent aucune relance automatiquement.</p></div></div>
        </div>
      )}
    </section>
  );
}
