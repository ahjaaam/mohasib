"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Toaster } from "react-hot-toast";
import {
  LayoutDashboard, FileText, Users, ArrowLeftRight,
  LogOut, Menu, Plus, Inbox, Download,
  Settings, Receipt, FolderOpen, BarChart2, Banknote, Briefcase, CreditCard, PenLine,
  ChevronLeft, ChevronRight,
} from "lucide-react";

const NAV_MAIN = [
  { href: "/dashboard",    icon: LayoutDashboard, label: "Tableau de bord",    key: "dashboard" },
  { href: "/inbox",        icon: Inbox,           label: "Boîte de réception", key: "inbox" },
  { href: "/invoices",          icon: FileText,   label: "Factures",            key: "invoices" },
  { href: "/suivi-paiements",   icon: CreditCard, label: "Suivi des paiements", key: "suivi-paiements" },
  { href: "/clients",           icon: Users,      label: "Clients",             key: "clients" },
  { href: "/transactions", icon: ArrowLeftRight,  label: "Transactions",       key: "transactions" },
  { href: "/saisie",       icon: PenLine,         label: "Saisie comptable",   key: "saisie" },
  { href: "/tva",          icon: Receipt,         label: "Déclarations TVA",   key: "tva" },
  { href: "/paie",         icon: Banknote,        label: "La Paie",            key: "paie" },
  { href: "/export",       icon: Download,        label: "Exports",            key: "export" },
  { href: "/archive",      icon: FolderOpen,      label: "Archive",            key: "archive" },
];

const NAV_SOON: typeof NAV_MAIN = [];

const ALL_NAV = [
  ...NAV_MAIN,
  ...NAV_SOON,
  { href: "/rapports", icon: BarChart2,     label: "Rapports",     key: "rapports", soon: true },
  { href: "/settings", icon: Settings,      label: "Paramètres",   key: "settings" },
];

const PAGE_TITLES: Record<string, string> = {
  "/dashboard":    "Tableau de bord",
  "/tableau-de-bord": "Tableau de bord",
  "/inbox":        "Boîte de réception",
  "/boite-de-reception": "Boîte de réception",
  "/invoices":     "Factures",
  "/factures":     "Factures",
  "/invoices/new": "Nouvelle Facture",
  "/factures/nouvelle": "Nouvelle Facture",
  "/invoices/edit":"Modifier la Facture",
  "/clients":      "Clients",
  "/suivi-paiements": "Suivi des paiements",
  "/transactions":    "Transactions",
  "/saisie":          "Saisie comptable",
  "/rapprochement":  "Rapprochement Bancaire",  
  "/tva":            "Déclarations TVA",
  "/declarations-tva": "Déclarations TVA",
  "/paie":         "Paie",
  "/export":       "Exports",
  "/export-fiduciaire": "Exports",
  "/archive":      "Archive",
  "/rapports":     "Rapports",
  "/notifications":"Notifications",
  "/settings":     "Paramètres",
  "/parametres":    "Paramètres",
};

const HIDE_TOPBAR_PATHS = new Set([
  "/dashboard",
  "/tableau-de-bord",
  "/inbox",
  "/boite-de-reception",
  "/paie",
  "/invoices",
  "/factures",
  "/clients",
  "/suivi-paiements",
  "/transactions",
  "/saisie",
  "/tva",
  "/declarations-tva",
  "/export",
  "/export-fiduciaire",
  "/archive",
  "/settings",
  "/parametres",
]);

interface Props {
  children: React.ReactNode;
  userId?: string | null;
  userEmail?: string | null;
  userName?: string | null;
  userCompany?: string | null;
  isFiduciaire?: boolean;
}

