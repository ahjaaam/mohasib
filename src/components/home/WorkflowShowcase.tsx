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
        <div><span>Trésorerie</span><strong>318 400 <small>MAD</small></strong></div>
        <div><span>Encaissé</span><strong>146 200 <small>MAD</small></strong></div>
        <div><span>Charges</span><strong>98 750 <small>MAD</small></strong></div>
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
  { label: "Achats et notes de frais", title: "Passez de la facture reçue à l’écriture préparée", description: "Mohasib collecte vos pièces, extrait les données utiles et prépare la saisie. Vous contrôlez avant validation.", icon: Mail, visual: SupplierVisual },
  { label: "Rapprochement bancaire", title: "Retrouvez la note de frais de chaque transaction", description: "Mohasib rapproche relevés, paiements et pièces, puis vous présente uniquement les correspondances à confirmer.", icon: Landmark, visual: BankVisual },
  { label: "Facturation et recouvrement", title: "Suivez chaque facture jusqu’au paiement", description: "Créez vos factures, suivez leurs échéances et préparez vos relances dans le même espace.", icon: FileText, visual: BillingVisual },
  { label: "Pilotage financier", title: "Repérez rapidement ce qui mérite votre attention", description: "Suivez vos indicateurs à jour et identifiez les écarts à analyser sans reconstruire vos tableaux à la main.", icon: BarChart3, visual: FinanceVisual },
  { label: "TVA et exports comptables", title: "Préparez une TVA plus simple à contrôler", description: "Mohasib vérifie les écritures, réunit les pièces et prépare les exports avant votre validation.", icon: ShieldCheck, visual: VatVisual },
  { label: "Paie et administration", title: "Centralisez les variables et les validations de paie", description: "Rassemblez les éléments de paie, suivez les validations et conservez l’historique de chaque période.", icon: UsersRound, visual: PayrollVisual },
] as const;

export default function WorkflowShowcase() {
  return (
    <section id="six-automatisations" className={styles.section} aria-labelledby="home-workflows-title">
      <div className={styles.heading}>
        <p className={styles.eyebrow}>Six flux réunis dans une plateforme</p>
        <h2 id="home-workflows-title">Automatisez les tâches répétitives. Concentrez-vous sur les décisions.</h2>
        <p>Mohasib relie vos documents, vos paiements et votre comptabilité pour que votre équipe sache quoi contrôler et quoi faire ensuite.</p>
      </div>

      <div className={styles.grid}>
        {workflows.map(({ label, title, description, icon: Icon, visual: Visual }) => (
          <article className={styles.card} key={label}>
            <div className={styles.copy}>
              <div className={styles.category}><Icon size={16} strokeWidth={1.7} /><span>{label}</span></div>
              <h3>{title}</h3>
              <p>{description}</p>
            </div>
            <div className={styles.visual} aria-hidden="true"><Visual /></div>
          </article>
        ))}
      </div>
    </section>
  );
}
