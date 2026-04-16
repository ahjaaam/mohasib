"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { Check, X } from "lucide-react";

interface Props {
  userId: string;
  userEmail: string;
}

const PRO_FEATURES = [
  "Factures illimitées",
  "Clients illimités",
  "Mohasib Chat — comptable 24h/24",
  "Export Fiduciaire (ZIP complet)",
  "OCR reçus intelligents",
  "Journal comptable CGNC",
  "Boîte de réception documents",
  "Récap TVA automatique",
];

const MOCK_PAYMENTS = [
  { date: "01/03/2026", amount: "199 MAD", status: "Payé" },
  { date: "01/02/2026", amount: "199 MAD", status: "Payé" },
  { date: "01/01/2026", amount: "199 MAD", status: "Payé" },
];

export default function AbonnementTab({ userId, userEmail }: Props) {
  const supabase = createClient();
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [waitlistEmail, setWaitlistEmail] = useState(userEmail);
  const [waitlistDone, setWaitlistDone] = useState(false);
  const [submittingWaitlist, setSubmittingWaitlist] = useState(false);

  const nextRenewal = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
    .toLocaleDateString("fr-MA", { day: "numeric", month: "long", year: "numeric" });

  async function joinWaitlist() {
    if (!waitlistEmail) return;
    setSubmittingWaitlist(true);
    await supabase.from("fiduciaire_waitlist").insert({ email: waitlistEmail, user_id: userId });
    setSubmittingWaitlist(false);
    setWaitlistDone(true);
    toast.success("✓ Vous serez notifié dès le lancement !");
  }

  async function deleteAccount() {
    if (deleteConfirm !== "SUPPRIMER") return;
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) {
      // Fall back to sign out — actual deletion requires admin API
      await supabase.auth.signOut();
      toast.error("Contactez le support pour supprimer votre compte");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Current Plan */}
      <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-[15px] font-bold text-[#1A1A2E]">Mohasib Pro</h3>
            <p className="text-[13px] text-[#6B7280] mt-0.5">199 MAD / mois</p>
          </div>
          <span className="text-[11px] px-2.5 py-1 bg-[#D1FAE5] text-[#065F46] rounded-full font-semibold">Actif ✓</span>
        </div>
        <p className="text-[11.5px] text-[#9CA3AF] mb-4">Prochain renouvellement : {nextRenewal}</p>

        {/* Usage */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { label: "Factures ce mois", value: "8", max: "Illimité" },
            { label: "Clients", value: "6", max: "Illimité" },
            { label: "Questions AI", value: "47", max: "ce mois" },
          ].map(s => (
            <div key={s.label} className="bg-[#FAFAF6] rounded-lg p-3">
              <div className="text-[18px] font-bold text-[#1A1A2E]">{s.value}</div>
              <div className="text-[10.5px] text-[#9CA3AF]">{s.label}</div>
              <div className="text-[10px] text-[#C8924A] font-medium">{s.max}</div>
            </div>
          ))}
        </div>

        {/* Features */}
        <div className="border-t border-[rgba(0,0,0,0.06)] pt-4">
          <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-[0.5px] mb-2">Fonctionnalités incluses</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
            {PRO_FEATURES.map(f => (
              <div key={f} className="flex items-center gap-2 text-[12px] text-[#1A1A2E]">
                <Check size={13} className="text-[#059669] flex-shrink-0" />
                {f}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 mt-4 flex-wrap">
          <button className="btn btn-outline">Gérer mon abonnement</button>
          <button onClick={() => setShowCancelModal(true)} className="text-[12px] text-[#DC2626] hover:underline cursor-pointer">
            Annuler mon abonnement
          </button>
        </div>
      </div>

      {/* Fiduciaire Teaser */}
      <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl p-5 relative overflow-hidden">
        <div className="absolute top-3 right-3 text-[10px] px-2.5 py-1 bg-[#FEF3C7] text-[#92400E] rounded-full font-semibold">
          Bientôt disponible
        </div>
        <h3 className="text-[13px] font-bold text-[#1A1A2E] mb-1">Mohasib Pro Fiduciaire</h3>
        <p className="text-[12px] text-[#6B7280] mb-4">Gérez tous vos clients depuis un seul tableau de bord. Idéal pour les cabinets comptables.</p>
        {waitlistDone ? (
          <div className="text-[12.5px] text-[#059669] font-medium">✓ Vous êtes sur la liste — on vous prévient au lancement !</div>
        ) : (
          <div className="flex gap-2">
            <input
              className="input flex-1"
              type="email"
              value={waitlistEmail}
              onChange={e => setWaitlistEmail(e.target.value)}
              placeholder="votre@email.ma"
            />
            <button onClick={joinWaitlist} disabled={submittingWaitlist} className="btn btn-gold flex-shrink-0">
              {submittingWaitlist ? "..." : "Être notifié →"}
            </button>
          </div>
        )}
      </div>

      {/* Invoice History */}
      <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl overflow-hidden">
        <div className="tbl-header">
          <span className="tbl-title">Historique des paiements</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Montant</th>
              <th>Statut</th>
              <th>Reçu</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_PAYMENTS.map((p, i) => (
              <tr key={i}>
                <td>{p.date}</td>
                <td className="font-semibold">{p.amount}</td>
                <td><span className="badge b-paid">{p.status}</span></td>
                <td>
                  <button className="text-[11.5px] text-[#C8924A] hover:underline">Télécharger</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Danger Zone */}
      <div className="border-2 border-[#FCA5A5] rounded-xl p-5">
        <h3 className="text-[13px] font-bold text-[#DC2626] mb-1">Zone dangereuse</h3>
        <p className="text-[12px] text-[#6B7280] mb-3">
          Cette action est irréversible. Toutes vos données seront définitivement supprimées.
        </p>
        <button onClick={() => setShowDeleteModal(true)} className="btn btn-sm text-[#DC2626] bg-[#FEE2E2] hover:bg-[#FCA5A5] border-none">
          Supprimer mon compte
        </button>
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-[14px] font-bold text-[#1A1A2E]">Annuler l&apos;abonnement ?</h3>
              <button onClick={() => setShowCancelModal(false)}><X size={16} className="text-[#9CA3AF]" /></button>
            </div>
            <p className="text-[12.5px] text-[#6B7280] mb-4">
              Êtes-vous sûr ? Vous perdrez accès à toutes les fonctionnalités Pro le {nextRenewal}.
            </p>
            <div className="flex gap-2">
              <button onClick={() => { toast("Abonnement annulé"); setShowCancelModal(false); }}
                className="btn btn-sm flex-1 bg-[#DC2626] text-white hover:bg-[#B91C1C] border-none justify-center">
                Annuler mon abonnement
              </button>
              <button onClick={() => setShowCancelModal(false)} className="btn btn-gold btn-sm flex-1 justify-center">
                Garder mon abonnement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-[14px] font-bold text-[#DC2626]">Supprimer le compte</h3>
              <button onClick={() => { setShowDeleteModal(false); setDeleteConfirm(""); }}><X size={16} className="text-[#9CA3AF]" /></button>
            </div>
            <p className="text-[12.5px] text-[#6B7280] mb-3">
              Cette action est <strong>irréversible</strong>. Toutes vos factures, clients et données seront supprimés.
            </p>
            <p className="text-[12px] text-[#6B7280] mb-2">Tapez <strong>SUPPRIMER</strong> pour confirmer :</p>
            <input
              className="input mb-3"
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              placeholder="SUPPRIMER"
            />
            <div className="flex gap-2">
              <button
                onClick={deleteAccount}
                disabled={deleteConfirm !== "SUPPRIMER"}
                className="btn btn-sm flex-1 bg-[#DC2626] text-white hover:bg-[#B91C1C] border-none justify-center disabled:opacity-40"
              >
                Supprimer définitivement
              </button>
              <button onClick={() => { setShowDeleteModal(false); setDeleteConfirm(""); }} className="btn btn-outline btn-sm flex-1 justify-center">
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
