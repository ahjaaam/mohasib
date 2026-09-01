import Image from "next/image";
import { Calculator, Inbox, Link2, ScanText, ShieldCheck } from "lucide-react";
import styles from "./WorkflowCommandCenter.module.css";

const PIPELINE = [
  {
    number: "01",
    title: "Collecter",
    description: "Vos factures et notes de frais arrivent au même endroit.",
    icon: Inbox,
  },
  {
    number: "02",
    title: "Comprendre",
    description: "L’IA extrait et structure les données utiles.",
    icon: ScanText,
  },
  {
    number: "03",
    title: "Relier",
    description: "Chaque transaction est reliée à sa note de frais.",
    icon: Link2,
  },
  {
    number: "04",
    title: "Produire",
    description: "Mohasib prépare l’écriture et le traitement comptable.",
    icon: Calculator,
  },
  {
    number: "05",
    title: "Contrôler",
    description: "Vous contrôlez les exceptions et validez le résultat.",
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
          <strong>Mohasib · Flux comptable</strong>
        </div>
        <span>Du document reçu à l’écriture prête à valider</span>
      </div>

      <div className={styles.content}>
        <header className={styles.intro}>
          <p>Comment fonctionne Mohasib</p>
          <h2 id="command-center-title">Un flux clair, du document à la décision.</h2>
          <span>
            Chaque pièce est lue, structurée et reliée à la bonne opération. Vous obtenez un traitement
            comptable prêt à contrôler, sans perdre la trace du document d’origine.
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
            <strong>Vous gardez la maîtrise</strong>
            <p>
              Chaque chiffre reste relié à sa note de frais, à son paiement et à son écriture&nbsp;:
              vous vérifiez plus vite et savez toujours d’où vient l’information.
            </p>
          </div>
        </div>

      </div>
      </section>
    </div>
  );
}