export default function AppShell({ children, userEmail, userName, userCompany, isFiduciaire }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  const [docsRemaining, setDocsRemaining] = useState<number | null>(null);
  useEffect(() => {
    if (pathname === "/transactions") {
      fetch("/api/usage").then(r => r.json()).then(d => { if (d.remaining != null) setDocsRemaining(d.remaining); }).catch(() => {});
    }
  }, [pathname]);

  const isActive = (href: string) => {
    const frenchToEnglish: Record<string, string> = {
      "/tableau-de-bord": "/dashboard",
      "/boite-de-reception": "/inbox",
      "/factures": "/invoices",
      "/declarations-tva": "/tva",
      "/export-fiduciaire": "/export",
      "/parametres": "/settings",
    };
    const currentPath = frenchToEnglish[pathname] ?? pathname;
    if (href === "/invoices") {
      return currentPath === "/invoices" || currentPath.startsWith("/invoices/");
    }
    if (href === "/suivi-paiements") {
      return currentPath.startsWith("/suivi-paiements");
    }
    return currentPath === href;
  };

  const pageTitle = PAGE_TITLES[pathname] ?? "Mohasib";

  const initials = userName
    ? userName.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()
    : userEmail?.slice(0, 2).toUpperCase() ?? "U";

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/connexion");
    router.refresh();
  }

  // ── Desktop sidebar content ────────────────────────────────────────────────

  const SidebarContent = () => (
    <>
      {/* Header */}
      <div className={`pt-4 pb-[15px] border-b border-white/[0.07] flex items-center ${sidebarCollapsed ? "justify-center px-0" : "px-[18px]"}`}>
        {sidebarCollapsed ? (
          <Image src="/favicon.png" alt="Mohasib" width={28} height={28} className="object-contain" />
        ) : (
          <div>
            <Image src="/logo.png" alt="Mohasib" width={120} height={40} style={{ height: "auto" }} className="object-contain" />
            <div className="text-[10.5px] text-white/[0.28] mt-1.5">AI accounting for Moroccan SMEs</div>
          </div>
        )}
      </div>

      <nav className="flex-1 py-2 overflow-y-auto">
        {NAV_MAIN.map(({ href, icon: Icon, label }: any) => (
          <Link key={href} href={href} title={sidebarCollapsed ? label : undefined}
            className={`flex items-center py-[12px] text-[13px] transition-all border-r-2 ${
              sidebarCollapsed ? "justify-center px-0" : "gap-2.5 px-[18px]"
            } ${
              isActive(href)
                ? "text-[#C8924A] bg-[rgba(200,146,74,0.10)] border-[#C8924A]"
                : "text-white/50 hover:text-white/85 hover:bg-white/5 border-transparent"
            }`}>
            <Icon size={sidebarCollapsed ? 18 : 15} />
            {!sidebarCollapsed && label}
          </Link>
        ))}
      </nav>

      {isFiduciaire && (
        <div className="border-t border-white/[0.07] py-[7px]">
          <Link href="/comptable-pro" title={sidebarCollapsed ? "Comptable Pro" : undefined}
            className={`flex items-center py-[7px] text-[13px] transition-all ${
              sidebarCollapsed ? "justify-center px-0" : "gap-2.5 px-[18px]"
            } ${pathname.startsWith("/comptable-pro") ? "text-[#C8924A]" : "text-white/40 hover:text-white/75"}`}>
            <Briefcase size={sidebarCollapsed ? 18 : 15} />
            {!sidebarCollapsed && "Comptable Pro"}
          </Link>
        </div>
      )}

      <div className="border-t border-white/[0.07] py-[7px]">
        <Link href="/settings" title={sidebarCollapsed ? "Paramètres" : undefined}
          className={`flex items-center py-[7px] text-[13px] transition-all ${
            sidebarCollapsed ? "justify-center px-0" : "gap-2.5 px-[18px]"
          } ${pathname === "/settings" ? "text-[#C8924A]" : "text-white/40 hover:text-white/75"}`}>
          <Settings size={sidebarCollapsed ? 18 : 15} />
          {!sidebarCollapsed && "Paramètres"}
        </Link>
      </div>

      <div className={`py-3 border-t border-white/[0.07] flex items-center ${sidebarCollapsed ? "justify-center px-0" : "px-[18px] gap-2.5"}`}>
        <div className="w-[30px] h-[30px] rounded-full bg-[#C8924A] flex items-center justify-center text-[11px] font-bold text-[#0D1526] flex-shrink-0"
          title={sidebarCollapsed ? (userName || userEmail || undefined) : undefined}>
          {initials}
        </div>
        {!sidebarCollapsed && (
          <>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] text-white/70 font-medium truncate">{userName || userEmail}</div>
              {userCompany && <div className="text-[10px] text-white/30 truncate">{userCompany}</div>}
            </div>
            <button onClick={signOut} className="text-white/30 hover:text-red-400 transition-colors ml-1">
              <LogOut size={14} />
            </button>
          </>
        )}
      </div>
    </>
  );

  return (
    <>
      <Toaster position="top-right" toastOptions={{ style: { fontSize: "13px" } }} />
      <div className="flex h-screen overflow-hidden bg-[#FAFAF6]">

        {/* Desktop sidebar */}
        <aside
          className="hidden md:flex fixed top-0 left-0 h-full flex-col z-20 bg-[#0D1526] transition-[width] duration-200 overflow-visible"
          style={{ width: sidebarCollapsed ? 56 : 210 }}
        >
          <SidebarContent />

          {/* Circle toggle on the sidebar right edge */}
          <button
            onClick={() => setSidebarCollapsed(v => !v)}
            title={sidebarCollapsed ? "Développer" : "Réduire"}
            className="absolute top-[54px] -right-[11px] w-[22px] h-[22px] rounded-full flex items-center justify-center transition-colors z-30"
            style={{
              background: "#1a2540",
              border: "1px solid rgba(255,255,255,0.14)",
              color: "rgba(255,255,255,0.45)",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.9)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.3)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.45)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.14)"; }}
          >
            {sidebarCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
          </button>
        </aside>

        {/* Main */}
        <div
          className="flex flex-col flex-1 min-w-0 h-screen overflow-hidden transition-[margin] duration-200"
          style={{ marginLeft: sidebarCollapsed ? 56 : 210 }}
        >

          {/* Topbar — hidden on mobile (bottom nav handles navigation) */}
          {!HIDE_TOPBAR_PATHS.has(pathname) && (
            <div className="hidden md:flex items-center justify-between px-[22px] h-[52px] border-b border-[rgba(0,0,0,0.08)] bg-white flex-shrink-0">
              <span className="text-[14px] font-semibold text-[#1A1A2E]">{pageTitle}</span>
              <div className="flex items-center gap-2">
                {pathname === "/inbox" && (
                  <button className="btn btn-gold" onClick={() => document.dispatchEvent(new CustomEvent("inbox-upload"))}>
                    <Plus size={13} /> Importer un reçu
                  </button>
                )}
                {pathname === "/invoices" && (
                  <Link href="/invoices/new" className="btn btn-gold">
                    <Plus size={13} /> Nouvelle Facture
                  </Link>
                )}
                {pathname === "/invoices/new" && (
                  <Link href="/invoices" className="btn btn-outline">← Annuler</Link>
                )}
                {pathname === "/clients" && (
                  <button className="btn btn-gold" onClick={() => document.dispatchEvent(new CustomEvent("open-add-client"))}>
                    <Plus size={13} /> Nouveau client
                  </button>
                )}
                {pathname === "/transactions" && (
                  <div className="relative group flex flex-col items-end gap-0.5">
                    <button className="btn btn-gold" onClick={() => document.dispatchEvent(new CustomEvent("bank-import-open"))}>
                      <Plus size={13} /> Importer un relevé
                    </button>
                    <div className="absolute right-0 top-full mt-1.5 bg-[#0D1526] text-white text-[11px] rounded-md px-2.5 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                      PDF max 8 pages · CSV max 200 lignes
                    </div>
                    {docsRemaining !== null && (
                      <span className={`text-[10.5px] font-medium ${docsRemaining === 0 ? "text-[#DC2626]" : docsRemaining <= 20 ? "text-[#D97706]" : "text-[#6B7280]"}`}>
                        {docsRemaining === 0 ? "Limite atteinte" : `${docsRemaining} doc${docsRemaining > 1 ? "s" : ""} restant${docsRemaining > 1 ? "s" : ""}`}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Page content */}
          <main className="flex-1 overflow-hidden flex flex-col">
            <div className="page-fade overflow-y-auto flex-1 p-4 md:p-[24px_22px_18px] pb-[72px] md:pb-[18px]">{children}</div>
          </main>
        </div>

        {/* ── MOBILE BOTTOM NAV ──────────────────────────────────────────────── */}
        <nav
          className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around"
          style={{
            height: 56,
            backgroundColor: "#0D1526",
            borderTop: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          {/* Accueil */}
          <Link href="/dashboard" className="flex flex-col items-center justify-center gap-[3px] flex-1 h-full"
            style={{ color: isActive("/dashboard") ? "#C8924A" : "rgba(255,255,255,0.45)" }}>
            <LayoutDashboard size={19} />
            <span style={{ fontSize: 10, fontWeight: 500 }}>Accueil</span>
          </Link>

          {/* Factures */}
          <Link href="/invoices" className="flex flex-col items-center justify-center gap-[3px] flex-1 h-full"
            style={{ color: isActive("/invoices") ? "#C8924A" : "rgba(255,255,255,0.45)" }}>
            <FileText size={19} />
            <span style={{ fontSize: 10, fontWeight: 500 }}>Factures</span>
          </Link>

          {/* Archive */}
          <Link href="/archive" className="flex flex-col items-center justify-center gap-[3px] flex-1 h-full"
            style={{ color: isActive("/archive") ? "#C8924A" : "rgba(255,255,255,0.45)" }}>
            <Download size={19} />
            <span style={{ fontSize: 10, fontWeight: 500 }}>Archive</span>
          </Link>

          {/* Menu */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex flex-col items-center justify-center gap-[3px] flex-1 h-full"
            style={{ background: "none", border: "none", color: drawerOpen ? "#C8924A" : "rgba(255,255,255,0.45)" }}
          >
            <Menu size={19} />
            <span style={{ fontSize: 10, fontWeight: 500 }}>Menu</span>
          </button>
        </nav>

        {/* ── MENU DRAWER ────────────────────────────────────────────────────── */}
        {drawerOpen && (
          <>
            {/* Overlay */}
            <div
              className="md:hidden fixed inset-0 z-[60]"
              style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
              onClick={() => setDrawerOpen(false)}
            />

            {/* Drawer */}
            <div
              className="md:hidden fixed bottom-0 left-0 right-0 z-[70] flex flex-col"
              style={{
                backgroundColor: "#0D1526",
                borderRadius: "16px 16px 0 0",
                padding: "16px 0 24px",
                maxHeight: "80vh",
              }}
            >
              {/* Drag handle */}
              <div className="flex justify-center mb-3">
                <div style={{ width: 32, height: 4, borderRadius: 9999, backgroundColor: "rgba(255,255,255,0.2)" }} />
              </div>

              {/* Nav items */}
              <div className="overflow-y-auto">
                {ALL_NAV.map(({ href, icon: Icon, label, soon }: any) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setDrawerOpen(false)}
                    className="flex items-center gap-3 px-[20px] py-[12px] transition-colors"
                    style={{ color: isActive(href) ? "#C8924A" : "rgba(255,255,255,0.7)" }}
                  >
                    <Icon size={16} />
                    <span style={{ fontSize: 14, fontWeight: 500 }}>{label}</span>
                    {soon && (
                      <span style={{ background: "rgba(200,146,74,0.15)", color: "#C8924A", fontSize: "9px", padding: "1px 6px", borderRadius: "20px", marginLeft: 4 }}>
                        Bientôt
                      </span>
                    )}
                  </Link>
                ))}

                {/* Fiduciaire */}
                {isFiduciaire && (
                  <>
                    <div style={{ height: 1, backgroundColor: "rgba(255,255,255,0.07)", margin: "8px 20px" }} />
                    <Link href="/comptable-pro" onClick={() => setDrawerOpen(false)}
                      className="flex items-center gap-3 px-[20px] py-[12px] transition-colors"
                      style={{ color: pathname.startsWith("/comptable-pro") ? "#C8924A" : "rgba(255,255,255,0.7)" }}>
                      <Briefcase size={16} />
                      <span style={{ fontSize: 14, fontWeight: 500 }}>Comptable Pro</span>
                    </Link>
                  </>
                )}

                {/* Sign out */}
                <div style={{ height: 1, backgroundColor: "rgba(255,255,255,0.07)", margin: "8px 20px" }} />
                <button
                  onClick={signOut}
                  className="flex items-center gap-3 px-[20px] py-[12px] w-full transition-colors"
                  style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 14 }}
                >
                  <LogOut size={16} />
                  <span style={{ fontSize: 14 }}>Se déconnecter</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
