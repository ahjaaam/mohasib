"use client";

import Link from "next/link";
import Image from "next/image";
import { BookOpen, Building2, Calculator, ChevronDown, Download, Landmark, Menu, X } from "lucide-react";
import { useState } from "react";
import { appUrl } from "@/lib/public-urls";

const FONT = "var(--font-jakarta), sans-serif";
const NAVY = "#0D1526";
const GOLD = "#C8924A";

const SOFTWARE_NAV = [
  {
    href: "/logiciels/business",
    title: "Mohasib Business",
    subtitle: "Pour entrepreneurs, TPE et PME",
    icon: Building2,
    features: ["Facturation & devis", "TVA et trésorerie", "OCR, documents et exports"],
  },
  {
    href: "/logiciels/comptable-pro",
    title: "Comptable Pro",
    subtitle: "Pour fiduciaires et cabinets comptables",
    icon: Landmark,
    features: ["Dossiers clients", "Production comptable", "TVA, paie et exports CGNC"],
  },
];

const RESOURCE_NAV = [
  {
    href: "/ressources/blog",
    title: "Blog",
    subtitle: "Tout savoir sur la comptabilité et l'entrepreneuriat",
    icon: BookOpen,
  },
  {
    href: "/ressources/outils",
    title: "Outils de simulation",
    subtitle: "Simulations personnalisées",
    icon: Calculator,
  },
  {
    href: "/ressources/documents",
    title: "Documents téléchargeables",
    subtitle: "Modèles, templates et documents prêts à l’emploi",
    icon: Download,
  },
];

type PublicNavbarProps = {
  showBorder?: boolean;
};

