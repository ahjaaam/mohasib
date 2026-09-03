import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Calculator,
  Check,
  CircleGauge,
  FileCheck2,
  FolderKanban,
  Landmark,
  ReceiptText,
  Sparkles,
  UsersRound,
} from "lucide-react";
import PublicFooter from "@/components/PublicFooter";
import PublicNavbar from "@/components/PublicNavbar";
import { appUrl } from "@/lib/public-urls";
import { seoMetadata } from "@/lib/seo";
import styles from "./page.module.css";

export const metadata: Metadata = seoMetadata({
  title: "Solutions Mohasib — Automatisez vos opérations comptables",
  description:
    "Découvrez comment Mohasib centralise vos documents, prépare vos écritures, organise vos transactions et simplifie le contrôle comptable.",
  path: "/solutions",
});

const solutionPillars = [
  {
    id: "automatisation",
    title: "Automatisation",
    description:
      "Mohasib prépare les tâches répétitives : extraction, classement, suivi des transactions, relances et écritures comptables.",
    result: "Moins de préparation manuelle",
    icon: Sparkles,
  },
  {
    id: "centralisation",
    title: "Centralisation",
    description:
      "Factures, notes de frais, transactions, paiements et indicateurs restent reliés dans un seul espace.",
    result: "Une information complète et traçable",
    icon: FolderKanban,
  },
  {
    id: "simplification",
    title: "Simplification",
    description:
      "Votre équipe voit ce qui est prêt, ce qui demande un contrôle et ce qui reste à traiter.",
    result: "Des priorités claires au quotidien",
    icon: CircleGauge,
  },
] as const;

const workflows = [
  {
    number: "01",
    title: "Factures fournisseurs et notes de frais",
    summary: "Du document reçu à l’écriture préparée, avec moins de ressaisie.",
    before:
      "Vous ouvrez chaque pièce, relevez les données, préparez la saisie, puis classez le document.",
    withMohasib:
      "Mohasib centralise la pièce, extrait les informations et prépare l’écriture. Vous contrôlez les données et validez le traitement.",
    decision: "Vous validez les données extraites et le traitement comptable proposé.",
    icon: ReceiptText,
  },
  {
    number: "02",
    title: "Transactions bancaires",
    summary: "Vos mouvements bancaires réunis dans un même écran de suivi.",
    before:
      "Vous téléchargez les relevés, recopiez les mouvements et les reclassez dans plusieurs tableaux.",
    withMohasib:
      "Mohasib importe les mouvements et les organise dans un espace unique. Vous complétez les informations qui demandent votre attention.",
    decision: "Vous contrôlez la catégorie et le traitement des mouvements importants.",
    icon: Landmark,
  },
  {
    number: "03",
    title: "Facturation client et recouvrement",
    summary: "Créez la facture, suivez son échéance et enregistrez son paiement au même endroit.",
    before:
      "Vous créez les factures, les envoyez, suivez les échéances, relancez les clients et enregistrez les paiements.",
    withMohasib:
      "Mohasib relie la facture à son échéance et à son règlement. Vous voyez les retards et décidez des relances à envoyer.",
    decision: "Vous confirmez la facture, les cas de relance sensibles et les paiements non identifiés.",
    icon: FileCheck2,
  },
  {
    number: "04",
    title: "Suivi financier et pilotage",
    summary: "Des indicateurs à jour pour décider sans reconstruire vos tableaux.",
    before:
      "Vous rassemblez les données, préparez les tableaux, calculez les indicateurs, comparez les résultats et analysez la situation.",
    withMohasib:
      "Mohasib actualise les indicateurs et fait ressortir les écarts importants. Vous analysez leur cause et décidez de la suite.",
    decision: "Vous gardez l’interprétation, les arbitrages et la décision finale.",
    icon: BarChart3,
  },
  {
    number: "05",
    title: "TVA et préparation comptable",
    summary: "Des contrôles regroupés avant de valider la TVA et les exports.",
    before:
      "Vous vérifiez les écritures, calculez la TVA, préparez les exports, rassemblez les documents et transmettez le dossier à votre comptable.",
    withMohasib:
      "Mohasib rassemble les écritures et les pièces, calcule la TVA et signale les anomalies. Vous validez la période et préparez l’export.",
    decision: "Vous validez la période, les exceptions fiscales et les données à transmettre.",
    icon: Calculator,
  },
  {
    number: "06",
    title: "Paie et tâches administratives",
    summary: "Les variables, validations et bulletins suivent un parcours clair.",
    before:
      "Vous préparez les documents, calculez les éléments de paie, demandez les validations, relancez les personnes concernées et archivez chaque dossier.",
    withMohasib:
      "Mohasib centralise les variables, prépare les éléments de paie et suit les validations avant l’archivage de la période.",
    decision: "Vous contrôlez et confirmez les éléments sensibles avant leur finalisation.",
    icon: UsersRound,
  },
] as const;

