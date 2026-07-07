"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { Check, X } from "lucide-react";
import { usePlanEntitlements } from "@/hooks/usePlanEntitlements";
import { TRIAL_LIMITS } from "@/lib/trial-limits";

interface Props {
  userId: string;
  userEmail: string;
  companyId: string | null;
  company: {
    plan?: string | null;
    subscription_status?: string | null;
    subscription_ends_at?: string | null;
    trial_ends_at?: string | null;
    is_suspended?: boolean | null;
    user_type?: string | null;
    trial_invoices_used?: number | null;
    trial_ocr_used?: number | null;
    trial_documents_used?: number | null;
    trial_bank_statements_used?: number | null;
    trial_employees_used?: number | null;
    trial_tva_declarations_used?: number | null;
    trial_dossiers_used?: number | null;
    trial_clients_used?: number | null;
    trial_transactions_used?: number | null;
    trial_accounting_entries_used?: number | null;
    trial_rapprochement_sessions_used?: number | null;
    trial_rapprochement_matches_used?: number | null;
  };
}

const PLAN_LABELS: Record<string, string> = {
  trial: "Essai",
  starter: "Starter",
  business: "Business",
  business_pro: "Business Pro",
  comptable_s: "Comptable S",
  comptable_pro: "Comptable Pro",
  comptable_inf: "Comptable Infini",
};

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  active: { label: "Actif", className: "bg-[#D1FAE5] text-[#065F46]" },
  trial: { label: "Essai", className: "bg-[#FEF3C7] text-[#92400E]" },
  grace: { label: "Délai de grâce", className: "bg-[#FEF3C7] text-[#92400E]" },
  expired: { label: "Expiré", className: "bg-[#FEE2E2] text-[#B91C1C]" },
};

const FEATURE_LABELS = [
  ["bank_import", "Import bancaire"],
  ["saisie", "Saisie comptable"],
  ["paie", "La Paie"],
  ["export_fiduciaire", "Export CGNC"],
  ["avoirs", "Avoirs"],
  ["bilan", "Bilan"],
  ["tva_edi", "Fichier EDI TVA"],
  ["inbox_global", "Inbox globale cabinet"],
  ["mass_declarations", "Déclarations de masse"],
  ["multi_users", "Multi-utilisateurs"],
] as const;

function formatLimit(value: number, suffix = "") {
  if (value < 0) return "Illimité";
  return `${value}${suffix}`;
}

function formatDate(value?: string | null) {
  if (!value) return "Non définie";
  return new Date(value).toLocaleDateString("fr-MA", { day: "numeric", month: "long", year: "numeric" });
}

function getUpgradeCta(plan: string, userType?: string | null) {
  const isComptableAccount = userType === "fiduciaire" || plan.startsWith("comptable_");
  if (plan === "business_pro" || plan === "comptable_inf") return null;
  if (isComptableAccount) return { label: "Demander Comptable Illimité", requestedPlan: "comptable_inf" };
  if (["trial", "starter", "business"].includes(plan)) return { label: "Demander Business Pro", requestedPlan: "business_pro" };
  return null;
}

