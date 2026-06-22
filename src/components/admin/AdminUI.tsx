"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, Plus, RefreshCw, X } from "lucide-react";

const PLANS = [
  { value: "trial", label: "Essai", price: 0 },
  { value: "starter", label: "Starter", price: 99 },
  { value: "business", label: "Business", price: 229 },
  { value: "business_pro", label: "Business Pro", price: 449 },
  { value: "comptable_s", label: "Comptable Starter", price: 299 },
  { value: "comptable_pro", label: "Comptable Pro", price: 599 },
  { value: "comptable_inf", label: "Comptable Illimité", price: 999 },
];

export function StatusBadge({ status }: { status?: string | null }) {
  const map: Record<string, string> = { active: "bg-emerald-50 text-emerald-700", approved: "bg-emerald-50 text-emerald-700", pending: "bg-amber-50 text-amber-700", rejected: "bg-red-50 text-red-700", trial: "bg-amber-50 text-amber-700", grace: "bg-orange-50 text-orange-700", expired: "bg-red-50 text-red-700", suspended: "bg-gray-200 text-gray-700", banned: "bg-red-50 text-red-700", invited: "bg-blue-50 text-blue-700", nouveau: "bg-blue-50 text-blue-700", contacté: "bg-amber-50 text-amber-700", finalisé: "bg-emerald-50 text-emerald-700", cancelled: "bg-gray-100 text-gray-600" };
  return <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${map[status ?? ""] ?? "bg-gray-100 text-gray-600"}`}>{status || "—"}</span>;
}

export function CreateAccountButton({ prefill, waitlistId }: { prefill?: { email?: string; name?: string; company?: string }; waitlistId?: string }) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState("");
  async function submit(form: HTMLFormElement) {
    const response = await fetch("/api/admin/accounts/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(form))) });
    const data = await response.json();
    if (!response.ok) return setResult(data.message || "Erreur");
    setResult(`Compte créé. Lien mot de passe : ${data.recoveryLink}`);
  }
  return <>
    <button onClick={() => setOpen(true)} className="inline-flex min-h-9 items-center gap-1.5 rounded bg-[#C8924A] px-3 text-[11px] font-bold text-white"><Plus size={13} /> Créer un compte</button>
    {open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0D1526]/50 p-4"><div className="w-full max-w-lg rounded-lg bg-white p-5">
      <div className="flex justify-between"><h2 className="text-[15px] font-bold">Créer un compte</h2><button onClick={() => setOpen(false)}><X size={17} /></button></div>
      <form className="mt-5 grid gap-3 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); void submit(e.currentTarget); }}>
        {waitlistId && <input type="hidden" name="waitlist_id" value={waitlistId} />}
        <label className="sm:col-span-2 text-[11px] font-semibold">Email *<input name="email" type="email" required defaultValue={prefill?.email} className="input mt-1" /></label>
        <label className="text-[11px] font-semibold">Nom complet<input name="full_name" defaultValue={prefill?.name} className="input mt-1" /></label>
        <label className="text-[11px] font-semibold">Raison sociale *<input name="raison_sociale" required defaultValue={prefill?.company} className="input mt-1" /></label>
        <label className="text-[11px] font-semibold">Type<select name="user_type" className="input mt-1"><option value="entrepreneur">Entrepreneur</option><option value="fiduciaire">Comptable</option></select></label>
        <label className="text-[11px] font-semibold">Plan<select name="plan" className="input mt-1"><option>starter</option><option>business</option><option>business_pro</option><option>comptable_s</option><option>comptable_pro</option><option>comptable_inf</option></select></label>
        <label className="text-[11px] font-semibold">Durée essai<input name="trial_days" type="number" defaultValue="7" className="input mt-1" /></label>
        <label className="sm:col-span-2 text-[11px] font-semibold">Notes internes<textarea name="admin_notes" className="input mt-1 min-h-20" /></label>
        <button className="sm:col-span-2 rounded bg-[#C8924A] px-4 py-2.5 text-[12px] font-bold text-white">Créer</button>
      </form>
      {result && <p className="mt-4 break-all rounded bg-[#FAFAF6] p-3 text-[11px]">{result}</p>}
    </div></div>}
  </>;
}

export function AdminAction({ endpoint, body, label, danger = false, reload = true }: { endpoint: string; body?: Record<string, unknown>; label: string; danger?: boolean; reload?: boolean }) {
  const [loading, setLoading] = useState(false);
  async function run() {
    if (danger && !window.confirm(`${label} ?`)) return;
    setLoading(true);
    const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
    setLoading(false);
    if (!response.ok) return alert((await response.json()).message || "Erreur");
    if (reload) window.location.reload();
  }
  return <button onClick={run} disabled={loading} className={`rounded border px-2.5 py-1.5 text-[10.5px] font-semibold ${danger ? "border-red-200 text-red-600" : "border-black/10 text-[#374151]"}`}>{loading ? "..." : label}</button>;
}

export function AccountActions({ id, name, currentPlan }: { id: string; name?: string | null; currentPlan?: string | null }) {
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState(currentPlan ?? "trial");
  const [period, setPeriod] = useState("monthly");
  const [amount, setAmount] = useState(PLANS.find(item => item.value === currentPlan)?.price ?? 0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  function choosePlan(value: string) {
    setPlan(value);
    const monthly = PLANS.find(item => item.value === value)?.price ?? 0;
    setAmount(period === "annual" ? monthly * 10 : monthly);
  }

  function choosePeriod(value: string) {
    setPeriod(value);
    const monthly = PLANS.find(item => item.value === plan)?.price ?? 0;
    setAmount(value === "annual" ? monthly * 10 : monthly);
  }

  async function submit(form: HTMLFormElement) {
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/admin/accounts/${id}/plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(new FormData(form))),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return setMessage(data.message || "Le changement de plan a échoué.");
    setMessage(data.scheduled ? `Changement programmé pour le ${data.effectiveDate}.` : "Plan modifié avec succès.");
    window.setTimeout(() => window.location.reload(), 700);
  }

  return <>
    <div className="flex items-center justify-end gap-1.5">
      <Link href={`/admin/comptes/${id}`} className="inline-flex items-center gap-1 rounded border border-black/10 px-2 py-1.5 text-[10px] font-semibold text-gray-700"><ExternalLink size={11} /> Ouvrir</Link>
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1 rounded bg-[#0D1526] px-2 py-1.5 text-[10px] font-semibold text-white"><RefreshCw size={11} /> Changer de plan</button>
    </div>
    {open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0D1526]/55 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between"><div><h2 className="text-base font-bold">Changer le plan</h2><p className="mt-1 text-xs text-gray-500">{name || "Compte"} · plan actuel : {currentPlan || "trial"}</p></div><button onClick={() => setOpen(false)} title="Fermer"><X size={18} /></button></div>
        <form className="mt-5 grid gap-3 sm:grid-cols-2" onSubmit={event => { event.preventDefault(); void submit(event.currentTarget); }}>
          <label className="text-[11px] font-semibold">Nouveau plan<select name="plan" value={plan} onChange={event => choosePlan(event.target.value)} className="input mt-1">{PLANS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label className="text-[11px] font-semibold">Période<select name="billing_period" value={period} onChange={event => choosePeriod(event.target.value)} className="input mt-1"><option value="monthly">Mensuel</option><option value="annual">Annuel</option></select></label>
          <label className="text-[11px] font-semibold">Montant MAD<input name="amount_mad" type="number" value={amount} onChange={event => setAmount(Number(event.target.value))} className="input mt-1" /></label>
          <label className="text-[11px] font-semibold">Mode de paiement<select name="payment_method" className="input mt-1"><option value="virement">Virement</option><option value="cmi">CMI</option><option value="especes">Espèces</option><option value="gratuit">Gratuit</option></select></label>
          <label className="text-[11px] font-semibold sm:col-span-2">Référence paiement<input name="payment_reference" className="input mt-1" /></label>
          <p className="sm:col-span-2 text-[10px] text-gray-500">Les upgrades sont appliqués immédiatement. Un downgrade est programmé à la fin de la période actuelle.</p>
          <button disabled={busy || plan === currentPlan} className="sm:col-span-2 rounded bg-[#C8924A] px-4 py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">{busy ? "Application..." : "Confirmer le changement"}</button>
        </form>
        {message && <p className={`mt-3 rounded p-3 text-xs font-semibold ${message.includes("succès") || message.includes("programmé") ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{message}</p>}
      </div>
    </div>}
  </>;
}
