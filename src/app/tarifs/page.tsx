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
            <h1>
              Calculez le tarif adapté à
              <span>votre activité.</span>
            </h1>
            <p className={styles.lede}>
              Choisissez votre profil, ajustez vos volumes et obtenez instantanément votre estimation mensuelle TTC.
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
