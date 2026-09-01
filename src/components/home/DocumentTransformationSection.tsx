import Image from "next/image";
import { Check } from "lucide-react";
import styles from "./DocumentTransformationSection.module.css";

export default function DocumentTransformationSection() {
  return (
    <section className={styles.section} aria-labelledby="document-transformation-title">
      <div className={styles.inner}>
        <div className={styles.visual}>
          <Image
            src="/images/invoice-transformation.png"
            alt="Une facture papier abîmée transformée en facture numérique claire et structurée"
            width={1254}
            height={1254}
            sizes="(max-width: 900px) 100vw, 58vw"
          />
          <span className={`${styles.visualLabel} ${styles.beforeLabel}`}>Facture reçue</span>
          <span className={`${styles.visualLabel} ${styles.afterLabel}`}>Prête à valider</span>
        </div>

        <div className={styles.copy}>
          <p className={styles.eyebrow}>Lecture automatique des documents</p>
          <h2 id="document-transformation-title">Déposez une facture. Contrôlez les données extraites.</h2>
          <p className={styles.intro}>
            Photo, scan ou PDF&nbsp;: Mohasib relève les montants, les dates, le fournisseur
            et la TVA, puis prépare le traitement comptable.
          </p>

          <div className={styles.impactPoints}>
            <div>
              <span><Check size={15} strokeWidth={2.4} /></span>
              <strong>Moins de saisie manuelle</strong>
              <p>Vous évitez de relire et ressaisir chaque facture ligne par ligne.</p>
            </div>
            <div>
              <span><Check size={15} strokeWidth={2.4} /></span>
              <strong>Un contrôle plus rapide</strong>
              <p>Les champs importants sont structurés et présentés ensemble avant validation.</p>
            </div>
            <div>
              <span><Check size={15} strokeWidth={2.4} /></span>
              <strong>Une trace facile à retrouver</strong>
              <p>Les données restent reliées à la pièce d’origine pour faciliter chaque vérification.</p>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
