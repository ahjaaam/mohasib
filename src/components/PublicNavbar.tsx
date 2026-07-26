"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronDown, Menu, X } from "lucide-react";
import { useState } from "react";
import { appUrl } from "@/lib/public-urls";

const FONT = "var(--font-jakarta), sans-serif";
const NAVY = "#0D1526";

const PRODUCT_NAV = [
  {
    href: "/logiciels/business",
    title: "Business Pro",
    subtitle: "La gestion financière des entrepreneurs et PME",
  },
  {
    href: "/logiciels/comptable-pro",
    title: "Comptable Pro",
    subtitle: "Un espace de pilotage conçu pour les cabinets",
  },
];

const RESOURCE_NAV = [
  {
    href: "/ressources/blog",
    title: "Blog",
    subtitle: "Comptabilité, fiscalité et entrepreneuriat",
  },
  {
    href: "/ressources/documents",
    title: "Documents",
    subtitle: "Modèles et documents prêts à télécharger",
  },
];

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
        .public-nav-right,
        .public-nav-links {
          display: flex;
          align-items: center;
        }
        .public-nav-right {
          gap: 26px;
        }
        .public-nav-links {
          gap: 34px;
        }
        .public-nav-link {
          display: inline-flex;
          min-height: 76px;
          align-items: center;
          gap: 6px;
          color: #5E6065;
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
        .public-nav-menu {
          position: relative;
          display: flex;
          height: 76px;
          align-items: center;
        }
        .public-nav-panel {
          position: absolute;
          top: 66px;
          left: 0;
          width: 330px;
          padding: 8px;
          border: 1px solid #E4E3DF;
          background: #FFFFFF;
          box-shadow: 0 18px 45px rgba(13, 21, 38, 0.12);
          opacity: 0;
          visibility: hidden;
          transform: translateY(6px);
          transition: opacity 0.15s ease, visibility 0.15s ease, transform 0.15s ease;
        }
        .public-nav-panel--resources {
          right: 0;
          left: auto;
        }
        .public-nav-menu:hover .public-nav-panel,
        .public-nav-menu:focus-within .public-nav-panel {
          opacity: 1;
          visibility: visible;
          transform: translateY(0);
        }
        .public-nav-panel-link {
          display: block;
          padding: 12px;
          color: ${NAVY};
          text-decoration: none;
          transition: background-color 0.15s ease;
        }
        .public-nav-panel-link:hover,
        .public-nav-panel-link:focus-visible {
          background: #F5F5F2;
        }
        .public-nav-panel-title {
          display: block;
          font-family: ${FONT};
          font-size: 13px;
          font-weight: 700;
        }
        .public-nav-panel-subtitle {
          display: block;
          margin-top: 4px;
          color: #777B83;
          font-family: ${FONT};
          font-size: 11px;
          line-height: 1.45;
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
          .public-mobile-sub-link {
            display: block;
            padding: 10px 12px;
            color: #5E6065;
            font-family: ${FONT};
            font-size: 13px;
            font-weight: 600;
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
            <div className="public-nav-links">
              <div className="public-nav-menu">
                <Link href="/logiciels" className="public-nav-link">
                  Logiciels <ChevronDown size={14} strokeWidth={1.7} />
                </Link>
                <div className="public-nav-panel">
                  {PRODUCT_NAV.map(({ href, title, subtitle }) => (
                    <Link href={href} className="public-nav-panel-link" key={href}>
                      <span className="public-nav-panel-title">{title}</span>
                      <span className="public-nav-panel-subtitle">{subtitle}</span>
                    </Link>
                  ))}
                </div>
              </div>

              <Link href="/tarifs" className="public-nav-link">
                Tarification
              </Link>

              <Link href="/centre-aide" className="public-nav-link">
                Centre d&apos;aide
              </Link>

              <div className="public-nav-menu">
                <Link href="/ressources" className="public-nav-link">
                  Ressources <ChevronDown size={14} strokeWidth={1.7} />
                </Link>
                <div className="public-nav-panel public-nav-panel--resources">
                  {RESOURCE_NAV.map(({ href, title, subtitle }) => (
                    <Link href={href} className="public-nav-panel-link" key={href}>
                      <span className="public-nav-panel-title">{title}</span>
                      <span className="public-nav-panel-subtitle">{subtitle}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>

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
            <Link href="/logiciels" className="public-mobile-main-link" onClick={() => setMobileOpen(false)}>
              Logiciels <ChevronDown size={15} />
            </Link>
            <div>
              {PRODUCT_NAV.map(({ href, title }) => (
                <Link href={href} className="public-mobile-sub-link" key={href} onClick={() => setMobileOpen(false)}>
                  {title}
                </Link>
              ))}
            </div>

            <Link href="/tarifs" className="public-mobile-main-link" onClick={() => setMobileOpen(false)}>
              Tarification
            </Link>
            <Link href="/centre-aide" className="public-mobile-main-link" onClick={() => setMobileOpen(false)}>
              Centre d&apos;aide
            </Link>

            <Link href="/ressources" className="public-mobile-main-link" onClick={() => setMobileOpen(false)}>
              Ressources <ChevronDown size={15} />
            </Link>
            <div>
              {RESOURCE_NAV.map(({ href, title }) => (
                <Link href={href} className="public-mobile-sub-link" key={href} onClick={() => setMobileOpen(false)}>
                  {title}
                </Link>
              ))}
            </div>

            <Link href={appUrl("/connexion")} className="public-mobile-login" onClick={() => setMobileOpen(false)}>
              Se connecter
            </Link>
          </div>
        )}
      </nav>
    </>
  );
}
