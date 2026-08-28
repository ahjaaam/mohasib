"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronDown, Lock, Menu, Phone, X } from "lucide-react";
import { useState } from "react";
import AnnouncementBar from "@/components/home/AnnouncementBar";
import { appUrl, invoicingUrl } from "@/lib/public-urls";

const FONT = "var(--font-jakarta), sans-serif";
const NAVY = "#0D1526";
const ROADMAP_URL =
  "https://app.notion.com/p/582f8f92c3d142898de0f00e94d26caf?v=3acb4e543c0b81e893fa000c40c51c08";

type PublicNavbarProps = {
  logoWidth?: number;
};

export default function PublicNavbar({ logoWidth = 132 }: PublicNavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const logoHeight = Math.round((logoWidth / 154) * 31);

  return (
    <>
      <AnnouncementBar />
      <style>{`
        .public-navbar {
          position: sticky;
          top: 0;
          z-index: 50;
          box-sizing: border-box;
          border-bottom: 1px solid #E8E7E3;
        }
        .public-nav-inner {
          display: flex;
          width: 100%;
          max-width: 1440px;
          height: 100%;
          margin: 0 auto;
          align-items: center;
          padding: 0 24px;
        }
        .public-brand-link {
          display: inline-flex;
          flex: 0 0 auto;
          align-items: center;
          margin-right: 30px;
          text-decoration: none;
        }
        .public-nav-primary,
        .public-nav-actions {
          display: flex;
          align-items: center;
        }
        .public-nav-primary {
          gap: 24px;
        }
        .public-nav-actions {
          margin-left: auto;
        }
        .public-language-menu {
          position: relative;
          margin-right: 16px;
          padding-right: 16px;
          border-right: 1px solid #DED9CF;
          font-family: ${FONT};
        }
        .public-language-menu summary {
          display: inline-flex;
          min-height: 34px;
          align-items: center;
          gap: 7px;
          color: ${NAVY};
          cursor: pointer;
          font-size: 12px;
          font-weight: 700;
          list-style: none;
          user-select: none;
        }
        .public-language-menu summary::-webkit-details-marker {
          display: none;
        }
        .public-language-menu summary:focus-visible {
          outline: 2px solid #976224;
          outline-offset: 3px;
        }
        .public-language-menu summary svg {
          transition: transform 150ms ease;
        }
        .public-language-menu[open] summary svg {
          transform: rotate(180deg);
        }
        .public-language-dropdown {
          position: absolute;
          top: calc(100% + 10px);
          right: 15px;
          z-index: 70;
          display: grid;
          width: 190px;
          overflow: hidden;
          border: 1px solid #DED9CF;
          border-radius: var(--home-radius-card) !important;
          background: #fff;
          box-shadow: 0 16px 32px rgba(13, 21, 38, 0.12);
        }
        .public-language-option {
          display: grid;
          min-height: 48px;
          align-items: center;
          padding: 7px 12px;
          grid-template-columns: 24px minmax(0, 1fr) auto;
          gap: 9px;
          color: #3F4652;
          font-size: 12px;
        }
        .public-language-option + .public-language-option {
          border-top: 1px solid #EEEAE2;
        }
        .public-language-option[data-active="true"] {
          background: #F8F4EC;
          color: ${NAVY};
          font-weight: 700;
        }
        .public-language-option small {
          color: #9298A1;
          font-size: 9px;
          font-weight: 600;
          text-transform: uppercase;
        }
        .public-language-flag {
          font-size: 17px;
          line-height: 1;
        }
        .public-phone-link {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          margin-right: 16px;
          color: ${NAVY};
          font-family: ${FONT};
          font-size: 13px;
          font-weight: 600;
          text-decoration: none;
          white-space: nowrap;
          transition: color 0.15s ease;
        }
        .public-phone-link:hover,
        .public-phone-link:focus-visible {
          color: #C8924A;
        }
        .public-nav-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: #3F4652;
          font-family: ${FONT};
          font-size: 14px;
          font-weight: 500;
          text-decoration: none;
          transition: color 0.15s ease;
        }
        .public-nav-link:hover,
        .public-nav-link:focus-visible {
          color: ${NAVY};
        }
        .public-login-link {
          display: inline-flex;
          min-height: 44px;
          align-items: center;
          gap: 7px;
          color: ${NAVY};
          font-family: ${FONT};
          font-size: 14px;
          font-weight: 600;
          text-decoration: none;
          transition: color 0.15s ease;
        }
        .public-login-link:hover,
        .public-login-link:focus-visible {
          color: #976224;
        }
        .public-contact-sales {
          display: inline-flex;
          min-height: 42px;
          margin-left: 20px;
          align-items: center;
          border: 0;
          border-radius: var(--home-radius-control) !important;
          background: linear-gradient(135deg, #976224 0%, #0D1526 100%);
          padding: 0 18px;
          color: #FFFFFF;
          font-family: ${FONT};
          font-size: 14px;
          font-weight: 600;
          text-decoration: none;
          transition: transform 150ms ease;
        }
        .public-contact-sales:hover,
        .public-contact-sales:focus-visible {
          background: linear-gradient(135deg, #7D4F1C 0%, #19274A 100%);
          color: #FFFFFF;
          transform: translateY(-1px);
        }
        .public-login-link:focus-visible,
        .public-contact-sales:focus-visible {
          outline: 2px solid #976224;
          outline-offset: 3px;
        }
        .public-mobile-toggle,
        .public-mobile-panel {
          display: none;
        }
        @media (max-width: 1050px) {
          .public-nav-inner {
            padding: 0 24px;
          }
          .public-brand-link {
            margin-right: 0;
          }
          .public-nav-primary,
          .public-nav-actions {
            display: none;
          }
          .public-mobile-toggle {
            display: inline-flex;
            width: 42px;
            height: 42px;
            margin-left: auto;
            align-items: center;
            justify-content: center;
            gap: 7px;
            border: 0;
            background: transparent;
            color: ${NAVY};
            cursor: pointer;
          }
          .public-mobile-panel {
            position: absolute;
            top: 64px;
            right: 0;
            left: 0;
            display: block;
            padding: 8px 24px 22px;
            border-top: 1px solid #E8E7E3;
            background: #FDFBF6;
            box-shadow: 0 18px 35px rgba(13, 21, 38, 0.10);
          }
          .public-mobile-main-link {
            display: flex;
            min-height: 48px;
            align-items: center;
            justify-content: space-between;
            border-bottom: 1px solid rgba(0, 0, 0, 0.06);
            color: ${NAVY};
            font-family: ${FONT};
            font-size: 14px;
            font-weight: 700;
            text-decoration: none;
          }
          .public-mobile-login {
            display: flex;
            min-height: 46px;
            margin-top: 16px;
            align-items: center;
            justify-content: center;
            border-radius: var(--home-radius-control) !important;
            background: ${NAVY};
            color: #FFFFFF;
            font-family: ${FONT};
            font-size: 13px;
            font-weight: 700;
            text-decoration: none;
          }
          .public-mobile-phone {
            display: flex;
            min-height: 46px;
            margin-top: 12px;
            align-items: center;
            justify-content: center;
            gap: 8px;
            color: ${NAVY};
            font-family: ${FONT};
            font-size: 13px;
            font-weight: 700;
            text-decoration: none;
          }
          .public-mobile-contact-sales {
            display: flex;
            min-height: 46px;
            margin-top: 10px;
            align-items: center;
            justify-content: center;
            border: 1px solid ${NAVY};
            border-radius: var(--home-radius-control) !important;
            background: #FFFFFF;
            color: ${NAVY};
            font-family: ${FONT};
            font-size: 13px;
            font-weight: 700;
            text-decoration: none;
          }
          .public-mobile-language-menu {
            border-bottom: 1px solid rgba(0, 0, 0, 0.06);
            font-family: ${FONT};
          }
          .public-mobile-language-menu summary {
            display: flex;
            min-height: 48px;
            align-items: center;
            gap: 9px;
            color: ${NAVY};
            cursor: pointer;
            font-size: 13px;
            font-weight: 700;
            list-style: none;
          }
          .public-mobile-language-menu summary::-webkit-details-marker {
            display: none;
          }
          .public-mobile-language-menu summary svg {
            margin-left: auto;
            transition: transform 150ms ease;
          }
          .public-mobile-language-menu[open] summary svg {
            transform: rotate(180deg);
          }
          .public-mobile-language-options {
            display: grid;
            padding: 0 0 10px 26px;
            gap: 8px;
          }
          .public-mobile-language-options span {
            display: flex;
            align-items: center;
            gap: 9px;
            color: #6D7480;
            font-size: 12px;
          }
          .public-mobile-language-options small {
            margin-left: auto;
            color: #9298A1;
            font-size: 9px;
            text-transform: uppercase;
          }
        }
        @media (max-width: 480px) {
          .public-nav-inner {
            padding: 0 18px;
          }
          .public-brand-mark {
            width: 34px;
            height: 34px;
          }
          .public-mobile-panel {
            padding-right: 18px;
            padding-left: 18px;
          }
        }
      `}</style>

      <nav
        className="public-navbar"
        style={{
          height: 64,
          backgroundColor: "#FDFBF6",
        }}
      >
        <div className="public-nav-inner">
          <Link href="/" className="public-brand-link" aria-label="Mohasib — Accueil">
            <Image src="/logo2.png" alt="Mohasib AI" width={logoWidth} height={logoHeight} style={{ height: "auto", objectFit: "contain" }} priority />
          </Link>

          <div className="public-nav-primary">
            <Link href="/#six-automatisations" className="public-nav-link">
              Solutions
            </Link>

            <Link href="/ressources/documents" className="public-nav-link">
              Documents
            </Link>

            <Link href={invoicingUrl("/")} className="public-nav-link">
              Facturation
            </Link>

            <a href={ROADMAP_URL} className="public-nav-link" target="_blank" rel="noreferrer">
              Roadmap
            </a>

            <Link href="/centre-aide" className="public-nav-link">
              Centre d&apos;aide
            </Link>
          </div>

          <div className="public-nav-actions">
            <details className="public-language-menu">
              <summary aria-label="Choisir la langue">
                <span className="public-language-flag" aria-hidden="true">🇫🇷</span>
                FR
                <ChevronDown size={13} aria-hidden="true" />
              </summary>
              <div className="public-language-dropdown" aria-label="Langues du site">
                <span className="public-language-option" data-active="true" lang="fr">
                  <span className="public-language-flag" aria-hidden="true">🇫🇷</span>
                  Français
                </span>
                <span className="public-language-option" lang="en">
                  <span className="public-language-flag" aria-hidden="true">🇬🇧</span>
                  English
                  <small>Bientôt</small>
                </span>
                <span className="public-language-option" lang="ar">
                  <span className="public-language-flag" aria-hidden="true">🇲🇦</span>
                  العربية
                  <small>Bientôt</small>
                </span>
              </div>
            </details>

            <a href="tel:+212670101952" className="public-phone-link" aria-label="Appeler le 06 70 10 19 52">
              <Phone size={16} aria-hidden="true" />
              <span>06 70 10 19 52</span>
            </a>

            <Link href={appUrl("/connexion")} className="public-login-link">
              <Lock size={15} aria-hidden="true" />
              Se connecter
            </Link>

            <Link href="/centre-aide" className="public-contact-sales">
              Nous contacter
            </Link>
          </div>

          <button
            type="button"
            className="public-mobile-toggle"
            aria-label={mobileOpen ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {mobileOpen && (
          <div className="public-mobile-panel">
            <Link href="/#six-automatisations" className="public-mobile-main-link" onClick={() => setMobileOpen(false)}>
              Solutions
            </Link>

            <Link href="/ressources/documents" className="public-mobile-main-link" onClick={() => setMobileOpen(false)}>
              Documents
            </Link>

            <Link href={invoicingUrl("/")} className="public-mobile-main-link" onClick={() => setMobileOpen(false)}>
              Facturation
            </Link>

            <a
              href={ROADMAP_URL}
              className="public-mobile-main-link"
              target="_blank"
              rel="noreferrer"
              onClick={() => setMobileOpen(false)}
            >
              Roadmap
            </a>

            <Link href="/centre-aide" className="public-mobile-main-link" onClick={() => setMobileOpen(false)}>
              Centre d&apos;aide
            </Link>

            <details className="public-mobile-language-menu">
              <summary aria-label="Choisir la langue">
                <span className="public-language-flag" aria-hidden="true">🇫🇷</span>
                Français
                <ChevronDown size={14} aria-hidden="true" />
              </summary>
              <div className="public-mobile-language-options" aria-label="Langues du site">
                <span lang="fr"><span className="public-language-flag" aria-hidden="true">🇫🇷</span>Français</span>
                <span lang="en"><span className="public-language-flag" aria-hidden="true">🇬🇧</span>English <small>Bientôt</small></span>
                <span lang="ar"><span className="public-language-flag" aria-hidden="true">🇲🇦</span>العربية <small>Bientôt</small></span>
              </div>
            </details>

            <a href="tel:+212670101952" className="public-mobile-phone" aria-label="Appeler le 06 70 10 19 52">
              <Phone size={16} aria-hidden="true" />
              <span>06 70 10 19 52</span>
            </a>

            <Link href={appUrl("/connexion")} className="public-mobile-login" onClick={() => setMobileOpen(false)}>
              <Lock size={15} aria-hidden="true" />
              Se connecter
            </Link>

            <Link href="/centre-aide" className="public-mobile-contact-sales" onClick={() => setMobileOpen(false)}>
              Nous contacter
            </Link>
          </div>
        )}
      </nav>
    </>
  );
}
