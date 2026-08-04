"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, Plus, X } from "lucide-react";

export function StatusBadge({ status }: { status?: string | null }) {
  const map: Record<string, string> = { active: "bg-emerald-50 text-emerald-700", actif: "bg-emerald-50 text-emerald-700", approved: "bg-emerald-50 text-emerald-700", free: "bg-sky-50 text-sky-700", pending: "bg-amber-50 text-amber-700", rejected: "bg-red-50 text-red-700", trial: "bg-amber-50 text-amber-700", grace: "bg-orange-50 text-orange-700", expired: "bg-red-50 text-red-700", suspended: "bg-gray-200 text-gray-700", inactif: "bg-gray-200 text-gray-700", banned: "bg-red-50 text-red-700", invited: "bg-blue-50 text-blue-700", nouveau: "bg-blue-50 text-blue-700", contacté: "bg-amber-50 text-amber-700", finalisé: "bg-emerald-50 text-emerald-700", cancelled: "bg-gray-100 text-gray-600" };
  return <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${map[status ?? ""] ?? "bg-gray-100 text-gray-600"}`}>{status || "—"}</span>;
}

export function CreateAccountButton({ prefill, waitlistId }: { prefill?: { email?: string; name?: string; company?: string; phone?: string }; waitlistId?: string }) {
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
        <label className="sm:col-span-2 text-[11px] font-semibold">Téléphone *<input name="phone" type="tel" autoComplete="tel" required defaultValue={prefill?.phone} placeholder="+212 6 12 34 56 78" className="input mt-1" /></label>
        <label className="text-[11px] font-semibold">Type<select name="user_type" className="input mt-1"><option value="entrepreneur">Entrepreneur</option><option value="fiduciaire">Comptable</option></select></label>
        <input type="hidden" name="plan" value="trial" />
        <div className="text-[11px] font-semibold">Accès initial<div className="input mt-1 flex items-center bg-[#FAFAF6] text-gray-500">Version gratuite limitée</div></div>
        <label className="text-[11px] font-semibold">Durée essai<input name="trial_days" type="number" defaultValue="7" className="input mt-1" /></label>
        <label className="sm:col-span-2 text-[11px] font-semibold">Notes internes<textarea name="admin_notes" className="input mt-1 min-h-20" /></label>
        <button className="sm:col-span-2 rounded bg-[#C8924A] px-4 py-2.5 text-[12px] font-bold text-white">Créer</button>
      </form>
      {result && <p className="mt-4 break-all rounded bg-[#FAFAF6] p-3 text-[11px]">{result}</p>}
    </div></div>}
  </>;
}

export function ActivateSignupButton({ waitlistId }: { waitlistId: string }) {
  const [loading, setLoading] = useState(false);

  async function activate() {
    if (!window.confirm("Activer ce compte et démarrer son accès maintenant ?")) return;
    setLoading(true);
    const response = await fetch(`/api/admin/waitlist/${waitlistId}/approve`, { method: "POST" });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) {
      alert(data.message || "Activation impossible.");
      return;
    }
    window.location.reload();
  }

  return (
    <button
      onClick={activate}
      disabled={loading}
      className="inline-flex min-h-8 items-center rounded bg-[#C8924A] px-3 text-[10.5px] font-bold text-white disabled:opacity-60"
    >
      {loading ? "Activation..." : "Activer le compte"}
    </button>
  );
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

export function AccountActions({ id }: { id: string; name?: string | null; currentPlan?: string | null }) {
  return <Link href={`/admin/comptes/${id}`} className="inline-flex items-center gap-1 rounded bg-[#0D1526] px-2.5 py-1.5 text-[10px] font-semibold text-white"><ExternalLink size={11} /> Gérer</Link>;
}
