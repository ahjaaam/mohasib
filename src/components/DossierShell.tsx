"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Toaster } from "react-hot-toast";
import {
  LayoutDashboard, FileText, Users, ArrowLeftRight, PenLine,
  Receipt, Download, BarChart2, Banknote, Archive, TrendingUp,
  Inbox, ChevronLeft, Building2, LogOut, X, Menu,
} from "lucide-react";

const NAV_GROUPS = [
  {
    group: "COMPTABILITÉ",
    items: [
      { slug: "dashboard",    icon: LayoutDashboard, label: "Tableau de bord" },
      { slug: "inbox",        icon: Inbox,           label: "Boîte de réception" },
      { slug: "invoices",     icon: FileText,        label: "Factures clients" },
      { slug: "clients",      icon: Users,           label: "Clients" },
      { slug: "transactions", icon: ArrowLeftRight,  label: "Transactions" },
      { slug: "saisie",       icon: PenLine,         label: "Saisie comptable" },
      { slug: "paie",         icon: Banknote,        label: "Bulletins de paie" },
    ],
  },
  {
    group: "FISCAL",
    items: [
      { slug: "tva",         icon: Receipt,   label: "Déclaration TVA" },
      { slug: "grand-livre", icon: BarChart2, label: "Grand Livre" },
      { slug: "export",      icon: Download,  label: "Export CGNC" },
      { slug: "bilan",       icon: BarChart2, label: "Bilan / CPC" },
    ],
  },
  {
    group: "DOCUMENTS",
    items: [
      { slug: "archive",  icon: Archive,    label: "Documents" },
      { slug: "rapports", icon: TrendingUp, label: "Rapports" },
    ],
  },
];

interface DossierMeta {
  id: string;
  raison_sociale: string;
  ice: string | null;
  regime_tva: string | null;
}

interface Props {
  children: React.ReactNode;
  dossier: DossierMeta;
  userName?: string | null;
  userEmail?: string | null;
}

export default function DossierShell({ children, dossier, userName, userEmail }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  const base = `/comptable-pro/dossiers/${dossier.id}`;

  function isActive(slug: string) {
    const href = `${base}/${slug}`;
    return pathname === href || pathname.startsWith(href + "/");
  }

  const initials = dossier.raison_sociale
    .split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  const userInitials = userName
    ? userName.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()
    : userEmail?.slice(0, 2).toUpperCase() ?? "U";

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  }

  const SidebarContent = () => (
    <>
      {/* Dossier identity */}
      <div className="px-[18px] pt-4 pb-3 border-b border-white/[0.07]">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-[#C8924A] flex items-center justify-center flex-shrink-0 text-[13px] font-bold text-white">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-white truncate leading-tight">
              {dossier.raison_sociale}
            </div>
            {dossier.regime_tva && (
              <div className="text-[10px] text-[#C8924A]/70 mt-0.5 capitalize">TVA {dossier.regime_tva}</div>
            )}
          </div>
        </div>
      </div>

      <nav className="flex-1 py-2 overflow-y-auto">
        {NAV_GROUPS.map(({ group, items }) => (
          <div key={group}>
            <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "1.5px", color: "rgba(255,255,255,0.14)", padding: "14px 18px 6px" }}>
              {group}
            </div>
            {items.map(({ slug, icon: Icon, label }) => (
              <Link key={slug} href={`${base}/${slug}`}
                className={`flex items-center gap-2.5 px-[18px] py-[9px] text-[12.5px] transition-all border-r-2 ${
                  isActive(slug)
                    ? "text-[#C8924A] bg-[rgba(200,146,74,0.10)] border-[#C8924A]"
                    : "text-white/50 hover:text-white/85 hover:bg-white/5 border-transparent"
                }`}>
                <Icon size={14} />
                {label}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="px-[18px] py-3 border-t border-white/[0.07] flex items-center gap-2.5">
        <div className="w-[28px] h-[28px] rounded-full bg-[#C8924A] flex items-center justify-center text-[10px] font-bold text-[#0D1526] flex-shrink-0">
          {userInitials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11.5px] text-white/70 font-medium truncate">{userName || userEmail}</div>
          <div className="text-[10px] text-white/30">Comptable Pro</div>
        </div>
        <button onClick={signOut} className="text-white/30 hover:text-red-400 transition-colors ml-1">
          <LogOut size={13} />
        </button>
      </div>
    </>
  );

  return (
    <>
      <Toaster position="top-right" toastOptions={{ style: { fontSize: "13px" } }} />
      <div className="flex flex-col h-screen overflow-hidden bg-[#FAFAF6]">

        {/* Gold top banner */}
        <div className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 h-[48px]"
          style={{ background: "rgb(141, 167, 193)" }}>
          <Link href="/comptable-pro"
            className="flex items-center gap-1.5 text-white/90 hover:text-white text-[12.5px] font-medium transition-colors">
            <ChevronLeft size={15} />
            <span className="hidden sm:inline">Retour au cabinet</span>
          </Link>

          <div className="flex items-center gap-2">
            <Building2 size={15} className="text-white/80" />
            <span className="text-white font-semibold text-[14px]">{dossier.raison_sociale}</span>
            {dossier.ice && (
              <span className="hidden md:inline text-[11px] text-white/70 bg-white/10 rounded px-1.5 py-0.5">
                ICE {dossier.ice}
              </span>
            )}
            {dossier.regime_tva && (
              <span className="hidden md:inline text-[11px] text-white/70 bg-white/10 rounded px-1.5 py-0.5 capitalize">
                TVA {dossier.regime_tva}
              </span>
            )}
          </div>

          {/* Mobile menu */}
          <button onClick={() => setDrawerOpen(true)} className="md:hidden text-white/80 hover:text-white p-1">
            <Menu size={20} />
          </button>
          <div className="hidden md:block w-[120px]" />
        </div>

        {/* Desktop sidebar (below banner) */}
        <aside className="hidden md:flex fixed top-[48px] left-0 bottom-0 w-[210px] flex-col z-20 bg-[#0D1526]">
          <SidebarContent />
        </aside>

        {/* Main content — fixed so height is always exactly viewport minus banner/sidebar */}
        <div className="fixed top-[48px] left-0 md:left-[210px] right-0 bottom-0 overflow-y-auto bg-[#FAFAF6] z-40">
          <div className="page-fade p-4 md:p-[24px_22px_18px] pb-[72px] md:pb-[18px]">
            {children}
          </div>
        </div>

        {/* Mobile drawer */}
        {drawerOpen && (
          <>
            <div
              className="md:hidden fixed inset-0 z-[60]"
              style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
              onClick={() => setDrawerOpen(false)}
            />
            <div className="md:hidden fixed top-0 left-0 h-full w-[260px] z-[70] flex flex-col bg-[#0D1526]">
              <div className="flex items-center justify-between px-4 h-[52px] border-b border-white/10 flex-shrink-0"
                style={{ background: "rgb(141, 167, 193)" }}>
                <span className="text-[13px] font-semibold text-white">{dossier.raison_sociale}</span>
                <button onClick={() => setDrawerOpen(false)} className="text-white/80 hover:text-white p-1">
                  <X size={18} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto flex flex-col">
                <SidebarContent />
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
