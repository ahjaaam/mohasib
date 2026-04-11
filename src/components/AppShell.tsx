"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Toaster } from "react-hot-toast";
import {
  LayoutDashboard, FileText, Users, ArrowLeftRight,
  MessageSquare, LogOut, Menu, X, Plus, Inbox, Download, Settings,
} from "lucide-react";

const NAV = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Tableau de bord", key: "dashboard" },
  { href: "/inbox", icon: Inbox, label: "Boîte de réception", key: "inbox" },
  { href: "/invoices", icon: FileText, label: "Factures", key: "invoices" },
  { href: "/clients", icon: Users, label: "Clients", key: "clients" },
  { href: "/transactions", icon: ArrowLeftRight, label: "Transactions", key: "transactions" },
  { href: "/export", icon: Download, label: "Export Fiduciaire", key: "export" },
];

const NAV_AI = [
  { href: "/chat", icon: MessageSquare, label: "Mohasib AI", key: "chat" },
];

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Tableau de bord",
  "/inbox": "Boîte de réception",
  "/invoices": "Factures",
  "/invoices/new": "Nouvelle Facture",
  "/invoices/edit": "Modifier la Facture",
  "/clients": "Clients",
  "/transactions": "Transactions",
  "/export": "Export Fiduciaire",
  "/chat": "Mohasib AI",
  "/notifications": "Notifications",
  "/settings": "Paramètres",
};

interface Props {
  children: React.ReactNode;
  userId?: string | null;
  userEmail?: string | null;
  userName?: string | null;
  userCompany?: string | null;
}

export default function AppShell({ children, userEmail, userName, userCompany }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  // Close sidebar on route change
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

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

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="px-[18px] pt-5 pb-[15px] border-b border-white/[0.07]">
        <Image src="/logo.png" alt="Mohasib" width={120} height={32} className="object-contain" />
        <div className="text-[10.5px] text-white/[0.28] mt-1.5">AI accounting for Moroccan SMEs</div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2 overflow-y-auto">
        <div className="text-[9.5px] uppercase tracking-[1px] text-white/[0.22] px-[18px] pt-2.5 pb-1">Principal</div>
        {NAV.map(({ href, icon: Icon, label }) => (
          <Link key={href} href={href}
            className={`flex items-center gap-2.5 px-[18px] py-[9px] text-[13px] transition-all border-r-2 ${
              isActive(href)
                ? "text-[#C8924A] bg-[rgba(200,146,74,0.10)] border-[#C8924A]"
                : "text-white/50 hover:text-white/85 hover:bg-white/5 border-transparent"
            }`}>
            <Icon size={15} />
            {label}
          </Link>
        ))}
        <div className="text-[9.5px] uppercase tracking-[1px] text-white/[0.22] px-[18px] pt-3 pb-1">IA</div>
        {NAV_AI.map(({ href, icon: Icon, label }) => (
          <Link key={href} href={href}
            className={`flex items-center gap-2.5 px-[18px] py-[9px] text-[13px] transition-all border-r-2 ${
              isActive(href)
                ? "text-[#C8924A] bg-[rgba(200,146,74,0.10)] border-[#C8924A]"
                : "text-white/50 hover:text-white/85 hover:bg-white/5 border-transparent"
            }`}>
            <Icon size={15} />
            {label}
          </Link>
        ))}
      </nav>

      {/* Settings */}
      <div className="px-[18px] py-2.5 border-t border-white/[0.07]">
        <Link href="/settings"
          className={`flex items-center gap-2.5 px-0 py-[7px] text-[13px] transition-all ${
            pathname === "/settings"
              ? "text-[#C8924A]"
              : "text-white/40 hover:text-white/75"
          }`}>
          <Settings size={15} />
          Paramètres
        </Link>
      </div>

      {/* User footer */}
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
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-10 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar — desktop fixed, mobile drawer */}
      <aside className={`
        fixed top-0 left-0 h-full w-[210px] flex flex-col z-20
        bg-[#0D1526] transition-transform duration-250
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        md:translate-x-0
      `}>
        <SidebarContent />
      </aside>

      {/* Main */}
      <div className="flex flex-col flex-1 md:ml-[210px] min-w-0 h-screen overflow-hidden">
        {/* Topbar */}
        <div className="flex items-center justify-between px-5 md:px-[22px] h-[52px] border-b border-[rgba(0,0,0,0.08)] bg-white flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <button className="md:hidden p-1 text-[#6B7280]" onClick={() => setSidebarOpen(!sidebarOpen)}>
              {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <span className="text-[14px] font-semibold text-[#1A1A2E]">{pageTitle}</span>
          </div>
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
              <Link href="/invoices" className="btn btn-outline">
                ← Annuler
              </Link>
            )}
            {pathname === "/clients" && (
              <button className="btn btn-gold" onClick={() => document.dispatchEvent(new CustomEvent("open-add-client"))}>
                <Plus size={13} /> Nouveau client
              </button>
            )}
            {pathname === "/transactions" && (
              <>
                <button
                  className="btn btn-outline text-[12px]"
                  onClick={() => document.dispatchEvent(new CustomEvent("bank-import-open"))}
                >
                  📄 Importer un relevé
                </button>
                <button className="btn btn-gold" onClick={() => document.dispatchEvent(new CustomEvent("focus-tx-form"))}>
                  <Plus size={13} /> Transaction
                </button>
              </>
            )}
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-[18px_22px]">
          <div className="max-w-6xl mx-auto page-fade">
            {children}
          </div>
        </main>
      </div>
    </div>
    </>
  );
}
