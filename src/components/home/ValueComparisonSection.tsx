import styles from "./ValueComparisonSection.module.css";

const comparisons = [
  { topic: "Collecte des pièces", without: "Relancer chacun et rechercher les documents dans plusieurs canaux.", alternative: "E-mail, WhatsApp et Drive restent séparés.", mohasib: "Toutes les pièces arrivent dans une boîte de réception unique." },
  { topic: "Saisie comptable", without: "Lire puis ressaisir manuellement chaque facture.", alternative: "Un OCR extrait les données, puis vous les transférez ailleurs.", mohasib: "Les données et l’écriture proposée sont directement prêtes à contrôler." },
  { topic: "Rapprochement bancaire", without: "Comparer les transactions et justificatifs ligne par ligne.", alternative: "Relevé bancaire et tableau de suivi doivent être recoupés.", mohasib: "Les correspondances sont suggérées; vous traitez seulement les exceptions." },
  { topic: "Facturation et relances", without: "Créer, envoyer, surveiller et relancer séparément.", alternative: "Un outil facture, un autre suit les paiements.", mohasib: "Factures, échéances, relances et encaissements restent reliés." },
  { topic: "TVA et exports", without: "Rassembler les écritures et recalculer avant chaque échéance.", alternative: "Multiplier les exports, fichiers et contrôles manuels.", mohasib: "TVA calculée, anomalies signalées et dossier prêt à valider." },
  { topic: "Paie et administration", without: "Collecter les variables et suivre les validations par message.", alternative: "Documents et échanges restent dispersés entre plusieurs outils.", mohasib: "Variables, validations, bulletins et archives suivent un même parcours." },
  { topic: "Pilotage financier", without: "Construire les tableaux après avoir consolidé les données.", alternative: "Les indicateurs existent, mais sont isolés des opérations.", mohasib: "Les chiffres sont actualisés et les écarts importants remontent automatiquement." },
  { topic: "Votre rôle", without: "Exécuter, vérifier et corriger presque chaque étape.", alternative: "Coordonner les outils et maintenir leurs connexions.", mohasib: "Contrôler les exceptions, valider et consacrer plus de temps au conseil." },
] as const;

export default function ValueComparisonSection() {
  return (
    <section className={styles.section} aria-labelledby="value-comparison-title">
      <div className={styles.heading}>
        <p className={styles.eyebrow}>Pourquoi Mohasib</p>
        <h2 id="value-comparison-title">Ce qui change, concrètement.</h2>
        <p>Comparez le travail manuel, l’accumulation d’outils spécialisés et un workflow Mohasib réellement intégré.</p>
      </div>

      <div className={styles.tableShell} tabIndex={0} role="region" aria-label="Comparaison des méthodes de gestion comptable">
        <table>
          <thead>
            <tr>
              <th scope="col">Votre travail</th>
              <th scope="col">Sans Mohasib</th>
              <th scope="col">Outils séparés</th>
              <th scope="col" className={styles.mohasibHeading}><span>Avec Mohasib</span><small>Recommandé</small></th>
            </tr>
          </thead>
          <tbody>
            {comparisons.map((comparison) => (
              <tr key={comparison.topic}>
                <th scope="row">{comparison.topic}</th>
                <td>{comparison.without}</td>
                <td>{comparison.alternative}</td>
                <td className={styles.mohasibCell}>{comparison.mohasib}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Résultat pour vous</th>
              <td>Votre temps reste absorbé par l’exécution.</td>
              <td>Vous gagnez des fonctions, mais gérez davantage de complexité.</td>
              <td className={styles.mohasibCell}><strong>Moins d’exécution. Plus de contrôle et de conseil.</strong></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className={styles.mobileHint}>Faites glisser le tableau horizontalement pour comparer.</p>
    </section>
  );
}
