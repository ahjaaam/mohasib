import Link from "next/link";
import Image from "next/image";
import { BookOpen, Calculator, ChevronDown, Download } from "lucide-react";

const FONT = "var(--font-jakarta), sans-serif";
const NAVY = "#0D1526";
const GOLD = "#C8924A";

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
    href: "/ressources/guides",
    title: "Guides téléchargeables",
    subtitle: "Ressources gratuites conçues pour les entrepreneurs",
    icon: Download,
  },
];

type PublicNavbarProps = {
  showBorder?: boolean;
};

export default function PublicNavbar({ showBorder = true }: PublicNavbarProps) {
  return (
    <>
      <style>{`
        .public-nav-inner { max-width: 1230px; margin: 0 auto; padding: 0 32px; height: 100%; display: flex; align-items: center; justify-content: space-between; }
        .public-resources-menu { position: relative; height: 74px; display: flex; align-items: center; }
        .public-resources-panel { position: absolute; top: 58px; left: 0; width: 390px; background: #FFFFFF; border: 1px solid rgba(0,0,0,0.08); border-radius: 10px; box-shadow: 0 18px 45px rgba(13,21,38,0.14); padding: 8px; opacity: 0; visibility: hidden; transform: translateY(6px); transition: all 0.16s ease; z-index: 40; }
        .public-resources-menu:hover .public-resources-panel, .public-resources-menu:focus-within .public-resources-panel { opacity: 1; visibility: visible; transform: translateY(0); }
        .public-resources-item { display: flex; gap: 12px; padding: 12px; border-radius: 8px; text-decoration: none; transition: background 0.15s ease; }
        .public-resources-item:hover { background: #FAFAF6; }
        @media (max-width: 760px) {
          .public-nav-inner { padding: 0 20px; }
          .public-resources-menu { display: none; }
        }
      `}</style>
      <nav style={{ backgroundColor: "#FFFFFF", height: 74, borderBottom: showBorder ? "1px solid rgba(0,0,0,0.06)" : "none" }}>
        <div className="public-nav-inner">
          <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
            <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center" }}>
              <Image src="/logo2.png" alt="Mohasib" width={168} height={50} style={{ height: "auto", objectFit: "contain" }} />
            </Link>
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
          </div>

          <Link href="/connexion" style={{ fontSize: 13, fontWeight: 600, color: "#FFFFFF", backgroundColor: GOLD, padding: "9px 20px", borderRadius: 5, textDecoration: "none", fontFamily: FONT }}>
            Se Connecter
          </Link>
        </div>
      </nav>
    </>
  );
}
