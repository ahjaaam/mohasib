"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check, Clipboard, Lock, Plus, Shield, UserRound, X } from "lucide-react";
import toast from "react-hot-toast";
import { ROUTES } from "@/lib/routes";

type Permission = { resource: string; action: string };
type Member = {
  id: string;
  user_email: string;
  first_name?: string | null;
  last_name?: string | null;
  role_name: string;
  role_label: string;
  dossier_scope?: string[] | null;
  status: "invited" | "active" | "suspended";
  invitation_url?: string | null;
  invited_at?: string | null;
  accepted_at?: string | null;
  created_at: string;
  permissions: Permission[];
};
type TeamData = {
  context: { track: "business" | "comptable"; accountName: string };
  plan: { allowed: boolean; limit: number };
  count: number;
  owner: { id: string; email: string; full_name: string; role_label: string };
  members: Member[];
  dossiers: { id: string; raison_sociale: string }[];
  role_presets: { role_name: string; resource: string; action: string }[];
};

const PERMISSION_GROUPS = [
  { label: "Facturation", items: [["invoice", "read", "Voir les factures"], ["invoice", "create", "Créer"], ["invoice", "delete", "Supprimer"], ["invoice", "send", "Envoyer"]] },
  { label: "Comptabilité", items: [["accounting", "read", "Voir les écritures"], ["accounting", "create", "Créer"], ["accounting", "delete", "Supprimer"], ["accounting", "lock", "Verrouiller les périodes"]] },
  { label: "TVA", items: [["tva_declaration", "read", "Voir"], ["tva_declaration", "prepare", "Préparer"], ["tva_declaration", "validate", "Valider"]] },
  { label: "Paie", items: [["bulletin_paie", "read", "Voir les bulletins"], ["bulletin_paie", "validate", "Valider"], ["salary", "read", "Voir les salaires"]] },
  { label: "Documents", items: [["document", "read", "Voir"], ["document", "create", "Ajouter"], ["document", "delete", "Supprimer"]] },
  { label: "Paramètres", items: [["settings", "update", "Modifier les paramètres"], ["settings", "manage_team", "Gérer l'équipe"]] },
  { label: "Rapports", items: [["report", "read", "Consulter"], ["report", "export", "Exporter"]] },
] as const;

const keyOf = (permission: Permission) => `${permission.resource}:${permission.action}`;

