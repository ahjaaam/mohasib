import Image from "next/image";
import { Calculator, Inbox, Link2, ScanText, ShieldCheck } from "lucide-react";
import styles from "./WorkflowCommandCenter.module.css";

const PIPELINE = [
  {
    number: "01",
    title: "Collecter",
    description: "Toutes vos preuves arrivent au même endroit.",
    icon: Inbox,
  },
  {
    number: "02",
    title: "Comprendre",
    description: "L’IA extrait, vérifie et normalise les données.",
    icon: ScanText,
  },
  {
    number: "03",
    title: "Relier",
    description: "Chaque mouvement retrouve son document et son contexte.",
    icon: Link2,
  },
  {
    number: "04",
    title: "Produire",
    description: "Mohasib prépare les conséquences comptables.",
    icon: Calculator,
  },
  {
    number: "05",
    title: "Contrôler",
    description: "Vous validez un résultat traçable et explicable.",
    icon: ShieldCheck,
  },
] as const;

export default function WorkflowCommandCenter() {
  return (
    <div className={styles.zoomStage}>
      <section className={styles.frame} aria-labelledby="command-center-title">
      <div className={styles.topbar}>
        <div className={styles.brand}>
          <Image
            className={styles.brandIcon}
            src="/favicon.png"
            alt=""
            width={14}
            height={14}
            aria-hidden="true"
          />
          <strong>Mohasib · Centre d’exécution</strong>
        </div>
        <span>De la preuve à une comptabilité prête à valider</span>
      </div>

      <div className={styles.content}>
        <header className={styles.intro}>
          <p>Le système Mohasib</p>
          <h2 id="command-center-title">Une chaîne comptable continue, de la pièce à la décision.</h2>
          <span>
            Mohasib ne juxtapose pas des fonctionnalités. Il transforme chaque document en une donnée
            exploitable, reliée à son opération et traduite en résultat comptable contrôlable.
          </span>
        </header>

        <ol className={styles.pipeline} aria-label="Les cinq étapes du système comptable Mohasib">
          {PIPELINE.map((stage, index) => {
            const Icon = stage.icon;

            return (
              <li className={styles.stage} key={stage.number}>
                <svg className={`${styles.stageOutline} ${styles.stageOutlineDesktop}`} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  <polygon
                    points={index === 0 ? "0,0 88,0 100,50 88,100 0,100" : "0,0 88,0 100,50 88,100 0,100 12,50"}
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
                <svg className={`${styles.stageOutline} ${styles.stageOutlineMobile}`} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  <polygon points="0,0 100,0 100,88 50,100 0,88" vectorEffect="non-scaling-stroke" />
                </svg>
                <div className={styles.stageHeading}>
                  <span className={styles.icon} aria-hidden="true"><Icon size={19} strokeWidth={1.8} /></span>
                </div>
                <h3>{stage.title}</h3>
                <p>{stage.description}</p>
              </li>
            );
          })}
        </ol>

        <div className={styles.principle}>
          <div className={styles.principleLoop} aria-hidden="true" />
          <div className={styles.principleCopy}>
            <strong>Le bénéfice central</strong>
            <p>
              Chaque chiffre reste relié à sa preuve, à son paiement et à l’écriture produite&nbsp;:
              moins de saisie, plus de contrôle, une comptabilité toujours explicable.
            </p>
          </div>
        </div>

      </div>
      </section>
    </div>
  );
}
