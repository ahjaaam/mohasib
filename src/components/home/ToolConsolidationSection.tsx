import Image from "next/image";
import Link from "next/link";
import styles from "./ToolConsolidationSection.module.css";

const tools = [
  { name: "Excel", image: "/images/excel-logo-cropped.png", className: styles.excel },
  { name: "WhatsApp", image: "/images/whatsapp-logo-cropped.png", className: styles.whatsapp },
  { name: "Outlook", image: "/images/outlook-logo-cropped.png", className: styles.outlook },
  { name: "Gmail", image: "/images/gmail-logo-cropped.png", className: styles.gmail },
  { name: "Google Drive", image: "/images/google-drive-logo-cropped.png", className: styles.drive },
  { name: "Sage", image: "/images/sage-logo-cropped.png", className: styles.sage, wide: true },
  { name: "ChatGPT", image: "/images/chatgpt-logo.jpg", className: styles.chatgpt },
  { name: "Claude", image: "/images/claude-logo.jpg", className: styles.claude },
  { name: "Word", image: "/images/word-logo-cropped.png", className: styles.word },
] as const;

export default function ToolConsolidationSection() {
  return (
    <section className={styles.section} aria-labelledby="tool-consolidation-title">
      <div className={styles.inner}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>Une seule plateforme</p>
          <h2 id="tool-consolidation-title">Fatigué de jongler avec trop d’outils&nbsp;?</h2>
          <p className={styles.lead}>
            Vos factures arrivent par e-mail et WhatsApp. Vos suivis vivent dans
            Excel. Vos pièces sont dispersées entre Drive, Word et vos dossiers.
          </p>
          <p className={styles.answer}>
            Mohasib rassemble ces flux, comprend vos documents et transforme
            l’information dispersée en tâches comptables prêtes à contrôler.
          </p>

          <div className={styles.outcomes} aria-label="Ce que Mohasib centralise">
            <div><span>01</span><strong>Collecter</strong><p>E-mails, messages et documents</p></div>
            <div><span>02</span><strong>Structurer</strong><p>Données et pièces comptables</p></div>
            <div><span>03</span><strong>Exécuter</strong><p>Workflows prêts à valider</p></div>
          </div>

          <Link className={styles.contactButton} href="/centre-aide">
            Nous contacter
          </Link>
        </div>

        <div className={styles.constellation} aria-label="Vos outils connectés à Mohasib">
          <div className={styles.orbit}>
            <svg className={styles.connections} viewBox="0 0 620 600" preserveAspectRatio="none" aria-hidden="true">
              <line x1="310" y1="300" x2="310" y2="60" />
              <line x1="310" y1="300" x2="461" y2="116" />
              <line x1="310" y1="300" x2="542" y2="259" />
              <line x1="310" y1="300" x2="514" y2="420" />
              <line x1="310" y1="300" x2="391" y2="526" />
              <line x1="310" y1="300" x2="229" y2="526" />
              <line x1="310" y1="300" x2="106" y2="420" />
              <line x1="310" y1="300" x2="78" y2="259" />
              <line x1="310" y1="300" x2="130" y2="116" />
            </svg>

            {tools.map((tool) => (
              <div className={`${styles.tool} ${tool.className}`} key={tool.name}>
                <Image className={"wide" in tool && tool.wide ? styles.wideLogo : undefined} src={tool.image} alt={tool.name} width={58} height={58} />
                <span>{tool.name}</span>
              </div>
            ))}
          </div>

          <div className={styles.centerMark}>
            <Image src="/logo2.png" alt="Mohasib AI" width={154} height={31} />
          </div>
        </div>
      </div>
    </section>
  );
}
