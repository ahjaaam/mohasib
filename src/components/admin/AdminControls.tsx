"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

async function post(endpoint: string, body: Record<string, unknown>) {
  const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Action impossible");
  window.location.reload();
}

const NUMERIC_LIMITS = [
  ["ocr_limit", "Documents OCR / mois"],
  ["storage_gb", "Stockage (Go)"],
  ["dossiers_limit", "Espaces clients"],
  ["users_limit", "Utilisateurs / collaborateurs"],
  ["employee_limit", "Employés en paie"],
] as const;

const FEATURE_LIMITS = [
  ["has_bank_import", "Import et rapprochement bancaire"],
  ["has_saisie", "Saisie et écritures automatiques"],
  ["has_paie", "Paie"],
  ["has_export_fiduciaire", "Exports comptables"],
  ["has_avoirs", "Avoirs"],
  ["has_bilan", "Bilan et CPC"],
  ["has_tva_edi", "EDI TVA"],
  ["has_inbox_global", "Inbox globale cabinet"],
  ["has_mass_declarations", "Déclarations de masse"],
  ["has_whatsapp_agent", "Agent WhatsApp"],
] as const;

export function AccountControls({
  company,
  override,
  effectiveLimits,
}: {
  company: Record<string, any>;
  override?: Record<string, any> | null;
  effectiveLimits: Record<string, any>;
}) {
  const [busy, setBusy] = useState(false);
  const run = async (endpoint: string, body: Record<string, unknown>) => {
    setBusy(true);
    try { await post(endpoint, body); } catch (error) { alert(error instanceof Error ? error.message : "Erreur"); setBusy(false); }
  };
  return <div className="space-y-4">
    <section className="rounded-md border border-black/10 bg-white p-4">
      <h2 className="text-sm font-bold">Identité du compte</h2>
      <form className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-6" onSubmit={event => {
        event.preventDefault();
        void run(`/api/admin/accounts/${company.id}/identity`, Object.fromEntries(new FormData(event.currentTarget)));
      }}>
        <label className="text-[10.5px] font-semibold text-gray-600">Raison sociale<input name="raison_sociale" required defaultValue={company.raison_sociale ?? ""} className="input mt-1 text-xs" /></label>
        <label className="text-[10.5px] font-semibold text-gray-600">Email de contact<input name="email" type="email" defaultValue={company.email ?? ""} className="input mt-1 text-xs" /></label>
        <label className="text-[10.5px] font-semibold text-gray-600">Téléphone<input name="phone" defaultValue={company.phone ?? ""} className="input mt-1 text-xs" /></label>
        <label className="text-[10.5px] font-semibold text-gray-600">ICE<input name="ice" defaultValue={company.ice ?? ""} className="input mt-1 text-xs" /></label>
        <label className="text-[10.5px] font-semibold text-gray-600">IF<input name="if_number" defaultValue={company.if_number ?? ""} className="input mt-1 text-xs" /></label>
        <label className="text-[10.5px] font-semibold text-gray-600">Ville<input name="city" defaultValue={company.city ?? ""} className="input mt-1 text-xs" /></label>
        <button disabled={busy} className="rounded border border-black/15 px-3 py-2 text-xs font-bold sm:col-span-2 xl:col-span-6">Mettre à jour l’identité</button>
      </form>
    </section>
    <section className="rounded-md border border-[#C8924A]/30 bg-white p-4 shadow-sm">
      <div>
        <h2 className="text-sm font-bold">Droits et limites du compte</h2>
        <p className="mt-1 text-[11px] text-gray-500">Configuration principale appliquée au compte, à ses collaborateurs et à tous ses espaces clients. Utilisez −1 pour une limite illimitée, sauf pour le nombre d’utilisateurs.</p>
      </div>
      <form className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5" onSubmit={event => {
        event.preventDefault();
        void run(`/api/admin/accounts/${company.id}/limits`, Object.fromEntries(new FormData(event.currentTarget)));
      }}>
        {NUMERIC_LIMITS.map(([field, label]) => (
          <label key={field} className="text-[10.5px] font-semibold text-gray-600">
            {label}
            <input name={field} type="number" min={field === "users_limit" ? 1 : -1} required defaultValue={override?.[field] ?? effectiveLimits[field] ?? 0} className="input mt-1 text-xs" />
          </label>
        ))}
        <div className="grid gap-2 sm:col-span-2 sm:grid-cols-2 xl:col-span-5 xl:grid-cols-5">
          {FEATURE_LIMITS.map(([field, label]) => (
            <label key={field} className="text-[10.5px] font-semibold text-gray-600">
              {label}
              <select name={field} defaultValue={String(override?.[field] ?? effectiveLimits[field] ?? false)} className="input mt-1 text-xs">
                <option value="true">Activé</option>
                <option value="false">Désactivé</option>
              </select>
            </label>
          ))}
        </div>
        <label className="text-[10.5px] font-semibold text-gray-600 sm:col-span-2 xl:col-span-2">
          Motif / référence interne
          <input name="reason" required defaultValue={override?.reason ?? "Configuration directe du compte"} className="input mt-1 text-xs" />
        </label>
        <label className="text-[10.5px] font-semibold text-gray-600">
          Expiration des droits
          <input name="expires_at" type="date" defaultValue={override?.expires_at ?? ""} className="input mt-1 text-xs" />
        </label>
        <button disabled={busy} className="rounded bg-[#0D1526] px-3 py-2 text-xs font-bold text-white sm:col-span-2 xl:col-span-2">Enregistrer tous les droits</button>
      </form>
    </section>
    <section className="rounded-md border border-black/10 bg-white p-4">
      <h2 className="text-sm font-bold">Abonnement et accès</h2>
      <p className="mt-1 text-[11px] text-gray-500">Le statut active ou bloque les droits configurés ci-dessus, sans sélectionner de package.</p>
      <form className="mt-3 grid gap-2 sm:grid-cols-3 xl:grid-cols-6" onSubmit={event => {
        event.preventDefault();
        void run(`/api/admin/accounts/${company.id}/access`, Object.fromEntries(new FormData(event.currentTarget)));
      }}>
        <select name="status" defaultValue={company.subscription_status ?? "trial"} className="input text-xs">
          <option value="free">Mohasib Gratuit</option>
          <option value="trial">Essai gratuit limité</option>
          <option value="active">Actif</option>
          <option value="grace">Délai de grâce</option>
          <option value="expired">Expiré</option>
        </select>
        <input name="ends_at" type="date" defaultValue={company.subscription_ends_at ?? company.trial_ends_at?.slice(0, 10) ?? ""} className="input text-xs" />
        <select name="billing_period" className="input text-xs"><option value="monthly">Mensuel</option><option value="annual">Annuel</option></select>
        <input name="amount_mad" type="number" min="0" step="0.01" placeholder="Montant MAD" className="input text-xs" />
        <select name="payment_method" className="input text-xs"><option value="">Mode de paiement</option><option value="virement">Virement</option><option value="cmi">CMI</option><option value="especes">Espèces</option><option value="gratuit">Gratuit</option></select>
        <input name="payment_reference" placeholder="Référence paiement" className="input text-xs" />
        <button disabled={busy} className="rounded bg-[#0D1526] px-3 py-2 text-xs font-bold text-white sm:col-span-3 xl:col-span-6">Mettre à jour l’accès</button>
      </form>
    </section>
    <section className="rounded-md border border-black/10 bg-white p-4">
      <h2 className="text-sm font-bold">Notes et état du compte</h2>
      <form className="mt-3 flex gap-2" onSubmit={event => {
        event.preventDefault();
        void run(`/api/admin/accounts/${company.id}/notes`, Object.fromEntries(new FormData(event.currentTarget)));
      }}>
        <textarea name="notes" defaultValue={company.admin_notes ?? ""} className="input min-h-20 flex-1 text-xs" />
        <button disabled={busy} className="rounded border border-black/15 px-3 text-xs font-semibold">Sauvegarder</button>
      </form>
      <form className="mt-3 flex gap-2" onSubmit={event => {
        event.preventDefault();
        const body = Object.fromEntries(new FormData(event.currentTarget));
        void run(`/api/admin/accounts/${company.id}/suspension`, { ...body, suspended: !company.is_suspended });
      }}>
        {!company.is_suspended && <input name="reason" required placeholder="Motif de suspension" className="input flex-1 text-xs" />}
        <button disabled={busy} className={`rounded px-3 py-2 text-xs font-bold text-white ${company.is_suspended ? "bg-emerald-600" : "bg-red-600"}`}>{company.is_suspended ? "Réactiver le compte" : "Suspendre le compte"}</button>
      </form>
    </section>
    <section className="rounded-md border border-black/10 bg-white p-4">
      <h2 className="text-sm font-bold">Pilotage interne</h2>
      <p className="mt-1 text-[11px] text-gray-500">Classez le compte, assignez un responsable et signalez les comptes à risque.</p>
      <form className="mt-3 grid gap-3 sm:grid-cols-3" onSubmit={event => {
        event.preventDefault();
        void run(`/api/admin/accounts/${company.id}/metadata`, Object.fromEntries(new FormData(event.currentTarget)));
      }}>
        <label className="text-[10.5px] font-semibold text-gray-600">Étape du cycle<select name="lifecycle_stage" defaultValue={company.lifecycle_stage ?? "active"} className="input mt-1 text-xs"><option value="lead">Lead</option><option value="onboarding">Onboarding</option><option value="active">Actif</option><option value="at_risk">À risque</option><option value="churned">Perdu</option><option value="archived">Archivé</option></select></label>
        <label className="text-[10.5px] font-semibold text-gray-600">Responsable interne<input name="admin_owner_email" type="email" defaultValue={company.admin_owner_email ?? ""} placeholder="responsable@mohasibai.com" className="input mt-1 text-xs" /></label>
        <label className="text-[10.5px] font-semibold text-gray-600">Tags (séparés par virgules)<input name="admin_tags" defaultValue={(company.admin_tags ?? []).join(", ")} placeholder="vip, onboarding, paiement" className="input mt-1 text-xs" /></label>
        <button disabled={busy} className="rounded border border-black/15 px-3 py-2 text-xs font-bold sm:col-span-3">Enregistrer le pilotage</button>
      </form>
    </section>
  </div>;
}

