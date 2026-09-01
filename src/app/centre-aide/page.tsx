import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";
import { FaLinkedinIn, FaRegEnvelope, FaWhatsapp } from "react-icons/fa6";
import PublicFooter from "@/components/PublicFooter";
import PublicNavbar from "@/components/PublicNavbar";
import { seoMetadata } from "@/lib/seo";
import { whatsappUrl } from "@/lib/public-urls";
import styles from "./CentreAidePage.module.css";

export const metadata: Metadata = seoMetadata({
  title: "Contact et assistance | Mohasib AI",
  description: "Contactez l’équipe Mohasib pour une question sur le produit, une demande de démonstration ou un besoin d’accompagnement.",
  path: "/centre-aide",
});

const cards = [
  {
    title: "Suivre les nouveautés sur LinkedIn",
    description: "Retrouvez les annonces produit et nos conseils pratiques pour les professionnels au Maroc.",
    cta: "Voir la page LinkedIn",
    href: "https://www.linkedin.com/company/mohasibai/",
    icon: FaLinkedinIn,
  },
  {
    title: "Nous écrire par e-mail",
    description: "Décrivez votre question, votre problème ou votre besoin. Notre équipe vous répond avec les prochaines étapes.",
    cta: "Écrire à l’équipe",
    href: "mailto:a.ahjame@gmail.com",
    icon: FaRegEnvelope,
  },
  {
    title: "Échanger avec nous sur WhatsApp",
    description: "Posez une question rapide ou convenez d’un moment pour découvrir Mohasib avec notre équipe.",
    cta: "Démarrer la discussion",
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
              Une question sur Mohasib&nbsp;?
              <span className={styles.titleAccent}>Parlons-en.</span>
            </h1>
            <p className={`marketing-lede ${styles.lede}`}>
              Produit, démonstration ou assistance&nbsp;: choisissez le canal le plus pratique pour joindre notre équipe.
            </p>
          </div>
        </section>

        <section className={styles.contactSection} aria-labelledby="contact-title">
          <div className="marketing-container">
            <div className={styles.sectionHeading}>
              <div>
                <p className="marketing-eyebrow">Nous contacter</p>
                <h2 id="contact-title">Choisissez comment nous contacter.</h2>
              </div>
              <p className={styles.sectionIntro}>
                Pour nous aider à répondre précisément, indiquez votre activité et le sujet de votre demande.
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
