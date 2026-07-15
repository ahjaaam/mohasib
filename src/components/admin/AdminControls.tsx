"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

async function post(endpoint: string, body: Record<string, unknown>) {
  const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Action impossible");
  window.location.reload();
}

export function AccountControls({ company }: { company: Record<string, any> }) {
  const [busy, setBusy] = useState(false);
  const run = async (endpoint: string, body: Record<string, unknown>) => {
    setBusy(true);
    try { await post(endpoint, body); } catch (error) { alert(error instanceof Error ? error.message : "Erreur"); setBusy(false); }
  };
  return <div className="space-y-4">
    <section className="rounded-md border border-black/10 bg-white p-4">
      <h2 className="text-sm font-bold">Plan et abonnement</h2>
      <form className="mt-3 grid gap-2 sm:grid-cols-4" onSubmit={event => {
        event.preventDefault();
        const values = Object.fromEntries(new FormData(event.currentTarget));
        void run(`/api/admin/accounts/${company.id}/plan`, values);
      }}>
        <select name="plan" defaultValue={company.plan ?? "trial"} className="input text-xs">
          {["trial", "starter", "business", "business_pro", "comptable_s", "comptable_pro", "comptable_inf"].map(plan => <option key={plan}>{plan}</option>)}
        </select>
        <select name="billing_period" className="input text-xs"><option value="monthly">Mensuel</option><option value="annual">Annuel</option></select>
        <input name="amount_mad" type="number" placeholder="Montant MAD" className="input text-xs" />
        <select name="payment_method" className="input text-xs"><option value="">Mode de paiement</option><option value="virement">Virement</option><option value="cmi">CMI</option><option value="especes">Espèces</option><option value="gratuit">Gratuit</option></select>
        <input name="payment_reference" placeholder="Référence paiement" className="input text-xs sm:col-span-2" />
        <button disabled={busy} className="rounded bg-[#0D1526] px-3 py-2 text-xs font-bold text-white">Appliquer</button>
      </form>
      <form className="mt-2 flex gap-2" onSubmit={event => {
        event.preventDefault();
        void run(`/api/admin/accounts/${company.id}/trial`, Object.fromEntries(new FormData(event.currentTarget)));
      }}>
        <input name="days" type="number" min="1" defaultValue="7" className="input max-w-32 text-xs" />
        <button disabled={busy} className="rounded border border-black/15 px-3 text-xs font-semibold">Prolonger l’essai</button>
      </form>
    </section>
    <section className="rounded-md border border-black/10 bg-white p-4">
      <h2 className="text-sm font-bold">Limites personnalisées</h2>
      <form className="mt-3 grid gap-2 sm:grid-cols-3" onSubmit={event => {
        event.preventDefault();
        void run(`/api/admin/accounts/${company.id}/limits`, Object.fromEntries(new FormData(event.currentTarget)));
      }}>
        {["ocr_limit", "storage_gb", "dossiers_limit", "users_limit", "employee_limit"].map(field => <input key={field} name={field} type="number" placeholder={field} className="input text-xs" />)}
        {["has_paie", "has_bank_import", "has_saisie", "has_export_fiduciaire", "has_avoirs", "has_bilan", "has_tva_edi", "has_inbox_global", "has_mass_declarations", "has_whatsapp_agent"].map(field => <select key={field} name={field} className="input text-xs"><option value="">{field} : plan</option><option value="true">{field} : oui</option><option value="false">{field} : non</option></select>)}
        <input name="expires_at" type="date" className="input text-xs" />
        <input name="reason" required placeholder="Motif obligatoire" className="input text-xs" />
        <button disabled={busy} className="rounded bg-[#0D1526] px-3 py-2 text-xs font-bold text-white">Enregistrer</button>
      </form>
      <button onClick={() => void run(`/api/admin/accounts/${company.id}/limits`, { reset: true })} disabled={busy} className="mt-2 rounded border border-black/15 px-3 py-2 text-[11px] font-semibold">Réinitialiser aux limites du plan</button>
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
  </div>;
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
