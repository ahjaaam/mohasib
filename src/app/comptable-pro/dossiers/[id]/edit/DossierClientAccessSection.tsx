"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import toast from "react-hot-toast";
import { Users, Plus, Copy, X, Clock, CheckCircle2, Ban } from "lucide-react";

type ClientMember = {
  id: string;
  user_email: string;
  first_name?: string | null;
  last_name?: string | null;
  status: "invited" | "active" | "suspended";
  invitation_url?: string | null;
  created_at: string;
};

export default function DossierClientAccessSection() {
  const { id } = useParams<{ id: string }>();
  const [members, setMembers] = useState<ClientMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/dossiers/${id}/client-access`);
    if (res.ok) {
      const data = await res.json();
      setMembers(data.members ?? []);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function invite() {
    if (!email.trim()) { toast.error("Adresse e-mail requise"); return; }
    setInviting(true);
    const res = await fetch(`/api/dossiers/${id}/client-access`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, first_name: firstName, last_name: lastName }),
    });
    const data = await res.json();
    setInviting(false);
    if (!res.ok) { toast.error(data.message || "Impossible d'inviter ce client."); return; }
    toast.success("Invitation envoyée !");
    setEmail(""); setFirstName(""); setLastName(""); setShowForm(false);
    load();
  }

  async function setStatus(membershipId: string, status: "suspended" | "active" | "revoked") {
    const res = await fetch(`/api/dossiers/${id}/client-access/${membershipId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) { toast.error("Action impossible."); return; }
    toast.success(status === "revoked" ? "Accès révoqué" : status === "suspended" ? "Accès suspendu" : "Accès réactivé");
    load();
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users size={15} className="text-[#C8924A]" />
          <h2 className="text-[13px] font-semibold text-[#1A1A2E]">Accès client</h2>
        </div>
        {!showForm && (
          <button type="button" onClick={() => setShowForm(true)} className="btn btn-outline btn-sm flex items-center gap-1">
            <Plus size={12} /> Inviter
          </button>
        )}
      </div>
      <p className="text-[11.5px] text-[#6B7280] mb-4">
        Donnez à votre client un accès direct à ce dossier — factures, transactions, boîte de réception, archive — sans accès à vos outils comptables.
      </p>

      {showForm && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 p-3.5 rounded-xl border border-[rgba(0,0,0,0.08)] bg-[#FAFAF6]">
          <div className="md:col-span-2">
            <label className="block text-[12px] font-medium text-[#374151] mb-1">Email du client</label>
            <input type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} placeholder="client@exemple.ma" />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[#374151] mb-1">Prénom</label>
            <input className="input" value={firstName} onChange={e => setFirstName(e.target.value)} />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[#374151] mb-1">Nom</label>
            <input className="input" value={lastName} onChange={e => setLastName(e.target.value)} />
          </div>
          <div className="md:col-span-2 flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="btn btn-outline btn-sm">Annuler</button>
            <button type="button" onClick={invite} disabled={inviting} className="btn btn-gold btn-sm">
              {inviting ? "Envoi..." : "Envoyer l'invitation"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-[12px] text-[#9CA3AF]">Chargement…</div>
      ) : members.length === 0 ? (
        <p className="text-[12px] text-[#9CA3AF]">Aucun client n'a encore accès à ce dossier.</p>
      ) : (
        <div className="space-y-2">
          {members.map(member => (
            <div key={member.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-[rgba(0,0,0,0.07)]">
              <div className="min-w-0">
                <div className="text-[12.5px] font-medium text-[#1A1A2E] truncate">
                  {[member.first_name, member.last_name].filter(Boolean).join(" ") || member.user_email}
                </div>
                <div className="text-[11px] text-[#9CA3AF] truncate">{member.user_email}</div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {member.status === "invited" && (
                  <>
                    <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-[#92400E] bg-[#FEF3C7] px-2 py-0.5 rounded">
                      <Clock size={10} /> Invité
                    </span>
                    {member.invitation_url && (
                      <button type="button" title="Copier le lien"
                        onClick={() => { navigator.clipboard.writeText(member.invitation_url!); toast.success("Lien copié"); }}
                        className="text-[#9CA3AF] hover:text-[#C8924A] transition-colors">
                        <Copy size={13} />
                      </button>
                    )}
                  </>
                )}
                {member.status === "active" && (
                  <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-[#065F46] bg-[#D1FAE5] px-2 py-0.5 rounded">
                    <CheckCircle2 size={10} /> Actif
                  </span>
                )}
                {member.status === "suspended" && (
                  <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-[#6B7280] bg-[#F3F4F6] px-2 py-0.5 rounded">
                    <Ban size={10} /> Suspendu
                  </span>
                )}
                {member.status === "active" ? (
                  <button type="button" title="Suspendre" onClick={() => setStatus(member.id, "suspended")}
                    className="text-[#9CA3AF] hover:text-[#D97706] transition-colors">
                    <Ban size={14} />
                  </button>
                ) : member.status === "suspended" ? (
                  <button type="button" title="Réactiver" onClick={() => setStatus(member.id, "active")}
                    className="text-[#9CA3AF] hover:text-[#059669] transition-colors">
                    <CheckCircle2 size={14} />
                  </button>
                ) : null}
                <button type="button" title="Révoquer l'accès" onClick={() => setStatus(member.id, "revoked")}
                  className="text-[#D1D5DB] hover:text-[#DC2626] transition-colors">
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
