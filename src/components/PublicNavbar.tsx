"use client";

import Image from "next/image";
import Link from "next/link";
import { Lock, Menu, Phone, X } from "lucide-react";
import { useState } from "react";
import { appUrl, invoicingUrl } from "@/lib/public-urls";

const FONT = "var(--font-jakarta), sans-serif";
const NAVY = "#0D1526";
const ROADMAP_URL =
  "https://app.notion.com/p/582f8f92c3d142898de0f00e94d26caf?v=3acb4e543c0b81e893fa000c40c51c08";

export default function PublicNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
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
          padding: 0 48px;
        }
        .public-brand-link {
          display: inline-flex;
          flex: 0 0 auto;
          align-items: center;
          margin-right: 56px;
          text-decoration: none;
        }
        .public-nav-primary,
        .public-nav-actions {
          display: flex;
          align-items: center;
        }
        .public-nav-primary {
          gap: 34px;
        }
        .public-nav-actions {
          margin-left: auto;
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
          min-height: 42px;
          align-items: center;
          justify-content: center;
          gap: 7px;
          padding: 0 20px;
          border: 1px solid #C8924A;
          border-radius: 9px !important;
          background: #C8924A;
          color: #FFFFFF;
          font-family: ${FONT};
          font-size: 14px;
          font-weight: 600;
          text-decoration: none;
          transition: background-color 0.15s ease, border-color 0.15s ease;
        }
        .public-login-link:hover,
        .public-login-link:focus-visible {
          border-color: #AD7635;
          background: #AD7635;
          color: #FFFFFF;
        }
        .public-contact-sales {
          display: inline-flex;
          min-height: 42px;
          margin-left: 12px;
          align-items: center;
          justify-content: center;
          padding: 0 20px;
          border-radius: 9px !important;
          background: ${NAVY};
          color: #FFFFFF;
          font-family: ${FONT};
          font-size: 14px;
          font-weight: 600;
          text-decoration: none;
          transition: background-color 0.15s ease;
        }
        .public-contact-sales:hover,
        .public-contact-sales:focus-visible {
          background: #253047;
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
            top: 76px;
            right: 0;
            left: 0;
            display: block;
            padding: 8px 24px 22px;
            border-top: 1px solid #E8E7E3;
            background: #FFFFFF;
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
            border-radius: 9px !important;
            background: #C8924A;
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
            border-radius: 9px !important;
            color: ${NAVY};
            font-family: ${FONT};
            font-size: 13px;
            font-weight: 700;
            text-decoration: none;
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
          height: 76,
          backgroundColor: "#FFFFFF",
        }}
      >
        <div className="public-nav-inner">
          <Link href="/" className="public-brand-link" aria-label="Mohasib — Accueil">
            <Image src="/logo2.png" alt="Mohasib AI" width={154} height={31} style={{ height: "auto", objectFit: "contain" }} priority />
          </Link>

          <div className="public-nav-primary">
            <Link href="/workflows" className="public-nav-link">
              Workflows
            </Link>

            <Link href="/ressources" className="public-nav-link">
              Bibliothèque
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
            <Link href="/workflows" className="public-mobile-main-link" onClick={() => setMobileOpen(false)}>
              Workflows
            </Link>

            <Link href="/ressources" className="public-mobile-main-link" onClick={() => setMobileOpen(false)}>
              Bibliothèque
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
