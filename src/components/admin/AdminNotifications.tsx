"use client";

import { useState } from "react";

type Option = { id: string; label: string };

async function post(url: string, body: unknown) {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Action impossible");
  window.location.reload();
}

export function NotificationComposer({ users, companies, initialCompanyIds = [], initialUserIds = [] }: { users: Option[]; companies: Option[]; initialCompanyIds?: string[]; initialUserIds?: string[] }) {
  const [audienceType, setAudienceType] = useState(initialUserIds.length ? "users" : initialCompanyIds.length ? "companies" : "all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(form: HTMLFormElement, mode: "draft" | "send") {
    setBusy(true); setError("");
    const values = new FormData(form);
    const audience: Record<string, unknown> = { type: audienceType };
    if (audienceType === "users") audience.user_ids = values.getAll("user_ids");
    if (audienceType === "companies") audience.company_ids = values.getAll("company_ids");
    if (audienceType === "segment") {
      for (const key of ["user_type", "plan", "status"]) if (values.get(key)) audience[key] = values.get(key);
      for (const key of ["inactive_days", "trial_expiring_days"]) if (values.get(key)) audience[key] = Number(values.get(key));
    }
    try {
      await post("/api/admin/notifications", {
        title: values.get("title"), message: values.get("message"), link: values.get("link"),
        priority: values.get("priority"), category: values.get("category"), channel: values.get("channel"),
        scheduled_at: values.get("scheduled_at"), audience, mode,
      });
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : "Action impossible"); setBusy(false); }
  }

  return (
    <form className="grid gap-3" onSubmit={event => { event.preventDefault(); void submit(event.currentTarget, "send"); }}>
      <div className="grid gap-3 lg:grid-cols-2">
        <label className="text-[11px] font-semibold">Titre<input name="title" required maxLength={120} className="input mt-1 text-xs" /></label>
        <label className="text-[11px] font-semibold">Lien dans l’application<input name="link" placeholder="/tableau-de-bord" className="input mt-1 text-xs" /></label>
      </div>
      <label className="text-[11px] font-semibold">Message<textarea name="message" required maxLength={1500} className="input mt-1 min-h-24 text-xs" /></label>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <label className="text-[11px] font-semibold">Canal<select name="channel" className="input mt-1 text-xs"><option value="in_app">Dans l’application</option><option value="email">Email</option><option value="both">Application + email</option></select></label>
        <label className="text-[11px] font-semibold">Catégorie<select name="category" className="input mt-1 text-xs">{["service", "billing", "compliance", "support", "product", "marketing"].map(value => <option key={value}>{value}</option>)}</select></label>
        <label className="text-[11px] font-semibold">Priorité<select name="priority" className="input mt-1 text-xs"><option value="normal">Normale</option><option value="high">Haute</option></select></label>
        <label className="text-[11px] font-semibold">Audience<select value={audienceType} onChange={event => setAudienceType(event.target.value)} className="input mt-1 text-xs"><option value="all">Tous les utilisateurs</option><option value="users">Utilisateurs précis</option><option value="companies">Comptes précis</option><option value="segment">Segment</option></select></label>
        <label className="text-[11px] font-semibold">Programmer<input name="scheduled_at" type="datetime-local" className="input mt-1 text-xs" /></label>
      </div>
      {audienceType === "users" && <label className="text-[11px] font-semibold">Utilisateurs<select name="user_ids" multiple required defaultValue={initialUserIds} className="input mt-1 min-h-28 text-xs">{users.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>}
      {audienceType === "companies" && <label className="text-[11px] font-semibold">Comptes<select name="company_ids" multiple required defaultValue={initialCompanyIds} className="input mt-1 min-h-28 text-xs">{companies.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>}
      {audienceType === "segment" && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <label className="text-[11px] font-semibold">Type<select name="user_type" className="input mt-1 text-xs"><option value="">Tous</option><option value="entrepreneur">Entrepreneur</option><option value="fiduciaire">Fiduciaire</option></select></label>
        <label className="text-[11px] font-semibold">Tarif<input name="plan" placeholder="entreprise ou cabinet" className="input mt-1 text-xs" /></label>
        <label className="text-[11px] font-semibold">Statut<select name="status" className="input mt-1 text-xs"><option value="">Tous</option>{["free", "trial", "active", "grace", "expired", "suspended"].map(value => <option key={value}>{value}</option>)}</select></label>
        <label className="text-[11px] font-semibold">Inactifs depuis (jours)<input name="inactive_days" type="number" min="1" className="input mt-1 text-xs" /></label>
        <label className="text-[11px] font-semibold">Essai expire sous (jours)<input name="trial_expiring_days" type="number" min="1" className="input mt-1 text-xs" /></label>
      </div>}
      {error && <p className="rounded bg-red-50 p-2 text-[11px] text-red-700">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button disabled={busy} className="rounded bg-[#C8924A] px-4 py-2 text-xs font-bold text-white">{busy ? "Traitement…" : "Envoyer / programmer"}</button>
        <button type="button" disabled={busy} onClick={event => void submit(event.currentTarget.form!, "draft")} className="rounded border border-black/15 px-4 py-2 text-xs font-semibold">Enregistrer en brouillon</button>
      </div>
    </form>
  );
}

export function CampaignAction({ id, action, label, danger = false }: { id: string; action: "send" | "retry" | "cancel"; label: string; danger?: boolean }) {
  const [busy, setBusy] = useState(false);
  return <button disabled={busy} onClick={() => { if (danger && !window.confirm(`${label} ?`)) return; setBusy(true); void post(`/api/admin/notifications/${id}`, { action }).catch(error => { alert(error.message); setBusy(false); }); }} className={`rounded border px-2 py-1 text-[10px] font-semibold ${danger ? "border-red-200 text-red-700" : "border-black/10"}`}>{busy ? "…" : label}</button>;
}
