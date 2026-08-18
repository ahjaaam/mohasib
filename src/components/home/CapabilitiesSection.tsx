import type { LucideIcon } from "lucide-react";
import {
  Archive,
  BookOpenText,
  Bot,
  Boxes,
  Calculator,
  CalendarClock,
  FileCheck2,
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
    description: "Dépenses et fournisseurs centralisés",
    icon: Inbox,
  },
  {
    title: "Justificatifs",
    description: "Collecte et lecture automatique",
    icon: ReceiptText,
  },
  {
    title: "Facturation",
    description: "Devis, factures et règlements",
    icon: FileText,
  },
  {
    title: "Suivi des échéances",
    description: "Relances et paiements à venir",
    icon: CalendarClock,
  },
  {
    title: "Clients",
    description: "Historique et soldes accessibles",
    icon: Users,
  },
  {
    title: "Transactions",
    description: "Mouvements bancaires organisés",
    icon: Landmark,
  },
  {
    title: "Rapprochement",
    description: "Correspondances proposées par l’IA",
    icon: FileCheck2,
  },
  {
    title: "Écritures comptables",
    description: "Saisie structurée et contrôlable",
    icon: BookOpenText,
  },
  {
    title: "Déclarations TVA",
    description: "TVA calculée et prête à déclarer",
    icon: Calculator,
  },
  {
    title: "Paie",
    description: "Bulletins et déclarations sociales",
    icon: Boxes,
  },
  {
    title: "Mohasib Agent",
    description: "Assistant IA pour piloter vos opérations",
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
          <p className={styles.eyebrow}>Tout est connecté</p>
          <h2 id="capabilities-title">
            Tout ce qu’il vous faut pour piloter votre entreprise
          </h2>
          <p>
            De la collecte des pièces à la TVA, Mohasib réunit vos opérations
            financières et comptables dans un seul espace.
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
