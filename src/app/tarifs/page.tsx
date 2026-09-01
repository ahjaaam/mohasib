import PublicFooter from "@/components/PublicFooter";
import PublicNavbar from "@/components/PublicNavbar";
import PricingSimulator from "./PricingSimulator";
import styles from "./tarifs.module.css";

export default function TarifsPage() {
  return (
    <div className={`public-site ${styles.page}`}>
      <PublicNavbar />

      <main>
        <section className={styles.hero}>
          <div className={styles.heroInner}>
            <p className="marketing-eyebrow">Tarification Mohasib AI</p>
            <h1>Calculez le prix adapté à votre activité.</h1>
            <p className={styles.lede}>
              Sélectionnez votre formule et vos volumes. Votre estimation mensuelle se met à jour instantanément.
            </p>
          </div>
        </section>

        <section className={styles.calculatorSection} aria-label="Simulateur de prix Mohasib AI">
          <div className={styles.shell}>
            <PricingSimulator />
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
