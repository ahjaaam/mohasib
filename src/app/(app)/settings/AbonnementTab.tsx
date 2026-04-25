"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { Check, X } from "lucide-react";

interface Props {
  userId: string;
  userEmail: string;
  companyId: string | null;
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

export default function AbonnementTab({ userId, userEmail: _userEmail, companyId }: Props) {
  const supabase = createClient();
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const [usage, setUsage] = useState<{ used: number; limit: number; remaining: number; resetDate: string } | null>(null);
  useEffect(() => {
    fetch("/api/usage").then(r => r.json()).then(d => { if (!d.error) setUsage(d); }).catch(() => {});
  }, [companyId]);

  const nextRenewal = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
    .toLocaleDateString("fr-MA", { day: "numeric", month: "long", year: "numeric" });

  async function deleteAccount() {
    if (deleteConfirm !== "SUPPRIMER") return;
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) {
      await supabase.auth.signOut();
      toast.error("Contactez le support pour supprimer votre compte");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Current Plan */}
      <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl p-5">
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-[15px] font-bold text-[#1A1A2E]">Mohasib Pro</h3>
          <span className="text-[11px] px-2.5 py-1 bg-[#D1FAE5] text-[#065F46] rounded-full font-semibold">Actif ✓</span>
        </div>

        {/* Usage */}
        <div className="mb-4">
          <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-[0.5px] mb-2">Documents importés ce mois</p>
          {usage ? (
            <>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[13px] font-bold text-[#1A1A2E]">{usage.used} / {usage.limit}</span>
                <span className="text-[11px] text-[#6B7280]">Réinitialisation le {usage.resetDate}</span>
              </div>
              <div className="w-full h-2 bg-[#F3F4F6] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    usage.used / usage.limit >= 1 ? "bg-[#DC2626]"
                    : usage.used / usage.limit >= 0.8 ? "bg-[#F59E0B]"
                    : "bg-[#059669]"
                  }`}
                  style={{ width: `${Math.min(100, (usage.used / usage.limit) * 100)}%` }}
                />
              </div>
              {usage.used / usage.limit >= 0.8 && usage.used < usage.limit && (
                <p className="text-[11px] text-[#92400E] mt-1.5">⚠️ Plus que {usage.remaining} document{usage.remaining > 1 ? "s" : ""} disponible{usage.remaining > 1 ? "s" : ""} ce mois.</p>
              )}
              {usage.used >= usage.limit && (
                <p className="text-[11px] text-[#DC2626] mt-1.5">⛔ Limite atteinte. Les imports seront de nouveau disponibles le {usage.resetDate}.</p>
              )}
            </>
          ) : (
            <div className="h-8 bg-[#F3F4F6] rounded animate-pulse" />
          )}
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
