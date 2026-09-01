"use client";

import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import {
  calculatePricing,
  DEFAULT_CABINET_PRICING_CONFIGURATION,
  DEFAULT_PRICING_CONFIGURATION,
  PRICING_RULES,
  type PricingAudience,
  type PricingConfiguration,
} from "./pricing-engine";
import styles from "./PricingSimulator.module.css";

const audienceLabels: Record<PricingAudience, string> = {
  entreprise: "Entreprise",
  cabinet: "Cabinet",
};

const defaultConfigurations: Record<PricingAudience, PricingConfiguration> = {
  entreprise: DEFAULT_PRICING_CONFIGURATION,
  cabinet: DEFAULT_CABINET_PRICING_CONFIGURATION,
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("fr-MA").format(value);
}

function QuantityField({
  id,
  label,
  hint,
  value,
  min = 0,
  max,
  step = 1,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  const hintId = `${id}-hint`;

  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={step}
        value={value}
        autoComplete="off"
        aria-describedby={hintId}
        onChange={(event) => {
          const next = Number(event.target.value);
          const bounded = Number.isFinite(next) ? Math.max(min, next) : min;
          onChange(max === undefined ? bounded : Math.min(max, bounded));
        }}
      />
      <small id={hintId}>{hint}</small>
    </div>
  );
}