export default function WorkflowsPage() {
  return (
    <main className={`public-site ${styles.page}`}>
      <PublicNavbar />

      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <p className="public-eyebrow">Solutions Mohasib</p>
          <h1>Automatisez le travail répétitif.<br />Gardez la décision.</h1>
          <p className={styles.heroDescription}>
            Découvrez comment Mohasib transforme vos documents, paiements et
            données financières en opérations prêtes à contrôler.
          </p>
          <div className={styles.heroActions}>
            <Link href="#nos-solutions" className="public-primary-action">
              Voir les cas d’usage <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link href={appUrl("/inscription")} className="public-secondary-action">
              Essayer Mohasib
            </Link>
          </div>
        </div>
      </section>

      <section id="nos-solutions" className={styles.pillars} aria-labelledby="solutions-title">
        <div className={styles.pillarsHeading}>
          <p className={styles.sectionLabel}>Ce que votre équipe y gagne</p>
          <h2 id="solutions-title">Moins de ressaisie. Plus de visibilité. Un contrôle plus simple.</h2>
        </div>
        <div className={styles.pillarGrid}>
          {solutionPillars.map(({ id, title, description, result, icon: Icon }) => (
            <article id={id} className={styles.pillarCard} key={id}>
              <div className={styles.pillarIcon}>
                <Icon size={24} strokeWidth={1.7} aria-hidden="true" />
              </div>
              <h3>{title}</h3>
              <p>{description}</p>
              <span>{result}</span>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.principle} aria-labelledby="workflow-principle-title">
        <div className={styles.principleInner}>
          <div>
            <p className={styles.sectionLabel}>Le principe</p>
            <h2 id="workflow-principle-title">Mohasib prépare. Vous contrôlez et validez.</h2>
          </div>
          <div className={styles.principleComparison}>
            <article className={styles.principleBefore}>
              <span>Avant Mohasib</span>
              <p>
                Votre équipe collecte, ressaisit, compare et relance dans plusieurs outils.
              </p>
            </article>
            <ArrowRight className={styles.principleArrow} size={24} aria-hidden="true" />
            <article className={styles.principleAfter}>
              <span>Avec Mohasib</span>
              <p>
                Mohasib centralise et prépare les opérations. Votre équipe traite
                les exceptions et garde la décision finale.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section id="cas-usage" className={styles.workflows} aria-labelledby="cas-usage-title">
        <div className={styles.workflowsHeading}>
          <p className={styles.sectionLabel}>Six cas d’usage concrets</p>
          <h2 id="cas-usage-title">Comparez votre processus actuel avec Mohasib</h2>
          <p>
            Voyez précisément ce que Mohasib prépare et les décisions qui restent
            entre vos mains.
          </p>
        </div>

        <div className={styles.workflowList}>
          {workflows.map(({ number, title, summary, before, withMohasib, decision, icon: Icon }) => (
            <article key={number} className={styles.workflowCard}>
              <header className={styles.workflowHeader}>
                <div className={styles.iconTile}>
                  <Icon size={22} strokeWidth={1.7} aria-hidden="true" />
                </div>
                <div>
                  <span className={styles.workflowNumber}>{number}</span>
                  <h3>{title}</h3>
                  <p>{summary}</p>
                </div>
              </header>

              <div className={styles.comparison}>
                <div className={styles.beforeBlock}>
                  <span className={styles.comparisonLabel}>Avant Mohasib</span>
                  <p>{before}</p>
                </div>
                <div className={styles.afterBlock}>
                  <span className={styles.comparisonLabel}>Avec Mohasib</span>
                  <p>{withMohasib}</p>
                </div>
              </div>

              <div className={styles.decisionLine}>
                <Check size={16} strokeWidth={2} aria-hidden="true" />
                <p><strong>Votre décision :</strong> {decision}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.finalCta}>
        <div>
          <p className={styles.sectionLabel}>Commencez à votre rythme</p>
          <h2>Choisissez un premier flux.<br />Connectez le reste ensuite.</h2>
          <p>
            Centralisez d’abord le processus qui vous prend le plus de temps,
            puis étendez Mohasib à vos autres opérations.
          </p>
        </div>
        <Link href={appUrl("/inscription")} className="public-primary-action">
          Essayer Mohasib <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </section>

      <PublicFooter />
    </main>
  );
}
