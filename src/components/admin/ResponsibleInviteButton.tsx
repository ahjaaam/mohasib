"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";

interface CompanyOption {
  id: string;
  name: string;
}

export default function ResponsibleInviteButton({ companies }: { companies: CompanyOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [invitationUrl, setInvitationUrl] = useState("");

  async function submit(form: HTMLFormElement) {
    setBusy(true);
    setMessage("");
    setInvitationUrl("");
    const response = await fetch("/api/admin/responsables", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(new FormData(form))),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setMessage(data.message || "Invitation impossible.");
      return;
    }
    setMessage(data.emailSent ? "Invitation envoyée par e-mail." : "Invitation créée. Partagez le lien ci-dessous.");
    setInvitationUrl(data.invitationUrl || "");
    form.reset();
    router.refresh();
  }

  return <>
    <button onClick={() => setOpen(true)} className="inline-flex min-h-9 items-center gap-1.5 rounded bg-[#C8924A] px-3 text-[11px] font-bold text-white">
      <Plus size={13} />
      Ajouter un Collaborateur
    </button>
    {open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0D1526]/55 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-[15px] font-bold">Ajouter un Collaborateur</h2>
            <p className="mt-1 text-xs text-gray-500">Choisissez le compte auquel cette personne aura accès.</p>
          </div>
          <button onClick={() => setOpen(false)} title="Fermer"><X size={18} /></button>
        </div>
        <form className="mt-5 grid gap-3 sm:grid-cols-2" onSubmit={event => { event.preventDefault(); void submit(event.currentTarget); }}>
          <label className="text-[11px] font-semibold sm:col-span-2">Compte *
            <select name="company_id" required className="input mt-1">
              <option value="">Sélectionner un compte</option>
              {companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}
            </select>
          </label>
          <label className="text-[11px] font-semibold">Prénom *
            <input name="first_name" required className="input mt-1" />
          </label>
          <label className="text-[11px] font-semibold">Nom *
            <input name="last_name" required className="input mt-1" />
          </label>
          <label className="text-[11px] font-semibold sm:col-span-2">Adresse e-mail *
            <input name="email" type="email" required className="input mt-1" />
          </label>
          <fieldset className="sm:col-span-2">
            <legend className="text-[11px] font-semibold">Périmètre d'accès *</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {[
                ["business_only", "Compte normal"],
                ["comptable_pro_only", "Comptable Pro"],
                ["both", "Les deux"],
              ].map(([value, label]) => (
                <label key={value} className="flex items-center gap-2 rounded border border-black/10 px-3 py-2 text-[11px] font-semibold">
                  <input type="radio" name="access_scope" value={value} defaultChecked={value === "both"} />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <button disabled={busy || companies.length === 0} className="rounded bg-[#0D1526] px-4 py-2.5 text-xs font-bold text-white sm:col-span-2 disabled:opacity-40">
            {busy ? "Création..." : "Envoyer l'invitation"}
          </button>
        </form>
        {message && <p className={`mt-3 rounded p-3 text-[11px] ${invitationUrl ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{message}</p>}
        {invitationUrl && <a href={invitationUrl} target="_blank" rel="noreferrer" className="mt-2 block break-all text-[10px] font-medium text-blue-700 underline">{invitationUrl}</a>}
      </div>
    </div>}
  </>;
}