export default function PublicNavbar({ showBorder = true }: PublicNavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <style>{`
        .public-navbar { position: relative; z-index: 50; }
        .public-nav-inner { max-width: 1230px; margin: 0 auto; padding: 0 32px; height: 100%; display: flex; align-items: center; justify-content: space-between; }
        .public-nav-left { display: flex; align-items: center; gap: 28px; }
        .public-nav-links { display: flex; align-items: center; gap: 28px; }
        .public-resources-menu { position: relative; height: 74px; display: flex; align-items: center; }
        .public-resources-panel { position: absolute; top: 58px; left: 0; width: 390px; background: #FFFFFF; border: 1px solid rgba(0,0,0,0.08); border-radius: 10px; box-shadow: 0 18px 45px rgba(13,21,38,0.14); padding: 8px; opacity: 0; visibility: hidden; transform: translateY(6px); transition: all 0.16s ease; z-index: 40; }
        .public-resources-menu:hover .public-resources-panel, .public-resources-menu:focus-within .public-resources-panel { opacity: 1; visibility: visible; transform: translateY(0); }
        .public-resources-item { display: flex; gap: 12px; padding: 12px; border-radius: 8px; text-decoration: none; transition: background 0.15s ease; }
        .public-resources-item:hover { background: #FAFAF6; }
        .public-software-panel { width: 620px; padding: 10px; }
        .public-software-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
        .public-software-card { display: block; min-height: 100%; border-radius: 10px; padding: 14px; text-decoration: none; transition: background 0.15s ease, border-color 0.15s ease; border: 1px solid transparent; }
        .public-software-card:hover { background: #FAFAF6; border-color: rgba(200,146,74,0.22); }
        .public-software-feature { display: flex; align-items: center; gap: 7px; margin-top: 8px; color: #6B7280; font-size: 11.5px; line-height: 1.35; font-family: ${FONT}; }
        .public-software-dot { width: 5px; height: 5px; border-radius: 999px; background: ${GOLD}; flex-shrink: 0; }
        .public-nav-actions { display: flex; align-items: center; gap: 10px; }
        .public-mobile-toggle, .public-mobile-panel { display: none; }
        @keyframes nav-trial-pop {
          0%, 100% { transform: translateY(0) scale(1); box-shadow: 0 6px 16px rgba(200,146,74,0.20); }
          50% { transform: translateY(-1px) scale(1.045); box-shadow: 0 10px 24px rgba(200,146,74,0.30); }
        }
        .public-trial-pop { animation: nav-trial-pop 2.5s ease-in-out infinite; will-change: transform; }
        .public-trial-pop:hover { animation-play-state: paused; transform: translateY(-1px) scale(1.045); }
        @media (max-width: 900px) {
          .public-nav-inner { padding: 0 24px; }
          .public-nav-links, .public-nav-actions { display: none !important; }
          .public-mobile-toggle { display: inline-flex; width: 42px; height: 42px; align-items: center; justify-content: center; border: 1px solid rgba(13,21,38,0.10); border-radius: 6px; background: #FFFFFF; color: #0D1526; cursor: pointer; }
          .public-mobile-panel { display: block; position: absolute; top: 74px; left: 0; right: 0; padding: 8px 24px 22px; background: #FFFFFF; border-top: 1px solid rgba(0,0,0,0.06); box-shadow: 0 18px 35px rgba(13,21,38,0.10); }
          .public-mobile-main-link { display: flex; align-items: center; justify-content: space-between; min-height: 48px; border-bottom: 1px solid rgba(0,0,0,0.06); color: #0D1526; font-size: 14px; font-weight: 700; text-decoration: none; font-family: ${FONT}; }
          .public-mobile-resource { display: flex; align-items: center; gap: 12px; padding: 10px 0; color: #374151; font-size: 13px; font-weight: 600; text-decoration: none; font-family: ${FONT}; }
          .public-mobile-login { display: flex; min-height: 44px; margin-top: 10px; align-items: center; justify-content: center; border-radius: 6px; border: 1px solid ${GOLD}; background: #FFFFFF; color: ${GOLD}; font-size: 13px; font-weight: 700; text-decoration: none; font-family: ${FONT}; }
          .public-mobile-trial { display: flex; min-height: 44px; margin-top: 16px; align-items: center; justify-content: center; border-radius: 6px; background: ${GOLD}; color: #FFFFFF; font-size: 13px; font-weight: 700; text-decoration: none; font-family: ${FONT}; }
        }
        @media (max-width: 480px) {
          .public-nav-inner { padding: 0 18px; }
          .public-brand-image { width: 138px !important; }
          .public-mobile-panel { padding-left: 18px; padding-right: 18px; }
        }
      `}</style>
      <nav className="public-navbar" style={{ backgroundColor: "#FFFFFF", height: 74, borderBottom: showBorder ? "1px solid rgba(0,0,0,0.06)" : "none" }}>
        <div className="public-nav-inner">
          <div className="public-nav-left">
            <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center" }}>
              <Image className="public-brand-image" src="/logo2.png" alt="Mohasib" width={168} height={50} style={{ width: 168, height: "auto", objectFit: "contain" }} />
            </Link>
            <div className="public-nav-links">
              <div className="public-resources-menu">
                <Link href="/logiciels/business" style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 600, color: "#374151", textDecoration: "none", fontFamily: FONT }}>
                  Logiciels <ChevronDown size={14} />
                </Link>
                <div className="public-resources-panel public-software-panel">
                  <div className="public-software-grid">
                    {SOFTWARE_NAV.map(({ href, title, subtitle, features, icon: Icon }) => (
                      <Link key={href} href={href} className="public-software-card">
                        <span style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(200,146,74,0.10)", color: GOLD, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Icon size={18} />
                        </span>
                        <span style={{ display: "block", marginTop: 12, fontSize: 14, fontWeight: 800, color: NAVY, fontFamily: FONT }}>{title}</span>
                        <span style={{ display: "block", marginTop: 3, fontSize: 12, lineHeight: 1.45, color: "#6B7280", fontFamily: FONT }}>{subtitle}</span>
                        <span style={{ display: "block", marginTop: 10 }}>
                          {features.map((feature) => (
                            <span key={feature} className="public-software-feature">
                              <span className="public-software-dot" />
                              {feature}
                            </span>
                          ))}
                        </span>
                        <span style={{ display: "inline-flex", marginTop: 14, fontSize: 12, fontWeight: 800, color: GOLD, fontFamily: FONT }}>Voir le logiciel →</span>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
              <div className="public-resources-menu">
                <Link href="/ressources" style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 600, color: "#374151", textDecoration: "none", fontFamily: FONT }}>
                  Ressources <ChevronDown size={14} />
                </Link>
                <div className="public-resources-panel">
                  {RESOURCE_NAV.map(({ href, title, subtitle, icon: Icon }) => (
                    <Link key={href} href={href} className="public-resources-item">
                      <span style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(200,146,74,0.10)", color: GOLD, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Icon size={18} />
                      </span>
                      <span>
                        <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: NAVY, fontFamily: FONT }}>{title}</span>
                        <span style={{ display: "block", marginTop: 3, fontSize: 12, lineHeight: 1.45, color: "#6B7280", fontFamily: FONT }}>{subtitle}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
              <Link href="/tarifs" style={{ fontSize: 13, fontWeight: 600, color: "#374151", textDecoration: "none", fontFamily: FONT }}>
                Tarifs
              </Link>
              <Link href="/centre-aide" style={{ fontSize: 13, fontWeight: 600, color: "#374151", textDecoration: "none", fontFamily: FONT }}>
                Centre d&apos;aide
              </Link>
            </div>
          </div>

          <div className="public-nav-actions">
            <Link href={appUrl("/inscription")} className="public-trial-pop" style={{ fontSize: 13, fontWeight: 700, color: "#FFFFFF", backgroundColor: GOLD, padding: "10px 18px", borderRadius: 5, textDecoration: "none", fontFamily: FONT }}>
              Essai Gratuit
            </Link>
            <Link href={appUrl("/connexion")} style={{ fontSize: 13, fontWeight: 600, color: GOLD, backgroundColor: "#FFFFFF", border: `2px solid ${GOLD}`, padding: "8px 19px", borderRadius: 5, textDecoration: "none", fontFamily: FONT }}>
              Se Connecter
            </Link>
          </div>
          <button
            type="button"
            className="public-mobile-toggle"
            aria-label={mobileOpen ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
        {mobileOpen && (
          <div className="public-mobile-panel">
            <Link href="/logiciels/business" className="public-mobile-main-link" onClick={() => setMobileOpen(false)}>
              Logiciels <ChevronDown size={15} />
            </Link>
            <div>
              {SOFTWARE_NAV.map(({ href, title, icon: Icon }) => (
                <Link key={href} href={href} className="public-mobile-resource" onClick={() => setMobileOpen(false)}>
                  <span style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(200,146,74,0.10)", color: GOLD, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon size={15} />
                  </span>
                  {title}
                </Link>
              ))}
            </div>
            <Link href="/ressources" className="public-mobile-main-link" onClick={() => setMobileOpen(false)}>
              Ressources <ChevronDown size={15} />
            </Link>
            <div>
              {RESOURCE_NAV.map(({ href, title, icon: Icon }) => (
                <Link key={href} href={href} className="public-mobile-resource" onClick={() => setMobileOpen(false)}>
                  <span style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(200,146,74,0.10)", color: GOLD, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon size={15} />
                  </span>
                  {title}
                </Link>
              ))}
            </div>
            <Link href="/tarifs" className="public-mobile-main-link" onClick={() => setMobileOpen(false)}>Tarifs</Link>
            <Link href="/centre-aide" className="public-mobile-main-link" onClick={() => setMobileOpen(false)}>Centre d&apos;aide</Link>
            <Link href={appUrl("/inscription")} className="public-mobile-trial public-trial-pop" onClick={() => setMobileOpen(false)}>Essayez</Link>
            <Link href={appUrl("/connexion")} className="public-mobile-login" onClick={() => setMobileOpen(false)}>Se connecter</Link>
          </div>
        )}
      </nav>
    </>
  );
}
