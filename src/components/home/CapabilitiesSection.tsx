import type { LucideIcon } from "lucide-react";
import {
  Archive,
  BarChart3,
  BookOpenText,
  Bot,
  Boxes,
  Calculator,
  CalendarClock,
  FileText,
  Inbox,
  Landmark,
  ReceiptText,
  Users,
} from "lucide-react";
import styles from "./CapabilitiesSection.module.css";

type Capability = {
  title: string;
  description: string;
  icon: LucideIcon;
};

const capabilities: Capability[] = [
  {
    title: "Achats",
    description: "Factures, dépenses et fournisseurs centralisés",
    icon: Inbox,
  },
  {
    title: "Notes de frais",
    description: "Collecte, extraction et classement",
    icon: ReceiptText,
  },
  {
    title: "Facturation",
    description: "Devis, factures et règlements",
    icon: FileText,
  },
  {
    title: "Suivi des échéances",
    description: "Échéances, retards et relances à suivre",
    icon: CalendarClock,
  },
  {
    title: "Clients",
    description: "Historique, factures et soldes accessibles",
    icon: Users,
  },
  {
    title: "Transactions",
    description: "Mouvements importés et organisés",
    icon: Landmark,
  },
  {
    title: "Pilotage financier",
    description: "Indicateurs et écarts importants à suivre",
    icon: BarChart3,
  },
  {
    title: "Écritures comptables",
    description: "Écritures préparées et traçables",
    icon: BookOpenText,
  },
  {
    title: "Déclarations TVA",
    description: "Calculs et contrôles avant déclaration",
    icon: Calculator,
  },
  {
    title: "Paie",
    description: "Bulletins et déclarations sociales",
    icon: Boxes,
  },
  {
    title: "Mohasib Agent",
    description: "Assistant IA pour retrouver et analyser vos données",
    icon: Bot,
  },
  {
    title: "Exports et archives",
    description: "Dossiers propres, prêts à partager",
    icon: Archive,
  },
];

export default function CapabilitiesSection() {
  return (
    <section className={styles.section} aria-labelledby="capabilities-title">
      <div className={styles.inner}>
        <header className={styles.heading}>
          <p className={styles.eyebrow}>Une plateforme, un suivi continu</p>
          <h2 id="capabilities-title">
            Les outils essentiels pour gérer et contrôler vos finances
          </h2>
          <p>
            De la collecte des pièces aux exports comptables, chaque module partage
            la même information pour éviter les doubles saisies et les fichiers isolés.
          </p>
        </header>

        <ul className={styles.grid} aria-label="Fonctionnalités de Mohasib">
          {capabilities.map(({ title, description, icon: Icon }) => (
            <li className={styles.capability} key={title}>
              <span className={styles.icon} aria-hidden="true">
                <Icon strokeWidth={1.7} />
              </span>
              <h3>{title}</h3>
              <p>{description}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
