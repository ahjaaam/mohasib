"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Info, Minus, Plus } from "lucide-react";
import { appUrl } from "@/lib/public-urls";

type Audience = "entreprise" | "cabinet";

type Configuration = {
  documents: number;
  users: number;
  employees: number;
  managedClients: number;
  connectedClients: number;
  clientUsers: number;
};

type BreakdownLine = {
  label: string;
  detail: string;
  amount: number;
};

type FlexOffer = {
  id: Audience;
  name: string;
  description: string;
  price: number;
  features: string[];
  included: string[];
  breakdown: BreakdownLine[];
};

const PRICES = {
  entrepriseBase: 299,
  cabinetBase: 499,
  additionalUser: 99,
  additionalClientUser: 49,
  additionalEmployee: 12,
  managedClient: 49,
  connectedClient: 149,
  documentBandOne: 0.75,
  documentBandTwo: 0.5,
  documentBandThree: 0.3,
} as const;

const INITIAL_CONFIGURATION: Record<Audience, Configuration> = {
  entreprise: {
    documents: 100,
    users: 1,
    employees: 5,
    managedClients: 0,
    connectedClients: 0,
    clientUsers: 0,
  },
  cabinet: {
    documents: 0,
    users: 2,
    employees: 0,
    managedClients: 5,
    connectedClients: 5,
    clientUsers: 0,
  },
};

function businessDocumentCost(totalDocuments: number) {
  const bandOne = Math.max(0, Math.min(totalDocuments, 500) - 100);
  const bandTwo = Math.max(0, Math.min(totalDocuments, 2_000) - 500);
  const bandThree = Math.max(0, totalDocuments - 2_000);
  return (
    bandOne * PRICES.documentBandOne
    + bandTwo * PRICES.documentBandTwo
    + bandThree * PRICES.documentBandThree
  );
}

function additionalDocumentCost(additionalDocuments: number) {
  const bandOne = Math.min(additionalDocuments, 500);
  const bandTwo = Math.max(0, Math.min(additionalDocuments, 2_000) - 500);
  const bandThree = Math.max(0, additionalDocuments - 2_000);
  return (
    bandOne * PRICES.documentBandOne
    + bandTwo * PRICES.documentBandTwo
    + bandThree * PRICES.documentBandThree
  );
}