export default function AbonnementTab({ userId, userEmail: _userEmail, companyId, company }: Props) {
  const supabase = createClient();
  const entitlements = usePlanEntitlements();
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const [usage, setUsage] = useState<{ used: number; limit: number; remaining: number; resetDate: string } | null>(null);
  useEffect(() => {
    fetch("/api/usage").then(r => r.json()).then(d => { if (!d.error) setUsage(d); }).catch(() => {});
  }, [companyId]);

  const plan = entitlements.plan || company.plan || "starter";
  const status = company.is_suspended ? "suspended" : company.subscription_status || "active";
  const statusCopy = company.is_suspended
    ? { label: "Suspendu", className: "bg-[#FEE2E2] text-[#B91C1C]" }
    : STATUS_LABELS[status] ?? STATUS_LABELS.active;
  const periodEnd = company.subscription_status === "trial" ? company.trial_ends_at : company.subscription_ends_at;
  const nextRenewal = formatDate(periodEnd);
  const trialDays = company.trial_ends_at ? Math.max(0, Math.ceil((new Date(company.trial_ends_at).getTime() - Date.now()) / 86400000)) : null;
  const includedFeatures = FEATURE_LABELS.filter(([key]) => entitlements.features[key]);
  const missingFeatures = FEATURE_LABELS.filter(([key]) => !entitlements.features[key]);
  const upgradeCta = getUpgradeCta(plan, company.user_type);

  async function deleteAccount() {
    if (deleteConfirm !== "SUPPRIMER") return;
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) {
      await supabase.auth.signOut();
      toast.error("Contactez le support pour supprimer votre compte");
    }
  }

  async function requestUpgrade() {
    if (!upgradeCta) return;
    if (!companyId) return toast.error("Entreprise introuvable");
    const { error } = await supabase.from("upgrade_requests").insert({
      company_id: companyId,
      current_plan: plan,
      requested_plan: upgradeCta.requestedPlan,
      requested_period: "monthly",
      status: "nouveau",
    });
    if (error) return toast.error("Demande impossible");
    toast.success("Votre demande a été envoyée");
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Current Plan */}
      <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-[15px] font-bold text-[#1A1A2E]">{PLAN_LABELS[plan] ?? plan}</h3>
            <p className="mt-1 text-[11px] text-[#6B7280]">Fin de période : {nextRenewal}</p>
          </div>
          <span className={`text-[11px] px-2.5 py-1 rounded-full font-semibold ${statusCopy.className}`}>{statusCopy.label}</span>
        </div>

        {company.subscription_status === "trial" && (
          <div className="mb-4 rounded-xl border border-[#F6D18A] bg-[#FFFBEB] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-[13px] font-bold text-[#1A1A2E]">Votre essai gratuit</div>
                <div className="text-[11.5px] text-[#92400E]">
                  {trialDays ?? "—"} jour{trialDays === 1 ? "" : "s"} restant{trialDays === 1 ? "" : "s"}
                </div>
              </div>
              {upgradeCta && <button onClick={requestUpgrade} className="btn btn-gold btn-sm">Passer à un plan payant →</button>}
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              {[
                ["Factures", Number(company.trial_invoices_used ?? 0), TRIAL_LIMITS.invoices],
                ["Scans", Number(company.trial_ocr_used ?? 0), TRIAL_LIMITS.ocr_scans],
                ["Documents", Number(company.trial_documents_used ?? 0), TRIAL_LIMITS.documents],
                ["Relevés", Number(company.trial_bank_statements_used ?? 0), TRIAL_LIMITS.bank_statements],
                ["Employés", Number(company.trial_employees_used ?? 0), TRIAL_LIMITS.employees],
                ["Dossiers", Number(company.trial_dossiers_used ?? 0), TRIAL_LIMITS.dossiers],
                ["TVA", Number(company.trial_tva_declarations_used ?? 0), TRIAL_LIMITS.tva_declarations],
                ["Clients", Number(company.trial_clients_used ?? 0), TRIAL_LIMITS.clients],
                ["Transactions", Number(company.trial_transactions_used ?? 0), TRIAL_LIMITS.transactions],
                ["Écritures", Number(company.trial_accounting_entries_used ?? 0), TRIAL_LIMITS.accounting_entries],
                ["Rapprochements", Number(company.trial_rapprochement_sessions_used ?? 0), TRIAL_LIMITS.rapprochement_sessions],
                ["Lignes rapprochées", Number(company.trial_rapprochement_matches_used ?? 0), TRIAL_LIMITS.rapprochement_matches],
              ].map(([label, used, limit]) => {
                const ratio = Math.min(1, Number(used) / Number(limit));
                return (
                  <div key={String(label)} className="rounded-lg border border-[#FDE68A] bg-white/80 p-2">
                    <div className="flex justify-between text-[11px] font-semibold text-[#1A1A2E]">
                      <span>{label}</span><span>{used}/{limit}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#F3E8C8]">
                      <div className="h-full rounded-full" style={{ width: `${ratio * 100}%`, backgroundColor: ratio >= 1 ? "#DC2626" : "#C8924A" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Usage */}
        <div className="mb-4">
          <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-[0.5px] mb-2">Documents importés ce mois</p>
          {usage ? (
            <>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[13px] font-bold text-[#1A1A2E]">{usage.used} / {usage.limit < 0 ? "Illimité" : usage.limit}</span>
                <span className="text-[11px] text-[#6B7280]">Réinitialisation le {usage.resetDate}</span>
              </div>
              {usage.limit >= 0 && <div className="w-full h-2 bg-[#F3F4F6] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    usage.used / usage.limit >= 1 ? "bg-[#DC2626]"
                    : usage.used / usage.limit >= 0.8 ? "bg-[#F59E0B]"
                    : "bg-[#059669]"
                  }`}
                  style={{ width: `${Math.min(100, (usage.used / usage.limit) * 100)}%` }}
                />
              </div>}
              {usage.limit >= 0 && usage.used / usage.limit >= 0.8 && usage.used < usage.limit && (
                <p className="text-[11px] text-[#92400E] mt-1.5">⚠️ Plus que {usage.remaining} document{usage.remaining > 1 ? "s" : ""} disponible{usage.remaining > 1 ? "s" : ""} ce mois.</p>
              )}
              {usage.limit >= 0 && usage.used >= usage.limit && (
                <p className="text-[11px] text-[#DC2626] mt-1.5">⛔ Limite atteinte. Les imports seront de nouveau disponibles le {usage.resetDate}.</p>
              )}
            </>
          ) : (
            <div className="h-8 bg-[#F3F4F6] rounded animate-pulse" />
          )}
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            ["OCR/mois", formatLimit(entitlements.limits.ocr)],
            ["Stockage", formatLimit(entitlements.limits.storageGb, " Go")],
            ["Dossiers", formatLimit(entitlements.limits.dossiers)],
            ["Utilisateurs", formatLimit(entitlements.limits.users)],
            ["Employés", formatLimit(entitlements.limits.employees)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg bg-[#FAFAF6] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.4px] text-[#9CA3AF]">{label}</p>
              <p className="mt-1 text-[13px] font-bold text-[#1A1A2E]">{value}</p>
            </div>
          ))}
        </div>

        {/* Features */}
        <div className="border-t border-[rgba(0,0,0,0.06)] pt-4">
          <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-[0.5px] mb-2">Fonctionnalités incluses</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
            {includedFeatures.map(([, label]) => (
              <div key={label} className="flex items-center gap-2 text-[12px] text-[#1A1A2E]">
                <Check size={13} className="text-[#059669] flex-shrink-0" />
                {label}
              </div>
            ))}
            {missingFeatures.map(([, label]) => (
              <div key={label} className="flex items-center gap-2 text-[12px] text-[#9CA3AF]">
                <X size={13} className="text-[#D1D5DB] flex-shrink-0" />
                {label}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 mt-4 flex-wrap">
          {upgradeCta && <button onClick={requestUpgrade} className="btn btn-outline">{upgradeCta.label}</button>}
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
