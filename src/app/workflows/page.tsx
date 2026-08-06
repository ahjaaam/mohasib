import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Calculator,
  Check,
  FileCheck2,
  Landmark,
  ReceiptText,
  UsersRound,
} from "lucide-react";
import PublicFooter from "@/components/PublicFooter";
import PublicNavbar from "@/components/PublicNavbar";
import { appUrl } from "@/lib/public-urls";
import { seoMetadata } from "@/lib/seo";
import styles from "./page.module.css";

export const metadata: Metadata = seoMetadata({
  title: "Workflows Mohasib — Automatisez votre gestion comptable",
  description:
    "Découvrez comment Mohasib automatise les factures fournisseurs, le rapprochement bancaire, le recouvrement, la TVA, le pilotage financier et la paie.",
  path: "/workflows",
});

const workflows = [
  {
    number: "01",
    title: "Factures fournisseurs et justificatifs",
    summary: "Du document reçu à la pièce classée, sans ressaisie inutile.",
    before:
      "Vous recevez, vous vérifiez, vous saisissez, vous classez et vous archivez.",
    withMohasib:
      "Mohasib reçoit, extrait les informations et prépare la saisie. Vous confirmez. Mohasib comptabilise, classe et archive.",
    decision: "Vous validez les données extraites et le traitement comptable proposé.",
    icon: ReceiptText,
  },
  {
    number: "02",
    title: "Rapprochement bancaire",
    summary: "Les transactions, justificatifs et écarts réunis dans un même contrôle.",
    before:
      "Vous importez les relevés, recherchez les justificatifs, comparez les montants, rapprochez les transactions et identifiez les écarts.",
    withMohasib:
      "Mohasib lit les relevés, retrouve les justificatifs et propose les rapprochements. Vous confirmez les correspondances; Mohasib signale les écarts.",
    decision: "Vous arbitrez uniquement les rapprochements ambigus ou incomplets.",
    icon: Landmark,
  },
  {
    number: "03",
    title: "Facturation client et recouvrement",
    summary: "De la création de la facture jusqu’à l’encaissement suivi.",
    before:
      "Vous créez les factures, les envoyez, suivez les échéances, relancez les clients et enregistrez les paiements.",
    withMohasib:
      "Mohasib prépare les factures. Vous confirmez. Mohasib les envoie, suit les échéances, prépare les relances et enregistre les paiements importés ou validés.",
    decision: "Vous confirmez la facture, les cas de relance sensibles et les paiements non identifiés.",
    icon: FileCheck2,
  },
  {
    number: "04",
    title: "Suivi financier et pilotage",
    summary: "Des données dispersées transformées en décisions lisibles.",
    before:
      "Vous rassemblez les données, préparez les tableaux, calculez les indicateurs, comparez les résultats et analysez la situation.",
    withMohasib:
      "Mohasib rassemble les données, prépare les tableaux, calcule les indicateurs et détecte les écarts. Vous analysez et prenez les décisions.",
    decision: "Vous gardez l’interprétation, les arbitrages et la décision finale.",
    icon: BarChart3,
  },
  {
    number: "05",
    title: "TVA et préparation comptable",
    summary: "Une comptabilité contrôlée et un dossier prêt à transmettre.",
    before:
      "Vous vérifiez les écritures, calculez la TVA, préparez les exports, rassemblez les documents et transmettez le dossier à votre comptable.",
    withMohasib:
      "Mohasib contrôle les écritures, calcule la TVA, rassemble les pièces et prépare les exports. Vous confirmez; Mohasib constitue le dossier comptable.",
    decision: "Vous validez la période, les exceptions fiscales et les données à transmettre.",
    icon: Calculator,
  },
  {
    number: "06",
    title: "Paie et tâches administratives",
    summary: "Les documents, calculs et validations suivent un parcours traçable.",
    before:
      "Vous préparez les documents, calculez les éléments de paie, demandez les validations, relancez les personnes concernées et archivez chaque dossier.",
    withMohasib:
      "Mohasib prépare les documents, calcule les éléments nécessaires, organise les validations, effectue les relances et archive chaque dossier.",
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
          <p className="public-eyebrow">Workflows Mohasib</p>
          <h1>Mohasib exécute.<br />Vous gardez la décision.</h1>
          <p className={styles.heroDescription}>
            Découvrez comment chaque tâche administrative ou comptable passe
            d’un travail manuel dispersé à un processus structuré, automatisé
            et vérifiable.
          </p>
          <div className={styles.heroActions}>
            <Link href="#tous-les-workflows" className="public-primary-action">
              Voir les workflows <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link href={appUrl("/inscription")} className="public-secondary-action">
              Créer mon espace
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.principle} aria-labelledby="workflow-principle-title">
        <div className={styles.principleInner}>
          <div>
            <p className={styles.sectionLabel}>La logique globale</p>
            <h2 id="workflow-principle-title">Moins d’exécution. Plus de contrôle utile.</h2>
          </div>
          <div className={styles.principleComparison}>
            <article className={styles.principleBefore}>
              <span>Avant Mohasib</span>
              <p>
                Vous recevez, recherchez, saisissez, vérifiez, calculez,
                relancez, classez et archivez.
              </p>
            </article>
            <ArrowRight className={styles.principleArrow} size={24} aria-hidden="true" />
            <article className={styles.principleAfter}>
              <span>Avec Mohasib</span>
              <p>
                Mohasib exécute ces étapes. Vous confirmez uniquement lorsque
                votre décision est nécessaire.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section id="tous-les-workflows" className={styles.workflows} aria-labelledby="workflows-title">
        <div className={styles.workflowsHeading}>
          <p className={styles.sectionLabel}>Six parcours, une seule logique</p>
          <h2 id="workflows-title">Comment le travail change avec Mohasib</h2>
          <p>
            Chaque workflow distingue ce que la plateforme peut exécuter de ce
            qui doit rester sous votre contrôle.
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
          <p className={styles.sectionLabel}>Votre nouveau mode de travail</p>
          <h2>Automatisez l’exécution.<br />Conservez la maîtrise.</h2>
          <p>
            Commencez avec un workflow, puis connectez progressivement vos
            documents, vos paiements et votre comptabilité.
          </p>
        </div>
        <Link href={appUrl("/inscription")} className="public-primary-action">
          Créer mon espace <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </section>

      <PublicFooter />
    </main>
  );
}
