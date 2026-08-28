import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";
import { FaLinkedinIn, FaRegEnvelope, FaWhatsapp } from "react-icons/fa6";
import PublicFooter from "@/components/PublicFooter";
import PublicNavbar from "@/components/PublicNavbar";
import { seoMetadata } from "@/lib/seo";
import { whatsappUrl } from "@/lib/public-urls";
import styles from "./CentreAidePage.module.css";

export const metadata: Metadata = seoMetadata({
  title: "Centre d'aide | Mohasib AI",
  description: "Contactez Mohasib AI par email, LinkedIn ou WhatsApp pour une question, une démo ou un besoin d’accompagnement.",
  path: "/centre-aide",
});

const cards = [
  {
    title: "Suivez-nous sur LinkedIn",
    description: "Suivez les nouveautés, annonces produit et conseils pratiques autour de Mohasib AI.",
    cta: "Suivre Mohasib AI",
    href: "https://www.linkedin.com/company/mohasibai/",
    icon: FaLinkedinIn,
  },
  {
    title: "Écrivez-nous par email",
    description: "Pour une question, un bug, une demande de démo ou un besoin d'accompagnement.",
    cta: "Envoyer un email",
    href: "mailto:a.ahjame@gmail.com",
    icon: FaRegEnvelope,
  },
  {
    title: "Discutez sur WhatsApp",
    description: "Échangez rapidement avec l'équipe Mohasib pour une question, une démo ou un besoin d'aide.",
    cta: "Ouvrir WhatsApp",
    href: whatsappUrl(),
    icon: FaWhatsapp,
  },
];

export default function CentreAidePage() {
  return (
    <div className={`public-site ${styles.page}`}>
      <PublicNavbar />

      <main>
        <section className={styles.hero} aria-labelledby="help-title">
          <div className={`marketing-container ${styles.heroInner}`}>
            <p className="marketing-eyebrow">Centre d&apos;aide · Mohasib AI</p>
            <h1 id="help-title" className={`marketing-display ${styles.title}`}>
              Comment pouvons-nous
              <span className={styles.titleAccent}>vous aider ?</span>
            </h1>
            <p className={`marketing-lede ${styles.lede}`}>
              Une question, un besoin d&apos;accompagnement ou l&apos;envie de découvrir Mohasib ? Choisissez le canal qui vous convient.
            </p>
          </div>
        </section>

        <section className={styles.contactSection} aria-labelledby="contact-title">
          <div className="marketing-container">
            <div className={styles.sectionHeading}>
              <div>
                <p className="marketing-eyebrow">Nous contacter</p>
                <h2 id="contact-title">Parlons de ce dont vous avez besoin.</h2>
              </div>
              <p className={styles.sectionIntro}>
                Notre équipe vous répond pour le produit, une démonstration ou une question liée à votre utilisation de Mohasib.
              </p>
            </div>

            <div className={styles.cards}>
              {cards.map(({ title, description, cta, href, icon: Icon }) => {
                const isExternal = href.startsWith("http");

                return (
                  <a
                    key={title}
                    href={href}
                    className={styles.cardLink}
                    target={isExternal ? "_blank" : undefined}
                    rel={isExternal ? "noopener noreferrer" : undefined}
                  >
                    <article className={styles.card}>
                      <div className={styles.cardTop}>
                        <span className={styles.iconTile} aria-hidden="true"><Icon size={24} /></span>
                      </div>
                      <h3>{title}</h3>
                      <p>{description}</p>
                      <span className={styles.cardAction}>
                        {cta} <ArrowUpRight size={18} aria-hidden="true" />
                      </span>
                    </article>
                  </a>
                );
              })}
            </div>
          </div>
        </section>

      </main>

      <PublicFooter />
    </div>
  );
}
