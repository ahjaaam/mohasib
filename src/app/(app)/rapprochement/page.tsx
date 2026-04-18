"use client";

import { GitMerge, Lock } from "lucide-react";

function LockedFeature({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="flex items-center gap-3 bg-white border border-[rgba(0,0,0,0.08)] rounded-lg px-4 py-3 opacity-60 cursor-not-allowed"
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      <Lock size={14} className="text-[#C8924A] flex-shrink-0" />
      <div>
        <p className="text-[13px] font-medium text-[#1A1A2E]">{title}</p>
        <p className="text-[11.5px] text-[#6B7280]">{sub}</p>
      </div>
    </div>
  );
}

export default function RapprochementPage() {
  return (
    <div className="max-w-xl">
      <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl p-8 text-center"
        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>

        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
          style={{ background: "rgba(200,146,74,0.1)" }}>
          <GitMerge size={28} className="text-[#C8924A]" />
        </div>

        <h1 className="text-[22px] font-semibold text-[#1A1A2E] mb-2">Rapprochement Bancaire</h1>
        <p className="text-[14px] text-[#6B7280] mb-4 max-w-sm mx-auto">
          Importez vos relevés et rapprochez automatiquement vos transactions bancaires grâce à l&apos;IA.
        </p>

        <span className="inline-block text-[12px] font-medium text-[#C8924A] border border-[#C8924A] rounded-full px-4 py-1 mb-6">
          Disponible prochainement
        </span>

        <div className="text-left space-y-2 mb-6">
          <LockedFeature title="Import de relevé bancaire"       sub="PDF, CSV, Excel — toutes les banques marocaines" />
          <LockedFeature title="Rapprochement automatique IA"    sub="Correspondance intelligente transactions ↔ relevé" />
          <LockedFeature title="Validation manuelle des suggestions" sub="Confirmez ou rejetez chaque correspondance" />
          <LockedFeature title="Détection des écarts"            sub="Transactions non rapprochées et anomalies" />
          <LockedFeature title="Rapport de clôture"              sub="Récapitulatif complet par période" />
        </div>

      </div>
    </div>
  );
}
