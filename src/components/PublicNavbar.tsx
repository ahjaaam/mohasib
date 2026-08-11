"use client";

import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";
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
          position: relative;
          z-index: 50;
        }
        .public-nav-inner {
          display: flex;
          width: 100%;
          height: 100%;
          align-items: center;
          justify-content: space-between;
          padding: 0 34px;
        }
        .public-brand-link {
          display: inline-flex;
          align-items: center;
          text-decoration: none;
        }
        .public-nav-right {
          display: flex;
          align-items: center;
          gap: 26px;
        }
        .public-nav-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: #77787a;
          font-family: ${FONT};
          font-size: 14px;
          font-weight: 200;
          text-decoration: none;
          transition: color 0.15s ease;
        }
        .public-nav-link:hover,
        .public-nav-link:focus-visible {
          color: ${NAVY};
        }
        .public-login-link {
          display: inline-flex;
          min-height: 36px;
          align-items: center;
          padding-left: 26px;
          border-left: 1px solid #E1E0DC;
          color: ${NAVY};
          font-family: ${FONT};
          font-size: 14px;
          font-weight: 600;
          text-decoration: none;
          transition: color 0.15s ease;
        }
        .public-login-link:hover,
        .public-login-link:focus-visible {
          color: #7A6668;
        }
        .public-mobile-toggle,
        .public-mobile-panel {
          display: none;
        }
        @media (max-width: 1050px) {
          .public-nav-inner {
            padding: 0 24px;
          }
          .public-nav-right {
            display: none;
          }
          .public-mobile-toggle {
            display: inline-flex;
            width: 42px;
            height: 42px;
            align-items: center;
            justify-content: center;
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
            background: ${NAVY};
            color: #FFFFFF;
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

          <div className="public-nav-right">
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

            <Link href={appUrl("/connexion")} className="public-login-link">
              Se connecter
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

            <Link href={appUrl("/connexion")} className="public-mobile-login" onClick={() => setMobileOpen(false)}>
              Se connecter
            </Link>
          </div>
        )}
      </nav>
    </>
  );
}
