"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Toaster } from "react-hot-toast";
import {
  LayoutDashboard, FileText, Users, ArrowLeftRight,
  MessageSquare, LogOut, Menu, Plus, Inbox, Download,
  Settings, Receipt, FolderOpen, BarChart2, Banknote,
} from "lucide-react";

const NAV = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Tableau de bord", key: "dashboard" },
  { href: "/inbox",     icon: Inbox,           label: "Boîte de réception", key: "inbox" },
  { href: "/invoices",  icon: FileText,         label: "Factures",           key: "invoices" },
  { href: "/clients",   icon: Users,            label: "Clients",            key: "clients" },
  { href: "/transactions", icon: ArrowLeftRight, label: "Transactions",      key: "transactions" },
  { href: "/tva",       icon: Receipt,          label: "Déclarations TVA",   key: "tva" },
  { href: "/paie",      icon: Banknote,         label: "La Paie",            key: "paie", soon: true },
  { href: "/export",    icon: Download,         label: "Export Fiduciaire",  key: "export" },
  { href: "/archive",   icon: FolderOpen,       label: "Archive",            key: "archive" },
];

const NAV_AI = [
  { href: "/chat",     icon: MessageSquare, label: "Mohasib Chat", key: "chat" },
  { href: "/rapports", icon: BarChart2,     label: "Rapports",     key: "rapports", soon: true },
];

const ALL_NAV = [
  ...NAV,
  ...NAV_AI,
  { href: "/settings", icon: Settings, label: "Paramètres", key: "settings" },
];

const PAGE_TITLES: Record<string, string> = {
  "/dashboard":    "Tableau de bord",
  "/inbox":        "Boîte de réception",
  "/invoices":     "Factures",
  "/invoices/new": "Nouvelle Facture",
  "/invoices/edit":"Modifier la Facture",
  "/clients":      "Clients",
  "/transactions": "Transactions",
  "/tva":          "Déclarations TVA",
  "/paie":         "La Paie",
  "/export":       "Export Fiduciaire",
  "/archive":      "Archive",
  "/chat":         "Mohasib Chat",
  "/rapports":     "Rapports",
  "/notifications":"Notifications",
  "/settings":     "Paramètres",
};

interface Props {
  children: React.ReactNode;
  userId?: string | null;
  userEmail?: string | null;
  userName?: string | null;
  userCompany?: string | null;
}