export default function PricingSimulator() {
  const [audience, setAudience] = useState<PricingAudience>("entreprise");
  const [configurations, setConfigurations] = useState<Record<PricingAudience, PricingConfiguration>>(() => ({
    entreprise: { ...DEFAULT_PRICING_CONFIGURATION },
    cabinet: { ...DEFAULT_CABINET_PRICING_CONFIGURATION },
  }));
  const configuration = configurations[audience];
  const result = useMemo(() => calculatePricing(configuration), [configuration]);

  const update = <Key extends keyof PricingConfiguration>(key: Key, value: PricingConfiguration[Key]) => {
    setConfigurations((current) => ({
      ...current,
      [audience]: { ...current[audience], [key]: value },
    }));
  };

  const resetConfiguration = () => {
    setConfigurations((current) => ({
      ...current,
      [audience]: { ...defaultConfigurations[audience] },
    }));
  };

  const lines = [
    ["Abonnement de base", result.base],
    ["Dossiers supplémentaires", result.additionalDossiers],
    ["Utilisateurs supplémentaires", result.users],
    ["Blocs OCR supplémentaires", result.ocr],
    ["Employés en paie supplémentaires", result.payroll],
  ] as const;

  return (
    <div className={styles.simulator}>
      <section className={styles.offerPicker} aria-labelledby="pricing-profile-title">
        <div className={styles.pickerCopy}>
          <p>Votre structure</p>
          <h2 id="pricing-profile-title">Choisissez votre profil</h2>
        </div>
        <div className={styles.tabs} role="group" aria-label="Type d’offre">
          {(["entreprise", "cabinet"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={audience === option}
              className={`${styles.tab} ${audience === option ? styles.tabActive : ""}`}
              onClick={() => setAudience(option)}
            >
              {audienceLabels[option]}
              <small>{option === "entreprise" ? "À partir de 299 DH / mois" : "À partir de 899 DH / mois"}</small>
            </button>
          ))}
        </div>
      </section>

      <div className={styles.body}>
        <section className={styles.form}>
          <div className={styles.sectionHead}>
            <div>
              <h2>Configuration</h2>
              <p>Modifiez uniquement les éléments utiles au calcul.</p>
            </div>
            <button type="button" className={styles.reset} onClick={resetConfiguration}>
              <RotateCcw size={14} aria-hidden="true" />
              Réinitialiser
            </button>
          </div>

          <div className={styles.fields}>
            {configuration.audience === "entreprise" ? (
              <QuantityField
                id="pricing-workspaces"
                label="Espaces entreprise"
                hint="299 DH par espace, avec 1 utilisateur et 100 documents OCR inclus."
                value={configuration.workspaces}
                min={1}
                onChange={(value) => update("workspaces", value)}
              />
            ) : (
              <>
                <QuantityField
                  id="pricing-dossiers"
                  label="Dossiers gérés"
                  hint="10 dossiers inclus, puis 190 DH par dossier supplémentaire."
                  value={configuration.managedDossiers}
                  onChange={(value) => update("managedDossiers", value)}
                />
                <QuantityField
                  id="pricing-client-users"
                  label="Utilisateurs clients connectés"
                  hint="1 utilisateur inclus par dossier, puis 49 DH par utilisateur supplémentaire."
                  value={configuration.connectedClientUsers}
                  onChange={(value) => update("connectedClientUsers", value)}
                />
              </>
            )}

            <QuantityField
              id="pricing-accounting-users"
              label={configuration.audience === "cabinet" ? "Collaborateurs du cabinet" : "Utilisateurs"}
              hint={configuration.audience === "cabinet"
                ? "2 collaborateurs inclus, puis 99 DH par collaborateur supplémentaire."
                : "1 utilisateur inclus par espace, puis 99 DH par utilisateur supplémentaire."}
              value={configuration.accountingUsers}
              min={1}
              onChange={(value) => update("accountingUsers", value)}
            />
            <QuantityField
              id="pricing-ocr"
              label="Documents OCR par mois"
              hint={`${formatMoney(result.includedOcr)} inclus. Chaque bloc supplémentaire de 100 coûte 75 DH.`}
              value={configuration.ocrDocuments}
              step={100}
              onChange={(value) => update("ocrDocuments", value)}
            />
            <QuantityField
              id="pricing-payroll"
              label="Employés en paie"
              hint="Les 20 premiers sont inclus, puis 7 DH par employé supplémentaire."
              value={configuration.payrollEmployees}
              onChange={(value) => update("payrollEmployees", value)}
            />
            <QuantityField
              id="pricing-ai"
              label="Espaces Agent IA"
              hint="Gratuits, avec un maximum de 5 espaces."
              value={configuration.aiSpaces}
              max={PRICING_RULES.includedAiSpaces}
              onChange={(value) => update("aiSpaces", value)}
            />
          </div>
        </section>

        <aside className={styles.summary}>
          <p className={styles.summaryEyebrow}>Votre estimation</p>
          <h2>{audienceLabels[configuration.audience]}</h2>
          <p className={styles.summaryIntro}>Estimation mensuelle TTC</p>

          <div className={styles.price} aria-live="polite" aria-atomic="true">
            <span>Prix final</span>
            <output>{formatMoney(result.monthlyTotal)}&nbsp;DH</output>
            <small>par mois, TTC</small>
            <p className={styles.free}>Mise en place gratuite</p>
          </div>

          <dl className={styles.breakdown}>
            {lines.map(([label, amount]) => (
              <div key={label} className={`${styles.line} ${amount === 0 ? styles.lineMuted : ""}`}>
                <dt>{label}</dt>
                <dd>{formatMoney(amount)} DH</dd>
              </div>
            ))}
          </dl>

          <p className={styles.annual}>
            <span>Paiement annuel <small>−10 %</small></span>
            <strong>{formatMoney(result.annualTotal)} DH</strong>
          </p>

          <div className={styles.included}>
            <h3>Inclus dans cette estimation</h3>
            <ul>
              <li>{formatMoney(result.includedOcr)} documents OCR par mois</li>
              <li>20 employés en paie</li>
              <li>Jusqu&apos;à 5 espaces Agent IA</li>
              <li>Mise en place et stockage sans supplément</li>
            </ul>
          </div>

          <p className={styles.rules}>
            Les documents OCR supplémentaires sont arrondis au bloc supérieur de 100. Les montants affichés sont TTC.
          </p>
        </aside>
      </div>
    </div>
  );
}
