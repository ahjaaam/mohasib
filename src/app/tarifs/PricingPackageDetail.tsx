"use client";

import { useState } from "react";
import type { PricingPackage } from "./pricing-data";
import styles from "./tarifs.module.css";

const number = new Intl.NumberFormat("fr-MA");

function plural(value: number, singular: string) {
  return `${number.format(value)} ${singular}${value > 1 ? "s" : ""}`;
}

function metricsFor(item: PricingPackage, quantity: number) {
  if (item.slug === "entreprise") {
    const extra = quantity - 1;
    return [
      [number.format(100 + extra * 50), "documents OCR / mois"],
      [`${5 + extra * 5} Go`, "stockage sécurisé"],
      [number.format(10 + extra * 5), "crédits d’extraction"],
    ];
  }
  if (item.slug === "cabinet") {
    return [
      [number.format(quantity * 50), "documents OCR / mois"],
      [`${quantity * 5} Go`, "stockage sécurisé"],
      [number.format(Math.max(2, Math.ceil(quantity / 10))), "collaborateurs cabinet"],
    ];
  }
  return [
    [number.format(quantity * 100), "documents OCR / mois"],
    [number.format(quantity), "utilisateur entreprise / espace"],
    ["Inclus", "accès comptable"],
  ];
}

export default function PricingPackageDetail({ item }: { item: PricingPackage }) {
  const [quantity, setQuantity] = useState(item.min);
  const metrics = metricsFor(item, quantity);
  const isBusiness = item.slug === "entreprise";
  const extra = isBusiness ? quantity - 1 : 0;
  const total = isBusiness ? item.price + extra * 99 : item.price * quantity;

  return (
    <>
      <div className={styles.detail}>
        <section className={styles.summary}>
          <h2>{item.detailName}</h2>
          <div className={styles.price}>{number.format(item.price)} DH <small>{item.priceSuffix}</small></div>
          {item.minimumNote && <p className={styles.muted}>{item.minimumNote}</p>}
          <ul>{item.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
        </section>
        <section className={styles.calculator}>
          <div className={styles.sliderRow}>
            <div><h3>{item.sliderLabel}</h3><span className={styles.muted}>{item.sliderHint}</span></div>
            <output>{plural(quantity, item.sliderUnit)}</output>
          </div>
          <input className={styles.range} type="range" min={item.min} max={item.max} step="1" value={quantity} aria-label={item.sliderLabel} onChange={(event) => setQuantity(Number(event.target.value))} />
          <div className={styles.metrics}>
            {metrics.map(([value, label]) => <div className={styles.metric} key={label}><strong>{value}</strong><span>{label}</span></div>)}
          </div>
          <div className={styles.calculation}>
            {isBusiness ? (
              <>
                <div className={styles.line}><span>Formule Entreprise</span><span>299 DH</span></div>
                <div className={styles.line}><span>{extra ? plural(extra, "utilisateur supplémentaire") : "Aucun utilisateur supplémentaire"}</span><span>{number.format(extra * 99)} DH</span></div>
              </>
            ) : (
              <div className={styles.line}><span>{plural(quantity, item.sliderUnit)}</span><span>× {number.format(item.price)} DH</span></div>
            )}
            <div className={`${styles.line} ${styles.total}`}><span>Total mensuel TTC</span><span>{number.format(total)} DH</span></div>
          </div>
        </section>
      </div>
      <section className={styles.addons}>
        <h2>Modules complémentaires</h2>
        <div className={styles.addonTable} role="table" aria-label="Modules complémentaires">
          <div className={styles.addonHeader} role="row"><span role="columnheader">Module</span><span role="columnheader">Ce qu’il ajoute</span><span role="columnheader">Prix TTC</span></div>
          {item.addons.map((addon) => (
            <div className={styles.addonRow} role="row" key={addon.name}><strong role="cell">{addon.name}</strong><span role="cell">{addon.description}</span><span role="cell">{addon.price}</span></div>
          ))}
        </div>
      </section>
    </>
  );
}
