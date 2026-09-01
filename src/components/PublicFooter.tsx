import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  Facebook,
  Instagram,
  Linkedin,
  Phone,
} from "lucide-react";
import { FaWhatsapp } from "react-icons/fa6";

import { appUrl, invoicingUrl, whatsappUrl } from "@/lib/public-urls";
import styles from "./PublicFooter.module.css";

const ROADMAP_URL =
  "https://app.notion.com/p/582f8f92c3d142898de0f00e94d26caf?v=3acb4e543c0b81e893fa000c40c51c08";

const footerGroups = [
  {
    title: "Produit",
    links: [
      { label: "Fonctionnalités", href: "/#six-automatisations" },
      { label: "Facturation gratuite", href: invoicingUrl() },
    ],
  },
  {
    title: "Ressources",
    links: [
      { label: "Documents", href: "/ressources/documents" },
      { label: "Centre d’aide", href: "/centre-aide" },
    ],
  },
  {
    title: "Mohasib",
    links: [
      { label: "Se connecter", href: appUrl("/connexion") },
      { label: "Créer un compte", href: appUrl("/inscription") },
      { label: "Nous contacter", href: "/centre-aide" },
      { label: "Roadmap", href: ROADMAP_URL, external: true },
    ],
  },
] as const;

const socialLinks = [
  { label: "LinkedIn", href: "https://www.linkedin.com/company/mohasibai/", icon: Linkedin },
  { label: "Instagram", href: "https://www.instagram.com/mohasibai/", icon: Instagram },
  { label: "Facebook", href: "https://www.facebook.com/mohasibai", icon: Facebook },
] as const;

export default function PublicFooter() {
  return (
    <footer className={styles.footer}>
      <Image
        src="/favicon.png"
        alt=""
        width={440}
        height={440}
        className={styles.watermark}
        aria-hidden="true"
      />
      <div className={styles.inner}>
        <div className={styles.main}>
          <div className={styles.brand}>
            <Link href="/" className={styles.logoLink} aria-label="Mohasib — Accueil">
              <Image src="/logo.png" alt="Mohasib AI" width={154} height={26} className={styles.logo} />
            </Link>
            <p className={styles.tagline}>
              La plateforme qui relie factures, paiements et comptabilité pour
              les entreprises et cabinets au Maroc.
            </p>
            <div className={styles.contactLinks}>
              <a href="tel:+212670101952" className={styles.contactLink}>
                <Phone size={15} aria-hidden="true" />
                <span>06 70 10 19 52</span>
              </a>
              <a href={whatsappUrl()} target="_blank" rel="noopener noreferrer" className={styles.contactLink}>
                <FaWhatsapp size={15} aria-hidden="true" />
                <span>WhatsApp</span>
              </a>
            </div>
          </div>

          <nav className={styles.navigation} aria-label="Navigation du pied de page">
            {footerGroups.map((group) => (
              <div className={styles.group} key={group.title}>
                <h2>{group.title}</h2>
                <ul>
                  {group.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        target={"external" in link ? "_blank" : undefined}
                        rel={"external" in link ? "noreferrer" : undefined}
                      >
                        <span>{link.label}</span>
                        {"external" in link && <ArrowUpRight size={12} aria-hidden="true" />}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className={styles.bottom}>
          <div className={styles.legal}>
            <span>© 2026 Mohasib AI</span>
            <Link href="/cgu">Conditions d’utilisation</Link>
            <Link href="/confidentialite">Confidentialité</Link>
          </div>

          <div className={styles.socials} aria-label="Réseaux sociaux">
            {socialLinks.map(({ label, href, icon: Icon }) => (
              <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label}>
                <Icon size={15} aria-hidden="true" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