function buildOffer(audience: Audience, configuration: Configuration): FlexOffer {
  if (audience === "entreprise") {
    const additionalDocuments = Math.max(0, configuration.documents - 100);
    const additionalEmployees = Math.max(0, configuration.employees - 5);
    const additionalUsers = Math.max(0, configuration.users - 1);
    const documentAmount = businessDocumentCost(configuration.documents);
    const employeeAmount = additionalEmployees * PRICES.additionalEmployee;
    const userAmount = additionalUsers * PRICES.additionalUser;
    const breakdown: BreakdownLine[] = [
      { label: "Entreprise Flex", detail: "Base mensuelle", amount: PRICES.entrepriseBase },
      ...(additionalDocuments > 0
        ? [{ label: "Documents OCR", detail: `${formatNumber(additionalDocuments)} au-delà des 100 inclus`, amount: documentAmount }]
        : []),
      ...(additionalEmployees > 0
        ? [{ label: "Employés en paie", detail: `${additionalEmployees} supplémentaire${additionalEmployees > 1 ? "s" : ""}`, amount: employeeAmount }]
        : []),
      ...(additionalUsers > 0
        ? [{ label: "Utilisateurs", detail: `${additionalUsers} supplémentaire${additionalUsers > 1 ? "s" : ""}`, amount: userAmount }]
        : []),
    ];

    return {
      id: audience,
      name: "Entreprise Flex",
      description: "Une base complète pour votre entreprise, puis un prix qui évolue uniquement avec votre usage réel.",
      price: breakdown.reduce((total, line) => total + line.amount, 0),
      features: [
        "Factures et devis illimités",
        "Comptabilité, TVA et suivi des échéances",
        "Import bancaire et saisie comptable",
        "Avoirs, exports, bilan et CPC",
        "Support 7j/7",
      ],
      included: ["100 documents OCR", "1 utilisateur", "Paie pour 5 employés"],
      breakdown,
    };
  }

  const additionalCollaborators = Math.max(0, configuration.users - 2);
  const documentAmount = additionalDocumentCost(configuration.documents);
  const employeeAmount = configuration.employees * PRICES.additionalEmployee;
  const collaboratorAmount = additionalCollaborators * PRICES.additionalUser;
  const managedClientAmount = configuration.managedClients * PRICES.managedClient;
  const connectedClientAmount = configuration.connectedClients * PRICES.connectedClient;
  const clientUserAmount = configuration.clientUsers * PRICES.additionalClientUser;
  const breakdown: BreakdownLine[] = [
    { label: "Cabinet Flex", detail: "Base mensuelle", amount: PRICES.cabinetBase },
    ...(configuration.managedClients > 0
      ? [{ label: "Dossiers gérés", detail: `${configuration.managedClients} × ${PRICES.managedClient} DH`, amount: managedClientAmount }]
      : []),
    ...(configuration.connectedClients > 0
      ? [{ label: "Espaces clients connectés", detail: `${configuration.connectedClients} × ${PRICES.connectedClient} DH`, amount: connectedClientAmount }]
      : []),
    ...(configuration.documents > 0
      ? [{ label: "Documents OCR supplémentaires", detail: `${formatNumber(configuration.documents)} documents`, amount: documentAmount }]
      : []),
    ...(configuration.employees > 0
      ? [{ label: "Employés en paie", detail: `${configuration.employees} × ${PRICES.additionalEmployee} DH`, amount: employeeAmount }]
      : []),
    ...(additionalCollaborators > 0
      ? [{ label: "Collaborateurs", detail: `${additionalCollaborators} supplémentaire${additionalCollaborators > 1 ? "s" : ""}`, amount: collaboratorAmount }]
      : []),
    ...(configuration.clientUsers > 0
      ? [{ label: "Utilisateurs clients", detail: `${configuration.clientUsers} supplémentaire${configuration.clientUsers > 1 ? "s" : ""}`, amount: clientUserAmount }]
      : []),
  ];

  return {
    id: audience,
    name: "Cabinet Flex",
    description: "Le cabinet paie sa plateforme et choisit, client par client, un dossier géré ou un espace métier complet.",
    price: breakdown.reduce((total, line) => total + line.amount, 0),
    features: [
      "Tableau de bord cabinet et boîte globale",
      "Déclarations, exports et opérations en masse",
      "Toutes les fonctions Entreprise dans chaque espace connecté",
      "1 utilisateur et 50 documents inclus par espace connecté",
      "Support prioritaire 7j/7",
    ],
    included: ["2 collaborateurs", "Pilotage multi-dossiers", "Accès comptable aux espaces"],
    breakdown,
  };
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("fr-MA").format(value);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("fr-MA", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function QuantityControl({
  label,
  hint,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  const percent = ((value - min) / (max - min)) * 100;
  const setValue = (next: number) => onChange(Math.min(max, Math.max(min, next)));

  return (
    <div className="border-b border-[#DFE2E7] py-5 first:pt-0 last:border-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <h3 className="text-[14px] font-bold text-[#0D1526] sm:text-[15px]">{label}</h3>
          <span title={hint} className="inline-flex text-[#8C94A3]">
            <Info aria-hidden="true" size={15} />
            <span className="sr-only">{hint}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={`Réduire ${label.toLowerCase()}`}
            disabled={value === min}
            onClick={() => setValue(value - step)}
            className="grid size-9 place-items-center border border-[#D7DBE2] bg-white text-[#0D1526] transition hover:border-[#A89596] disabled:cursor-not-allowed disabled:opacity-35"
          >
            <Minus size={15} />
          </button>
          <output className="min-w-[122px] border border-[#E5E7EB] bg-[#F8F8F6] px-3 py-2 text-center text-[12px] font-bold text-[#0D1526]">
            {formatNumber(value)} {suffix}
          </output>
          <button
            type="button"
            aria-label={`Augmenter ${label.toLowerCase()}`}
            disabled={value === max}
            onClick={() => setValue(value + step)}
            className="grid size-9 place-items-center border border-[#D7DBE2] bg-white text-[#0D1526] transition hover:border-[#A89596] disabled:cursor-not-allowed disabled:opacity-35"
          >
            <Plus size={15} />
          </button>
        </div>
      </div>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => setValue(Number(event.target.value))}
        className="pricing-range mt-4 w-full"
        style={{ "--range-progress": `${percent}%` } as React.CSSProperties}
      />
      <div className="mt-2 flex justify-between text-[9px] font-semibold uppercase tracking-[0.12em] text-[#9AA0AA]">
        <span>{formatNumber(min)}</span>
        <span>{formatNumber(max)}</span>
      </div>
    </div>
  );
}

export default function PricingCalculator() {
  const [audience, setAudience] = useState<Audience>("entreprise");
  const [configurations, setConfigurations] = useState(INITIAL_CONFIGURATION);
  const configuration = configurations[audience];
  const offer = useMemo(() => buildOffer(audience, configuration), [audience, configuration]);

  const update = (key: keyof Configuration, value: number) => {
    setConfigurations((current) => ({
      ...current,
      [audience]: { ...current[audience], [key]: value },
    }));
  };

  const reset = () => {
    setConfigurations((current) => ({ ...current, [audience]: INITIAL_CONFIGURATION[audience] }));
  };

  return (
    <div>
      <div className="mb-7 flex flex-col justify-between gap-5 border-b border-[#D1D5DB] pb-6 sm:flex-row sm:items-end">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8B765A]">Configurez votre espace</p>
          <h2 className="mt-2 text-[28px] font-bold tracking-[-0.025em] text-[#0D1526] sm:text-[36px]">
            Votre usage. Votre prix.
          </h2>
        </div>
        <div className="flex w-full border border-[#D8DADF] bg-[#F6F5F3] p-1 sm:w-auto">
          {([
            ["entreprise", "Entreprise"],
            ["cabinet", "Cabinet comptable"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={audience === value}
              onClick={() => setAudience(value)}
              className={`min-h-10 flex-1 px-4 text-[11px] font-bold transition sm:flex-none ${
                audience === value ? "bg-[#0D1526] text-white shadow-sm" : "text-[#626874] hover:bg-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden border border-[#C9CED7] bg-white shadow-[0_24px_70px_rgba(13,21,38,0.08)] lg:grid lg:grid-cols-[0.88fr_1.12fr]">
        <section
          className="flex flex-col p-7 text-white sm:p-10"
          style={{ background: "linear-gradient(145deg, #1e2536 0%, #000000 100%)" }}
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#D4B98F]">Votre offre flexible</p>
            <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
              <h3 className="max-w-[310px] text-[31px] font-bold leading-[1.05] tracking-[-0.035em] sm:text-[38px]">
                {offer.name}
              </h3>
              <span className="border border-white/20 bg-white/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-[#E7D3B5]">
                Prix TTC
              </span>
            </div>
            <p className="mt-5 max-w-[430px] text-[13px] leading-6 text-[#B9C0CD]">{offer.description}</p>
          </div>

          <div className="my-8 border-y border-white/15 py-7">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#99A3B4]">Total mensuel TTC</p>
            <div className="mt-3 flex items-end gap-2">
              <span className="text-[58px] font-extrabold leading-[0.85] tracking-[-0.06em] sm:text-[70px]">
                {formatMoney(offer.price)}
              </span>
              <span className="pb-1 text-[12px] font-semibold text-[#AEB6C4]">DH / mois</span>
            </div>
            <p className="mt-4 text-[10.5px] text-[#8F99A9]">Estimation mensuelle · Tous les montants sont TTC</p>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#99A3B4]">Détail de votre prix TTC</p>
            <div className="mt-4 divide-y divide-white/10 border-y border-white/10">
              {offer.breakdown.map((line) => (
                <div key={line.label} className="flex items-start justify-between gap-5 py-3">
                  <div>
                    <p className="text-[12px] font-semibold text-[#E5E8ED]">{line.label}</p>
                    <p className="mt-0.5 text-[9.5px] text-[#8F99A9]">{line.detail}</p>
                  </div>
                  <p className="shrink-0 text-[12px] font-bold text-[#E7D3B5]">{formatMoney(line.amount)} DH</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#99A3B4]">Fonctionnalités incluses</p>
            <ul className="mt-4 space-y-3">
              {offer.features.map((feature) => (
                <li key={feature} className="flex items-start gap-3 text-[12px] leading-5 text-[#E5E8ED]">
                  <Check className="mt-0.5 shrink-0 text-[#D4B98F]" size={15} />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          <Link
            href={appUrl("/inscription")}
            className="mt-9 inline-flex min-h-12 items-center justify-between gap-8 bg-white px-5 text-[12.5px] font-bold text-[#0D1526] transition-colors hover:bg-[#F1EDE7]"
          >
            Créer un compte gratuitement
            <ArrowRight size={15} />
          </Link>
        </section>

        <section className="relative p-7 sm:p-10">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              backgroundImage: "repeating-linear-gradient(45deg, rgba(13,21,38,.018) 0, rgba(13,21,38,.018) 1px, transparent 1px, transparent 8px)",
            }}
          />
          <div className="relative">
            <div className="flex items-start justify-between gap-4 border-b border-[#D8DCE3] pb-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-[#8B765A]">Estimez votre abonnement</p>
                <p className="mt-2 max-w-[500px] text-[12px] leading-5 text-[#747B87]">
                  Ajustez chaque quantité. Le total TTC est recalculé immédiatement, sans changement de plan.
                </p>
              </div>
              <button type="button" onClick={reset} className="shrink-0 text-[10px] font-bold text-[#707783] underline underline-offset-4 hover:text-[#0D1526]">
                Réinitialiser
              </button>
            </div>

            <div className="py-7">
              {audience === "entreprise" ? (
                <>
                  <QuantityControl label="Documents traités" hint="100 documents OCR sont inclus. Le tarif est progressif au-delà." value={configuration.documents} min={100} max={3000} step={50} suffix="/ mois" onChange={(value) => update("documents", value)} />
                  <QuantityControl label="Utilisateurs" hint="1 utilisateur est inclus, puis 99 DH TTC par utilisateur supplémentaire." value={configuration.users} min={1} max={10} step={1} suffix={configuration.users > 1 ? "utilisateurs" : "utilisateur"} onChange={(value) => update("users", value)} />
                  <QuantityControl label="Employés en paie" hint="5 employés sont inclus, puis 12 DH TTC par employé actif supplémentaire." value={configuration.employees} min={5} max={200} step={5} suffix="employés" onChange={(value) => update("employees", value)} />
                </>
              ) : (
                <>
                  <QuantityControl label="Dossiers gérés" hint="Dossiers tenus par le cabinet sans accès utilisateur pour le client : 49 DH TTC chacun." value={configuration.managedClients} min={0} max={100} step={5} suffix="dossiers" onChange={(value) => update("managedClients", value)} />
                  <QuantityControl label="Espaces clients connectés" hint="Espace métier complet avec toutes les fonctions Entreprise, 1 utilisateur et 50 documents inclus : 149 DH TTC chacun." value={configuration.connectedClients} min={0} max={100} step={5} suffix="espaces" onChange={(value) => update("connectedClients", value)} />
                  <QuantityControl label="Collaborateurs du cabinet" hint="2 collaborateurs sont inclus, puis 99 DH TTC par collaborateur supplémentaire." value={configuration.users} min={2} max={20} step={1} suffix="collaborateurs" onChange={(value) => update("users", value)} />
                  <QuantityControl label="Documents OCR supplémentaires" hint="Documents consommés au-delà des 50 inclus dans chaque espace client connecté." value={configuration.documents} min={0} max={3000} step={100} suffix="/ mois" onChange={(value) => update("documents", value)} />
                  <QuantityControl label="Employés en paie" hint="12 DH TTC par employé actif géré par le cabinet." value={configuration.employees} min={0} max={500} step={10} suffix="employés" onChange={(value) => update("employees", value)} />
                  <QuantityControl label="Utilisateurs clients supplémentaires" hint="Chaque espace connecté inclut 1 utilisateur client, puis 49 DH TTC par utilisateur supplémentaire." value={configuration.clientUsers} min={0} max={100} step={5} suffix="utilisateurs" onChange={(value) => update("clientUsers", value)} />
                  <div className="mt-5 border border-[#DED7CA] bg-[#FAF7F1] p-4 text-[10.5px] leading-5 text-[#6F665A]">
                    Un client qui souscrit directement à Entreprise Flex paie 299 DH TTC/mois à Mohasib. Son accès comptable ne génère aucun coût supplémentaire pour le cabinet.
                  </div>
                </>
              )}
            </div>

            <div className="border-t-2 border-[#0D1526] pt-5">
              <div className="flex items-center justify-between gap-5">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7A818E]">Votre configuration</p>
                  <p className="mt-1 text-[17px] font-bold text-[#0D1526]">{offer.name}</p>
                </div>
                <p className="text-right text-[25px] font-extrabold tracking-[-0.04em] text-[#0D1526]">
                  {formatMoney(offer.price)} <span className="text-[10px] font-semibold tracking-normal text-[#818895]">DH TTC / mois</span>
                </p>
              </div>
              <div className="mt-5 grid gap-2 border-t border-[#D8DCE3] pt-4 sm:grid-cols-3">
                {offer.included.map((item) => (
                  <div key={item} className="flex items-start gap-2 text-[10.5px] leading-4 text-[#656D79]">
                    <Check className="mt-0.5 shrink-0 text-[#9A7747]" size={13} />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-[10px] leading-4 text-[#8A909A]">
                Estimation TTC basée sur les quantités indiquées. Les clients facturés directement ne sont jamais refacturés au cabinet.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