export default function AppShell({ children, userEmail, userName, userCompany }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  const isActive = (href: string) =>
    href === "/invoices"
      ? pathname === "/invoices" || pathname.startsWith("/invoices/")
      : pathname === href;

  const pageTitle = PAGE_TITLES[pathname] ?? "Mohasib";

  const initials = userName
    ? userName.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()
    : userEmail?.slice(0, 2).toUpperCase() ?? "U";

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  }

  // ── Desktop sidebar content ────────────────────────────────────────────────

  const SidebarContent = () => (
    <>
      <div className="px-[18px] pt-5 pb-[15px] border-b border-white/[0.07]">
        <Image src="/logo.png" alt="Mohasib" width={120} height={32} className="object-contain" />
        <div className="text-[10.5px] text-white/[0.28] mt-1.5">AI accounting for Moroccan SMEs</div>
      </div>

      <nav className="flex-1 py-2 overflow-y-auto">
        <div className="text-[10px] uppercase tracking-[1px] text-white/[0.22] px-[18px] pt-2.5 pb-1">Principal</div>
        {NAV.map(({ href, icon: Icon, label, soon }: any) => (
          <Link key={href} href={href}
            className={`flex items-center gap-2.5 px-[18px] py-[9px] text-[13px] transition-all border-r-2 ${
              isActive(href)
                ? "text-[#C8924A] bg-[rgba(200,146,74,0.10)] border-[#C8924A]"
                : "text-white/50 hover:text-white/85 hover:bg-white/5 border-transparent"
            } ${soon ? "opacity-70" : ""}`}>
            <Icon size={15} />
            {label}
            {soon && (
              <span style={{ background: "rgba(200,146,74,0.15)", color: "#C8924A", fontSize: "9px", padding: "1px 6px", borderRadius: "20px" }}>
                Bientôt
              </span>
            )}
          </Link>
        ))}
        <div className="text-[10px] uppercase tracking-[1px] text-white/[0.22] px-[18px] pt-[20px] pb-1">IA</div>
        {NAV_AI.map(({ href, icon: Icon, label, soon }: any) => (
          <Link key={href} href={href}
            className={`flex items-center gap-2.5 px-[18px] py-[9px] text-[13px] transition-all border-r-2 ${
              isActive(href)
                ? "text-[#C8924A] bg-[rgba(200,146,74,0.10)] border-[#C8924A]"
                : "text-white/50 hover:text-white/85 hover:bg-white/5 border-transparent"
            } ${soon ? "opacity-70" : ""}`}>
            <Icon size={15} />
            {label}
            {soon && (
              <span style={{ background: "rgba(200,146,74,0.15)", color: "#C8924A", fontSize: "9px", padding: "1px 6px", borderRadius: "20px" }}>
                Bientôt
              </span>
            )}
          </Link>
        ))}
      </nav>

      <div className="px-[18px] py-2.5 border-t border-white/[0.07]">
        <Link href="/settings"
          className={`flex items-center gap-2.5 px-0 py-[7px] text-[13px] transition-all ${
            pathname === "/settings" ? "text-[#C8924A]" : "text-white/40 hover:text-white/75"
          }`}>
          <Settings size={15} />
          Paramètres
        </Link>
      </div>

      <div className="px-[18px] py-3 border-t border-white/[0.07] flex items-center gap-2.5">
        <div className="w-[30px] h-[30px] rounded-full bg-[#C8924A] flex items-center justify-center text-[11px] font-bold text-[#0D1526] flex-shrink-0">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[12px] text-white/70 font-medium truncate">{userName || userEmail}</div>
          {userCompany && <div className="text-[10px] text-white/30 truncate">{userCompany}</div>}
        </div>
        <button onClick={signOut} className="text-white/30 hover:text-red-400 transition-colors ml-1">
          <LogOut size={14} />
        </button>
      </div>
    </>
  );

  return (
    <>
      <Toaster position="top-right" toastOptions={{ style: { fontSize: "13px" } }} />
      <div className="flex h-screen overflow-hidden bg-[#FAFAF6]">

        {/* Desktop sidebar */}
        <aside className="hidden md:flex fixed top-0 left-0 h-full w-[210px] flex-col z-20 bg-[#0D1526]">
          <SidebarContent />
        </aside>

        {/* Main */}
        <div className="flex flex-col flex-1 md:ml-[210px] min-w-0 h-screen overflow-hidden">

          {/* Topbar — hidden on mobile (bottom nav handles navigation) */}
          {pathname !== "/dashboard" && pathname !== "/chat" && (
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
                  <button className="btn btn-gold" onClick={() => document.dispatchEvent(new CustomEvent("bank-import-open"))}>
                    <Plus size={13} /> Importer un relevé
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Page content */}
          <main className="flex-1 overflow-hidden flex flex-col">
            {pathname === "/chat" ? (
              <div className="flex-1 overflow-hidden flex flex-col pb-[56px] md:pb-0">{children}</div>
            ) : (
              <div className="page-fade overflow-y-auto flex-1 p-4 md:p-[24px_22px_18px] pb-[72px] md:pb-[18px]">{children}</div>
            )}
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

          {/* AI Chat */}
          <Link href="/chat" className="flex flex-col items-center justify-center gap-[3px] flex-1 h-full"
            style={{ color: isActive("/chat") ? "#C8924A" : "rgba(255,255,255,0.45)" }}>
            <MessageSquare size={19} />
            <span style={{ fontSize: 10, fontWeight: 500 }}>AI Chat</span>
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
