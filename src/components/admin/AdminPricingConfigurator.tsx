"use client";

import { useMemo, useState } from "react";
import {
  calculatePricing,
  DEFAULT_CABINET_PRICING_CONFIGURATION,
  DEFAULT_PRICING_CONFIGURATION,
  normalizePricingConfiguration,
  PRICING_RULES,
  type PricingAudience,
  type PricingConfiguration,
} from "@/lib/pricing";

function money(value: number) {
  return new Intl.NumberFormat("fr-MA").format(value);
}

function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label className="text-[10.5px] font-semibold text-gray-600">
      {label}
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => {
          const parsed = Number(event.target.value);
          const bounded = Number.isFinite(parsed) ? Math.max(min, Math.floor(parsed)) : min;
          onChange(max === undefined ? bounded : Math.min(max, bounded));
        }}
        className="input mt-1 text-xs"
      />
    </label>
  );
}

export default function AdminPricingConfigurator({
  companyId,
  companyType,
  initialConfiguration,
}: {
  companyId: string;
  companyType?: string | null;
  initialConfiguration?: unknown;
}) {
  const fallback = companyType === "fiduciaire"
    ? DEFAULT_CABINET_PRICING_CONFIGURATION
    : DEFAULT_PRICING_CONFIGURATION;
  const [configuration, setConfiguration] = useState<PricingConfiguration>(
    normalizePricingConfiguration(initialConfiguration) ?? fallback,
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const result = useMemo(() => calculatePricing(configuration), [configuration]);

  const update = <Key extends keyof PricingConfiguration>(key: Key, value: PricingConfiguration[Key]) => {
    setConfiguration((current) => ({ ...current, [key]: value }));
  };

  const selectAudience = (audience: PricingAudience) => {
    setConfiguration(audience === "cabinet"
      ? DEFAULT_CABINET_PRICING_CONFIGURATION
      : DEFAULT_PRICING_CONFIGURATION);
  };

  async function save() {
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/admin/accounts/${companyId}/pricing`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(configuration),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(data.message || "Configuration impossible");
      setBusy(false);
      return;
    }
    window.location.reload();
  }

  const costLines = [
    ["Base", result.base],
    ["Dossiers supplémentaires", result.additionalDossiers],
    ["Utilisateurs supplémentaires", result.users],
    ["OCR supplémentaire", result.ocr],
    ["Paie supplémentaire", result.payroll],
  ] as const;

  return (
    <section className="rounded-md border border-[#C8924A]/35 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold">Tarification du compte</h2>
          <p className="mt-1 text-[11px] text-gray-500">Même calcul que le simulateur public. Le montant ne peut pas être saisi manuellement.</p>
        </div>
        <div className="rounded bg-[#0D1526] px-4 py-2 text-right text-white">
          <div className="text-[9px] uppercase tracking-[0.12em] text-white/55">Prix mensuel</div>
          <div className="mt-0.5 text-lg font-bold">{money(result.monthlyTotal)} DH</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 overflow-hidden rounded border border-black/10">
        {(["entreprise", "cabinet"] as const).map((audience) => (
          <button
            key={audience}
            type="button"
            aria-pressed={configuration.audience === audience}
            onClick={() => selectAudience(audience)}
            className={`min-h-11 text-xs font-bold ${audience === "cabinet" ? "border-l border-black/10" : ""} ${configuration.audience === audience ? "bg-[#C8924A] text-white" : "bg-[#FAFAF6] text-gray-600"}`}
          >
            {audience === "entreprise" ? "Entreprise" : "Cabinet"}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {configuration.audience === "entreprise" ? (
          <NumberField label="Espaces entreprise" min={1} value={configuration.workspaces} onChange={(value) => update("workspaces", value)} />
        ) : (
          <>
            <NumberField label="Dossiers gérés" value={configuration.managedDossiers} onChange={(value) => update("managedDossiers", value)} />
            <NumberField label="Utilisateurs clients connectés" value={configuration.connectedClientUsers} onChange={(value) => update("connectedClientUsers", value)} />
          </>
        )}
        <NumberField label={configuration.audience === "cabinet" ? "Collaborateurs du cabinet" : "Utilisateurs"} value={configuration.accountingUsers} onChange={(value) => update("accountingUsers", value)} />
        <NumberField label="Documents OCR / mois" step={100} value={configuration.ocrDocuments} onChange={(value) => update("ocrDocuments", value)} />
        <NumberField label="Employés en paie" value={configuration.payrollEmployees} onChange={(value) => update("payrollEmployees", value)} />
        <NumberField label="Espaces Agent IA" max={PRICING_RULES.includedAiSpaces} value={configuration.aiSpaces} onChange={(value) => update("aiSpaces", value)} />
      </div>

      <div className="mt-4 grid gap-3 rounded bg-[#FAFAF6] p-3 sm:grid-cols-2 xl:grid-cols-5">
        {costLines.map(([label, amount]) => (
          <div key={label}>
            <div className="text-[9px] text-gray-400">{label}</div>
            <div className="mt-1 text-[11px] font-bold">{money(amount)} DH</div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[10px] text-gray-500">Annuel avec 10 % de remise : <b className="text-[#0D1526]">{money(result.annualTotal)} DH</b> · Mise en place, stockage et jusqu’à 5 espaces IA inclus.</p>
        <button type="button" disabled={busy} onClick={() => void save()} className="rounded bg-[#0D1526] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">
          {busy ? "Enregistrement…" : "Enregistrer ce tarif"}
        </button>
      </div>
      {message && <p className="mt-3 rounded bg-red-50 p-2 text-[10.5px] text-red-700">{message}</p>}
    </section>
  );
}
