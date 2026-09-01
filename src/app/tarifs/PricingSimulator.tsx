"use client";

import { useMemo, useState } from "react";
import {
  calculatePricing,
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
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => {
          const next = Number(event.target.value);
          const bounded = Number.isFinite(next) ? Math.max(min, next) : min;
          onChange(max === undefined ? bounded : Math.min(max, bounded));
        }}
      />
      <small>{hint}</small>
    </div>
  );
}

export default function PricingSimulator() {
  const [configuration, setConfiguration] = useState<PricingConfiguration>(DEFAULT_PRICING_CONFIGURATION);
  const result = useMemo(() => calculatePricing(configuration), [configuration]);

  const update = <Key extends keyof PricingConfiguration>(key: Key, value: PricingConfiguration[Key]) => {
    setConfiguration((current) => ({ ...current, [key]: value }));
  };

  const selectAudience = (audience: PricingAudience) => {
    setConfiguration((current) => ({
      ...current,
      audience,
      accountingUsers: audience === "cabinet" ? Math.max(2, current.accountingUsers) : Math.max(1, current.accountingUsers),
      managedDossiers: audience === "cabinet" ? Math.max(10, current.managedDossiers) : current.managedDossiers,
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
      <div className={styles.tabs} role="group" aria-label="Type d’offre">
        {(["entreprise", "cabinet"] as const).map((audience) => (
          <button
            key={audience}
            type="button"
            aria-pressed={configuration.audience === audience}
            className={`${styles.tab} ${configuration.audience === audience ? styles.tabActive : ""}`}
            onClick={() => selectAudience(audience)}
          >
            {audienceLabels[audience]}
            <small>{audience === "entreprise" ? "299 DH par espace" : "899 DH avec 10 dossiers"}</small>
          </button>
        ))}
      </div>

      <div className={styles.body}>
        <section className={styles.form}>
          <div className={styles.sectionHead}>
            <div>
              <h2>Configuration</h2>
              <p>Modifiez uniquement les éléments utiles au calcul.</p>
            </div>
            <button type="button" className={styles.reset} onClick={() => setConfiguration(DEFAULT_PRICING_CONFIGURATION)}>
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

        <aside className={styles.summary} aria-live="polite">
          <h2>{audienceLabels[configuration.audience]}</h2>
          <p className={styles.summaryIntro}>Estimation mensuelle TTC</p>

          <div className={styles.price}>
            <span>Prix final</span>
            <strong>{formatMoney(result.monthlyTotal)} DH</strong>
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
            <span>Total sur 12 mois</span>
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