export function WorkspaceControls({ workspace }: { workspace: Record<string, any> }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(form: HTMLFormElement) {
    setBusy(true);
    try {
      await post(`/api/admin/workspaces/${workspace.id}`, Object.fromEntries(new FormData(form)));
    } catch (error) {
      alert(error instanceof Error ? error.message : "Modification impossible");
      setBusy(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={() => setOpen(current => !current)} className="rounded border border-black/10 px-2.5 py-1.5 text-[10.5px] font-semibold">
        {open ? "Fermer" : "Gérer l’espace"}
      </button>
      {open && (
        <form className="mt-3 grid gap-2 rounded border border-black/10 bg-[#FAFAF6] p-3 sm:grid-cols-2 xl:grid-cols-4" onSubmit={event => {
          event.preventDefault();
          void submit(event.currentTarget);
        }}>
          <label className="text-[10px] font-semibold text-gray-500">Raison sociale<input name="raison_sociale" required defaultValue={workspace.raison_sociale ?? ""} className="input mt-1 text-xs" /></label>
          <label className="text-[10px] font-semibold text-gray-500">Statut<select name="statut" defaultValue={workspace.statut ?? "actif"} className="input mt-1 text-xs"><option value="actif">Actif</option><option value="inactif">Inactif</option></select></label>
          <label className="text-[10px] font-semibold text-gray-500">Régime TVA<select name="regime_tva" defaultValue={workspace.regime_tva ?? "mensuel"} className="input mt-1 text-xs"><option value="mensuel">Mensuel</option><option value="trimestriel">Trimestriel</option><option value="exonere">Exonéré</option></select></label>
          <label className="text-[10px] font-semibold text-gray-500">Contact<input name="contact_nom" defaultValue={workspace.contact_nom ?? ""} className="input mt-1 text-xs" /></label>
          <label className="text-[10px] font-semibold text-gray-500">E-mail<input name="contact_email" type="email" defaultValue={workspace.contact_email ?? ""} className="input mt-1 text-xs" /></label>
          <label className="text-[10px] font-semibold text-gray-500">Téléphone<input name="contact_phone" defaultValue={workspace.contact_phone ?? ""} className="input mt-1 text-xs" /></label>
          <label className="text-[10px] font-semibold text-gray-500 sm:col-span-2">Notes<input name="notes" defaultValue={workspace.notes ?? ""} className="input mt-1 text-xs" /></label>
          <button disabled={busy} className="rounded bg-[#0D1526] px-3 py-2 text-xs font-bold text-white sm:col-span-2 xl:col-span-4">Enregistrer l’espace</button>
        </form>
      )}
    </div>
  );
}

export function DeleteAccountControl({ companyId, companyName }: { companyId: string; companyName: string }) {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const expected = companyName.trim();
  const confirmed = confirmation.trim() === expected;

  async function deleteAccount() {
    if (!confirmed || busy) return;
    if (!window.confirm("Cette suppression est définitive. Continuer ?")) return;

    setBusy(true);
    const response = await fetch(`/api/admin/accounts/${companyId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation: confirmation.trim() }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      alert(data.message || "La suppression du compte a échoué.");
      setBusy(false);
      return;
    }

    router.push("/admin/comptes");
    router.refresh();
  }

  return (
    <section className="mt-5 rounded-md border border-red-200 bg-red-50 p-4">
      <h2 className="text-sm font-bold text-red-800">Zone dangereuse</h2>
      <p className="mt-2 text-[11px] text-red-700">
        Supprime définitivement l’utilisateur Supabase Auth, son entreprise et les données liées. Cette action est irréversible.
      </p>
      <label className="mt-3 block text-[11px] font-semibold text-red-800">
        Saisissez <b>{expected}</b> pour confirmer
        <input
          value={confirmation}
          onChange={event => setConfirmation(event.target.value)}
          className="input mt-1 max-w-md bg-white text-xs"
          autoComplete="off"
        />
      </label>
      <button
        type="button"
        disabled={!confirmed || busy}
        onClick={() => void deleteAccount()}
        className="mt-3 rounded bg-red-700 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? "Suppression…" : "Supprimer définitivement le compte"}
      </button>
    </section>
  );
}

export function RequestStatus({ id, current }: { id: string; current?: string | null }) {
  return <select defaultValue={current ?? "nouveau"} className="rounded border border-black/10 bg-white px-2 py-1 text-[11px]" onChange={event => void post(`/api/admin/requests/${id}`, { status: event.target.value }).catch(error => alert(error.message))}>
    {["nouveau", "contacté", "finalisé", "cancelled"].map(value => <option key={value}>{value}</option>)}
  </select>;
}

export function TicketStatus({ id, current }: { id: string; current?: string | null }) {
  return <select defaultValue={current ?? "nouveau"} className="rounded border border-black/10 bg-white px-2 py-1 text-[11px]" onChange={event => void post(`/api/admin/support-tickets/${id}`, { status: event.target.value }).catch(error => alert(error.message))}>
    {["nouveau", "contacté", "finalisé", "cancelled"].map(value => <option key={value}>{value}</option>)}
  </select>;
}

export function MemberToggle({ id, suspended, authBanned = false }: { id: string; suspended: boolean; authBanned?: boolean }) {
  const blocked = suspended || authBanned;
  return <button className="rounded border border-black/10 px-2 py-1 text-[10px] font-semibold" onClick={() => void post(`/api/admin/members/${id}`, { suspended: !blocked }).catch(error => alert(error.message))}>{blocked ? "Réactiver" : "Suspendre"}</button>;
}

export function MemberAccessScopeSelect({ id, current }: { id: string; current?: string | null }) {
  return (
    <select
      defaultValue={current ?? "both"}
      className="rounded border border-black/10 bg-white px-2 py-1 text-[10px] font-semibold text-gray-700"
      onChange={event => void post(`/api/admin/members/${id}`, { access_scope: event.target.value }).catch(error => alert(error.message))}
    >
      <option value="business_only">Compte normal</option>
      <option value="comptable_pro_only">Comptable Pro</option>
      <option value="both">Les deux</option>
    </select>
  );
}

export function AuthUnbanButton({ id }: { id: string }) {
  return <button className="rounded border border-red-200 px-2 py-1 text-[10px] font-semibold text-red-700" onClick={() => void post(`/api/admin/members/${id}/unban`, {}).catch(error => alert(error.message))}>Débloquer Auth</button>;
}
