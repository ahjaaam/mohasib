import Image from "next/image";
import Link from "next/link";
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
          <p className={styles.eyebrow}>Lecture intelligente des documents</p>
          <h2 id="document-transformation-title">Une facture reçue. Des données prêtes à valider.</h2>
          <p className={styles.intro}>
            Photo, scan ou PDF&nbsp;: Mohasib lit la pièce, extrait les informations
            utiles et prépare le traitement comptable.
          </p>

          <div className={styles.impactPoints}>
            <div>
              <span><Check size={15} strokeWidth={2.4} /></span>
              <strong>Des heures récupérées</strong>
              <p>Fini de déchiffrer et ressaisir chaque facture ligne par ligne.</p>
            </div>
            <div>
              <span><Check size={15} strokeWidth={2.4} /></span>
              <strong>Moins d’erreurs et d’allers-retours</strong>
              <p>Les montants, dates et taux de TVA sont structurés avant votre contrôle.</p>
            </div>
            <div>
              <span><Check size={15} strokeWidth={2.4} /></span>
              <strong>Plus de temps pour le conseil</strong>
              <p>Votre énergie revient aux décisions utiles, pas à la saisie répétitive.</p>
            </div>
          </div>

          <Link className={styles.contactButton} href="/centre-aide">
            Nous contacter
          </Link>
        </div>
      </div>
    </section>
  );
}