export default function TeamTab({ title = "Équipe" }: { title?: string }) {
  const [data, setData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);

  async function load() {
    setLoading(true);
    const response = await fetch("/api/team");
    if (response.ok) setData(await response.json());
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  async function updateStatus(member: Member, status: "active" | "suspended" | "revoked") {
    if (status === "revoked" && !window.confirm(`Révoquer l'accès de ${member.user_email} ? Cette action est immédiate.`)) return;
    const response = await fetch(`/api/team/${member.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!response.ok) return toast.error("Impossible de modifier cet accès");
    toast.success(status === "revoked" ? "Accès révoqué" : status === "suspended" ? "Accès suspendu" : "Accès réactivé");
    await load();
  }
  async function resend(member: Member) {
    const response = await fetch(`/api/team/${member.id}/resend`, { method: "POST" });
    const result = await response.json();
    if (!response.ok) return toast.error("Impossible de renvoyer l'invitation");
    await navigator.clipboard.writeText(result.invitationUrl);
    toast.success("Invitation renvoyée et lien copié");
    await load();
  }

  if (loading) return <div className="card p-6 text-[13px] text-[#6B7280]">Chargement de l'équipe...</div>;
  if (!data) return <div className="card p-6 text-[13px] text-red-600">Impossible de charger l'équipe.</div>;
  if (!data.plan.allowed) {
    return (
      <div className="rounded-xl border border-black/[0.08] bg-[#F4F4F1] p-7 text-center">
        <Lock className="mx-auto text-[#9CA3AF]" size={25} />
        <h2 className="mt-4 text-[15px] font-bold text-[#0D1526]">Gestion d'équipe verrouillée</h2>
        <p className="mx-auto mt-2 max-w-lg text-[12.5px] leading-6 text-[#6B7280]">
          La gestion d'équipe est disponible à partir du plan Business Pro (449 MAD/mois) ou Comptable Pro (599 MAD/mois).
        </p>
        <Link href={ROUTES.TARIFS} className="mt-5 inline-flex rounded-lg bg-[#C8924A] px-4 py-2.5 text-[12px] font-bold text-white">Voir les plans →</Link>
      </div>
    );
  }

  const limitReached = data.count >= data.plan.limit;
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-[16px] font-bold text-[#0D1526]">{title}</h2>
          <span className="rounded-full bg-[#0D1526] px-2.5 py-1 text-[10px] font-bold text-white">{data.count} / {data.plan.limit} utilisateurs</span>
        </div>
        <button title={limitReached ? `Limite de ${data.plan.limit} utilisateurs atteinte` : undefined} disabled={limitReached} onClick={() => { setEditing(null); setModalOpen(true); }} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#C8924A] px-4 text-[12px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-45">
          <Plus size={15} /> Inviter un membre
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-black/[0.08] bg-white">
        <table className="w-full min-w-[820px] text-left text-[12px]">
          <thead className="bg-[#FAFAF6] text-[#6B7280]"><tr>{["Membre", "Rôle", "Accès", "Statut", "Depuis", "Actions"].map(x => <th key={x} className="px-4 py-3 font-semibold">{x}</th>)}</tr></thead>
          <tbody className="divide-y divide-black/[0.06]">
            <tr>
              <td className="px-4 py-3"><MemberIdentity name={data.owner.full_name} email={data.owner.email} /></td>
              <td className="px-4 py-3"><Badge label={data.owner.role_label} tone="gold" /></td>
              <td className="px-4 py-3 text-[#6B7280]">Tout</td>
              <td className="px-4 py-3"><Status status="active" /></td>
              <td className="px-4 py-3 text-[#9CA3AF]">Propriétaire</td>
              <td className="px-4 py-3 text-[#9CA3AF]">—</td>
            </tr>
            {data.members.map(member => (
              <tr key={member.id}>
                <td className="px-4 py-3"><MemberIdentity name={`${member.first_name ?? ""} ${member.last_name ?? ""}`.trim()} email={member.user_email} /></td>
                <td className="px-4 py-3"><Badge label="Responsable" tone="gray" /></td>
                <td className="px-4 py-3 text-[#6B7280]">Selon permissions</td>
                <td className="px-4 py-3"><Status status={member.status} /></td>
                <td className="px-4 py-3 text-[#9CA3AF]">{new Date(member.accepted_at || member.invited_at || member.created_at).toLocaleDateString("fr-FR")}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {member.status === "invited" ? (
                      <>
                        <button onClick={() => resend(member)} className="font-semibold text-[#C8924A]">Renvoyer</button>
                        <button onClick={() => { navigator.clipboard.writeText(member.invitation_url || ""); toast.success("Lien copié"); }} className="text-[#C8924A]"><Clipboard size={14} /></button>
                        <button onClick={() => updateStatus(member, "revoked")} className="text-red-600">Annuler</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => { setEditing(member); setModalOpen(true); }} className="font-semibold text-[#C8924A]">Modifier l'accès</button>
                        <button onClick={() => updateStatus(member, member.status === "suspended" ? "active" : "suspended")} className="text-[#6B7280]">{member.status === "suspended" ? "Réactiver" : "Suspendre"}</button>
                        <button onClick={() => updateStatus(member, "revoked")} className="text-red-600">Révoquer</button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {modalOpen && <MemberModal data={data} member={editing} onClose={() => setModalOpen(false)} onSaved={async () => { setModalOpen(false); await load(); }} />}
    </div>
  );
}

function MemberModal({ data, member, onClose, onSaved }: { data: TeamData; member: Member | null; onClose: () => void; onSaved: () => void }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ email: member?.user_email ?? "", first_name: member?.first_name ?? "", last_name: member?.last_name ?? "", role_name: "manager", dossier_scope: [] as string[] });
  const [selected, setSelected] = useState<Set<string>>(() => new Set((member?.permissions ?? data.role_presets.filter(p => p.role_name === "manager")).map(keyOf)));
  const [showPermissions, setShowPermissions] = useState(false);
  const [saving, setSaving] = useState(false);
  const preset = useMemo(() => new Set(data.role_presets.filter(p => p.role_name === "manager").map(keyOf)), [data.role_presets]);

  function toggle(permission: Permission) {
    const key = keyOf(permission);
    setSelected(current => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }
  async function save() {
    setSaving(true);
    const all: Permission[] = [];
    for (const group of PERMISSION_GROUPS) {
      for (const item of group.items) all.push({ resource: item[0], action: item[1] });
    }
    const overrides = all.filter(permission => selected.has(keyOf(permission)) !== preset.has(keyOf(permission))).map(permission => ({ ...permission, is_granted: selected.has(keyOf(permission)) }));
    const response = await fetch(member ? `/api/team/${member.id}` : "/api/team", {
      method: member ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, overrides }),
    });
    const result = await response.json();
    setSaving(false);
    if (!response.ok) return toast.error(result.message || "Impossible d'enregistrer ce membre");
    if (result.invitationUrl) await navigator.clipboard.writeText(result.invitationUrl);
    toast.success(member ? "Accès mis à jour" : "Invitation envoyée");
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#0D1526]/45 p-4" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="max-h-[92vh] w-full max-w-[680px] overflow-y-auto rounded-xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between"><h3 className="text-[16px] font-bold text-[#0D1526]">{member ? "Modifier l'accès" : "Inviter un membre"}</h3><button onClick={onClose}><X size={18} /></button></div>
        <div className="mt-5 flex gap-2">{[1, 2].map(value => <span key={value} className={`h-1.5 flex-1 rounded-full ${step >= value ? "bg-[#C8924A]" : "bg-[#E5E7EB]"}`} />)}</div>

        {step === 1 && <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2 text-[12px] font-semibold text-[#374151]">Email *<input type="email" readOnly={!!member} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="input mt-1" /></label>
          <label className="text-[12px] font-semibold text-[#374151]">Prénom<input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} className="input mt-1" /></label>
          <label className="text-[12px] font-semibold text-[#374151]">Nom<input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} className="input mt-1" /></label>
        </div>}

        {step === 2 && <div className="mt-6">
          <div className="rounded-lg border border-[#C8924A]/30 bg-[#C8924A]/5 px-4 py-3"><strong className="text-[12px] text-[#0D1526]">Rôle : Responsable</strong><p className="mt-1 text-[11px] text-[#6B7280]">Le propriétaire peut ajuster précisément les accès de ce membre.</p></div>
          <button onClick={() => setShowPermissions(open => !open)} className="mt-4 flex w-full items-center justify-between rounded-lg bg-[#FAFAF6] px-4 py-3 text-[12px] font-bold text-[#0D1526]">Personnaliser les permissions <span>{showPermissions ? "−" : "+"}</span></button>
          {showPermissions && <div className="mt-4 space-y-5">{PERMISSION_GROUPS.map(group => <div key={group.label}><p className="text-[10px] font-bold uppercase tracking-[1.4px] text-[#9CA3AF]">{group.label}</p><div className="mt-2 grid gap-2 sm:grid-cols-2">{group.items.map(([resource, action, label]) => { const permission = { resource, action }; return <label key={`${resource}:${action}`} className="flex items-center gap-2 text-[12px] text-[#374151]"><input type="checkbox" checked={selected.has(keyOf(permission))} onChange={() => toggle(permission)} />{label}</label>; })}</div></div>)}</div>}
        </div>}

        <div className="mt-7 flex justify-between border-t border-black/[0.07] pt-4">
          <button onClick={step === 1 ? onClose : () => setStep(value => value - 1)} className="rounded-lg border border-black/[0.10] px-4 py-2 text-[12px] font-semibold text-[#6B7280]">{step === 1 ? "Annuler" : "Retour"}</button>
          {step < 2 ? <button disabled={!form.email} onClick={() => setStep(2)} className="rounded-lg bg-[#0D1526] px-4 py-2 text-[12px] font-bold text-white disabled:opacity-40">Continuer</button> : <button disabled={saving} onClick={save} className="rounded-lg bg-[#C8924A] px-4 py-2 text-[12px] font-bold text-white disabled:opacity-50">{saving ? "Enregistrement..." : member ? "Enregistrer" : "Envoyer l'invitation"}</button>}
        </div>
      </div>
    </div>
  );
}

function MemberIdentity({ name, email }: { name: string; email: string }) {
  const label = name || email;
  return <div className="flex items-center gap-2.5"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0D1526] text-[10px] font-bold text-white">{label.split(/\s|@/).slice(0, 2).map(x => x[0]).join("").toUpperCase()}</span><span><strong className="block text-[12px] text-[#0D1526]">{name || email}</strong>{name && <span className="text-[10px] text-[#9CA3AF]">{email}</span>}</span></div>;
}
function Badge({ label, tone }: { label: string; tone: "gold" | "blue" | "gray" }) {
  const classes = tone === "gold" ? "bg-[#C8924A]/10 text-[#A66F27]" : tone === "blue" ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-600";
  return <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${classes}`}>{label}</span>;
}
function Status({ status }: { status: Member["status"] | "active" }) {
  const text = status === "active" ? "Actif" : status === "invited" ? "Invitation envoyée" : "Suspendu";
  const color = status === "active" ? "text-emerald-700" : status === "invited" ? "text-blue-700" : "text-red-600";
  return <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${color}`}>{status === "active" ? <Check size={13} /> : status === "invited" ? <UserRound size={13} /> : <Shield size={13} />}{text}</span>;
}
