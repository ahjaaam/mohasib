import {
  Archive,
  BarChart3,
  Check,
  FileText,
  Landmark,
  Mail,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import styles from "./WorkflowShowcase.module.css";

const Status = ({ tone, children }: { tone: "success" | "warning" | "neutral"; children: React.ReactNode }) => (
  <span className={`${styles.status} ${styles[tone]}`}>{children}</span>
);

function SupplierVisual() {
  return (
    <div className={styles.visualStack}>
      <div className={`${styles.panel} ${styles.offsetRight}`}>
        <div className={styles.panelHeading}><span>Boîte de réception</span><span>09:14</span></div>
        <strong>Sotrafil SARL — Facture FA-2026-0412</strong>
        <span className={styles.attachment}><FileText size={12} /> facture-0412.pdf</span>
      </div>
      <div className={`${styles.darkPanel} ${styles.offsetLeft}`}>
        <span className={styles.goldLabel}>Extraction</span>
        <div className={styles.dataRow}><span>Total TTC</span><strong>14 400,00 MAD</strong></div>
        <div className={styles.dataRow}><span>Écriture</span><strong>6111 / 4411</strong></div>
      </div>
      <div className={styles.validation}><strong>Prêt à valider</strong><Check size={14} /></div>
    </div>
  );
}

function BankVisual() {
  return (
    <div className={styles.visualStack}>
      <div className={styles.panel}>
        <div className={styles.panelHeading}><span>Relevé — Attijariwafa</span><span>Août</span></div>
        <div className={styles.transaction}><span>Virement Sotrafil</span><strong>-14 400,00</strong><Status tone="success">Rapproché</Status></div>
        <div className={`${styles.transaction} ${styles.highlight}`}><span>Paiement TPE 04/08</span><strong>-2 180,00</strong><Status tone="warning">Suggéré</Status></div>
        <div className={styles.transaction}><span>Prélèvement CNSS</span><strong>-8 940,00</strong><Status tone="neutral">À vérifier</Status></div>
      </div>
      <div className={`${styles.darkPanel} ${styles.matchLine}`}>
        <Landmark size={14} /><span>Paiement TPE ↔ Reçu R-2026-118</span><small>96 %</small>
      </div>
    </div>
  );
}

function BillingVisual() {
  return (
    <div className={styles.billingGrid}>
      <div className={styles.invoicePanel}>
        <span className={styles.miniLabel}>Facture</span><strong>FC-2026-0087</strong>
        <div className={styles.invoiceRow}><span>Prestation</span><span>9 500,00</span></div>
        <div className={styles.invoiceRow}><span>Maintenance</span><span>2 400,00</span></div>
        <div className={`${styles.invoiceRow} ${styles.invoiceTotal}`}><strong>Total TTC</strong><strong>14 280,00</strong></div>
      </div>
      <div className={styles.billingSide}>
        <div className={styles.stateRow}><span>Payée</span><i className={styles.greenDot} /></div>
        <div className={styles.stateRow}><span>En attente</span><i className={styles.goldDot} /></div>
        <div className={`${styles.stateRow} ${styles.overdue}`}><span>Échue · 12 j</span><i className={styles.redDot} /></div>
        <div className={styles.darkPanel}><span className={styles.goldLabel}>Relance prête</span><small>Facture FC-2026-0081 échue</small></div>
      </div>
    </div>
  );
}

function FinanceVisual() {
  const bars = [[34, 22], [42, 26], [30, 31], [52, 28], [46, 33], [58, 30]];
  return (
    <div className={styles.visualStack}>
      <div className={styles.metrics}>
        <div><span>Trésorerie</span><strong>318 400</strong></div>
        <div><span>Encaissé</span><strong>146 200</strong></div>
        <div><span>Charges</span><strong>98 750</strong></div>
      </div>
      <div className={`${styles.panel} ${styles.chartPanel}`}>
        <div className={styles.panelHeading}><span>Produits / charges</span><span>6 mois</span></div>
        <div className={styles.chart}>
          {bars.map(([income, expense], index) => (
            <span className={styles.barPair} key={index}>
              <i style={{ height: income, background: index === bars.length - 1 ? "#0D1526" : "#C8924A" }} />
              <i style={{ height: expense }} />
            </span>
          ))}
        </div>
      </div>
      <div className={styles.validation}>Charges fournisseurs +18 % vs juillet</div>
    </div>
  );
}

function VatVisual() {
  return (
    <div className={styles.visualStack}>
      <div className={`${styles.darkPanel} ${styles.offsetRight}`}>
        <span className={styles.goldLabel}>Déclaration TVA — Juillet 2026</span>
        <div className={styles.dataRow}><span>TVA collectée</span><strong>42 860,00</strong></div>
        <div className={styles.dataRow}><span>TVA déductible</span><strong>17 340,00</strong></div>
        <div className={styles.dataRow}><strong>À payer</strong><strong>25 520,00 MAD</strong></div>
      </div>
      <div className={`${styles.panel} ${styles.offsetLeft}`}>
        <div className={styles.checkRow}><Check size={12} /><span>Écritures équilibrées · 248 lignes</span></div>
        <div className={styles.checkRow}><Check size={12} /><span>Pièces justificatives · 100 %</span></div>
        <div className={`${styles.checkRow} ${styles.highlight}`}><span>2 taux à confirmer</span></div>
      </div>
      <div className={styles.exportRow}><span>Export comptable · CSV / Sage</span><Status tone="success">Prêt</Status></div>
    </div>
  );
}

function PayrollVisual() {
  return (
    <div className={styles.visualStack}>
      <div className={styles.panel}>
        <div className={styles.panelHeading}><span>Paie — Août 2026</span><span>14 salariés</span></div>
        <div className={styles.transaction}><span>K. Benali · Net 9 240,00</span><Status tone="success">Prêt</Status></div>
        <div className={styles.transaction}><span>S. Alaoui · Net 7 810,00</span><Status tone="warning">Prime ?</Status></div>
      </div>
      <div className={`${styles.validation} ${styles.offsetLeft}`}>Variable manquante : prime de rendement</div>
      <div className={`${styles.darkPanel} ${styles.matchLine}`}><span>Validation — Direction</span><small>1 étape restante</small></div>
      <div className={styles.exportRow}><Archive size={13} /><span>Bulletins juillet archivés · 14 PDF</span></div>
    </div>
  );
}

const workflows = [
  { label: "Documents fournisseurs", title: "De l’e-mail à l’écriture comptable", description: "Mohasib récupère vos factures et justificatifs, extrait les informations utiles, prépare la saisie et classe chaque document.", icon: Mail, visual: SupplierVisual },
  { label: "Rapprochement bancaire", title: "Chaque transaction trouve son justificatif", description: "Les relevés, paiements et pièces sont réunis automatiquement. Vous intervenez uniquement sur les correspondances incertaines.", icon: Landmark, visual: BankVisual },
  { label: "Facturation & recouvrement", title: "Facturez. Suivez. Encaissez.", description: "Créez et envoyez vos factures, suivez les échéances et préparez les relances depuis un même espace.", icon: FileText, visual: BillingVisual },
  { label: "Pilotage financier", title: "Vos chiffres deviennent lisibles", description: "Mohasib rassemble vos données, calcule vos indicateurs et met en évidence les écarts qui méritent votre attention.", icon: BarChart3, visual: FinanceVisual },
  { label: "TVA & export comptable", title: "Une TVA prête à valider", description: "Les écritures sont contrôlées, les pièces réunies et les exports préparés pour une transmission comptable propre.", icon: ShieldCheck, visual: VatVisual },
  { label: "Paie & administration", title: "La paie, sans les allers-retours", description: "Préparez les éléments de paie, organisez les validations et conservez un historique clair de chaque dossier.", icon: UsersRound, visual: PayrollVisual },
] as const;

export default function WorkflowShowcase() {
  return (
    <section className={styles.section} aria-labelledby="home-workflows-title">
      <div className={styles.heading}>
        <p className={styles.eyebrow}>Six workflows, une seule plateforme</p>
        <h2 id="home-workflows-title">Du document reçu à la décision financière.</h2>
        <p>Mohasib relie les tâches qui occupent aujourd’hui votre équipe et transforme chaque étape en un processus structuré, traçable et prêt à valider.</p>
      </div>

      <div className={styles.grid}>
        {workflows.map(({ label, title, description, icon: Icon, visual: Visual }) => (
          <article className={styles.card} key={label}>
            <div className={styles.visual} aria-hidden="true"><Visual /></div>
            <div className={styles.copy}>
              <div className={styles.category}><Icon size={16} strokeWidth={1.7} /><span>{label}</span></div>
              <h3>{title}</h3>
              <p>{description}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
