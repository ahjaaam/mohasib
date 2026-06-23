"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Lock, X } from "lucide-react";
import type { TrialFeature } from "@/lib/trial-limits";

type TrialLimitPayload = {
  error?: string;
  feature?: TrialFeature;
  message?: string;
  used?: number;
  limit?: number;
};

const BODY: Record<TrialFeature, string> = {
  invoices: "Vous avez créé 10 factures/devis/avoirs, la limite de votre essai gratuit. Passez à un plan payant pour continuer sans interruption.",
  ocr_scans: "Vous avez scanné 10 documents, la limite de votre essai gratuit.",
  documents: "Vous avez archivé 10 documents, la limite de votre essai gratuit.",
  bank_statements: "L'essai gratuit permet d'importer 1 relevé bancaire. Passez à un plan payant pour importer tous vos relevés.",
  employees: "L'essai gratuit permet de gérer 1 employé. Passez à un plan payant pour votre équipe complète.",
  tva_declarations: "L'essai gratuit permet de valider 1 déclaration TVA.",
  dossiers: "L'essai gratuit permet de créer 1 dossier client. Passez à un plan Comptable Pro pour en gérer davantage.",
  clients: "L'essai gratuit permet de créer 5 clients. Passez à un plan payant pour gérer toute votre base clients.",
  transactions: "L'essai gratuit permet de créer 20 transactions.",
  accounting_entries: "L'essai gratuit permet de créer 20 écritures comptables.",
  rapprochement_sessions: "L'essai gratuit permet de lancer 1 rapprochement bancaire.",
  rapprochement_matches: "L'essai gratuit permet de rapprocher 20 lignes bancaires.",
};

export default function TrialLimitModal() {
  const [payload, setPayload] = useState<TrialLimitPayload | null>(null);

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      if (response.status === 403) {
        response.clone().json().then((body: TrialLimitPayload) => {
          if (body?.error === "trial_limit_reached" || body?.error === "trial_feature_locked") {
            setPayload(body);
          }
        }).catch(() => {});
      }
      return response;
    };
    return () => { window.fetch = originalFetch; };
  }, []);

  if (!payload) return null;

  const feature = payload.feature ?? "invoices";
  const body = payload.message ?? BODY[feature] ?? BODY.invoices;
  const progress = payload.used != null && payload.limit != null
    ? `Vous avez déjà utilisé ${payload.used}/${payload.limit}.`
    : "Vous pouvez continuer à consulter vos données existantes.";

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[rgba(200,146,74,0.14)] text-[#C8924A]">
              <Lock size={18} />
            </div>
            <div>
              <h2 className="text-[16px] font-bold text-[#1A1A2E]">Limite d&apos;essai atteinte</h2>
              <p className="mt-0.5 text-[11.5px] text-[#6B7280]">Votre travail reste disponible.</p>
            </div>
          </div>
          <button onClick={() => setPayload(null)} className="rounded-lg p-1 text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#1A1A2E]">
            <X size={16} />
          </button>
        </div>

        <p className="mt-4 text-[13px] leading-6 text-[#374151]">{body}</p>
        <p className="mt-2 text-[12px] font-medium text-[#92400E]">{progress}</p>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Link href="/tarifs" onClick={() => setPayload(null)} className="btn btn-gold flex-1 justify-center">
            Voir les plans →
          </Link>
          <button onClick={() => setPayload(null)} className="btn btn-outline flex-1 justify-center">
            Continuer l&apos;exploration
          </button>
        </div>
      </div>
    </div>
  );
}
