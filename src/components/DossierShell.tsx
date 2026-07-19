"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Toaster } from "react-hot-toast";
import {
  LayoutDashboard, FileText, Users, ArrowLeftRight, PenLine,
  Calculator, Download, BarChart2, Banknote, Archive,
  Inbox, ChevronLeft, ChevronRight, Building2, LogOut, X, Menu, ChevronDown, GitMerge, Lock,
} from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import AccessRestricted from "@/components/AccessRestricted";
import PermissionBoundary from "@/components/PermissionBoundary";
import { type PlanEntitlements, type PlanFeature } from "@/lib/plan-features";
import { PlanEntitlementsProvider } from "@/hooks/usePlanEntitlements";
import { AccountOwnerProvider } from "@/hooks/useAccountOwner";

const SIDEBAR_BACKGROUND =
  "radial-gradient(circle at 16% 20%, rgba(53, 58, 70, 0.68) 0%, rgba(39, 42, 51, 0.30) 38%, transparent 68%), linear-gradient(160deg, #282B34 0%, #222329 48%, #1A1717 100%)";

const NAV_GROUPS = [
  {
    group: "COMPTABILITÉ",
    items: [
      { slug: "dashboard",    icon: LayoutDashboard, label: "Tableau de bord", permission: "report:read" },
      { slug: "inbox",        icon: Inbox,           label: "Boîte de réception", permission: "document:read" },
      { slug: "invoices",     icon: FileText,        label: "Factures clients", permission: "invoice:read" },
      { slug: "clients",      icon: Users,           label: "Clients", permission: "invoice:read" },
      { slug: "transactions", icon: ArrowLeftRight,  label: "Transactions", permission: "accounting:read" },
      { slug: "rapprochement", icon: GitMerge,       label: "Rapprochement", permission: "accounting:read", feature: "bank_import" as PlanFeature },
      { slug: "saisie",       icon: PenLine,         label: "Saisie comptable", permission: "accounting:read", feature: "saisie" as PlanFeature },
      { slug: "paie",         icon: Banknote,        label: "Bulletins de paie", permission: "bulletin_paie:read", feature: "paie" as PlanFeature },
      { slug: "archive",      icon: Archive,         label: "Archive", permission: "document:read" },
    ],
  },
  {
    group: "FISCAL",
    items: [
      { slug: "tva",         icon: Calculator, label: "Déclaration TVA", permission: "tva_declaration:read" },
      { slug: "grand-livre", icon: BarChart2, label: "Grand Livre", permission: "report:read" },
      { slug: "export",      icon: Download,  label: "Export CGNC", permission: "report:export", feature: "export_fiduciaire" as PlanFeature },
      { slug: "bilan",       icon: BarChart2, label: "Bilan / CPC", permission: "report:read", feature: "bilan" as PlanFeature },
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
  dossiers?: DossierMeta[];
  userName?: string | null;
  userEmail?: string | null;
  permissions?: string[] | null;
  roleLabel?: string | null;
  entitlements: PlanEntitlements;
  ownerId: string;
}

export default function DossierShell({ children, dossier, dossiers = [dossier], userName, userEmail, permissions = null, roleLabel, entitlements, ownerId }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { can } = usePermissions(permissions);
  const allowed = (permission?: string) => !permission || can(...permission.split(":") as [string, string]);
  const entitled = (feature?: PlanFeature) => !feature || entitlements.features[feature];

  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  const base = `/comptable-pro/dossiers/${dossier.id}`;
  const navSlugs = NAV_GROUPS.flatMap((group) => group.items.map((item) => item.slug));
  const currentSlug = pathname.split(`${base}/`)[1]?.split("/")[0];
  const currentItem = NAV_GROUPS.flatMap(group => group.items).find(item => item.slug === currentSlug);
  const permissionAllowed = allowed(currentItem?.permission);
  const featureAllowed = entitled(currentItem?.feature);
  const pageAllowed = permissionAllowed && featureAllowed;

  function isActive(slug: string) {
    const href = `${base}/${slug}`;
    return pathname === href || pathname.startsWith(href + "/");
  }

  function getCurrentSection() {
    const [, section] = pathname.split(`${base}/`);
    const slug = section?.split("/")[0];
    return slug && navSlugs.includes(slug) ? slug : "dashboard";
  }

  function switchDossier(nextId: string) {
    if (!nextId || nextId === dossier.id) return;
    document.cookie = `active_dossier_id=${nextId}; path=/; max-age=7200`;
    router.push(`/comptable-pro/dossiers/${nextId}/${getCurrentSection()}`);
  }

  const userInitials = userName
    ? userName.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()
    : userEmail?.slice(0, 2).toUpperCase() ?? "U";

  const initials = dossier.raison_sociale
    .split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/connexion");
    router.refresh();
  }

  const DossierSwitcher = ({ compact = false }: { compact?: boolean }) => (
    <div className="relative flex items-center min-w-0 max-w-[360px]">
      <Building2 size={15} className="absolute left-2.5 text-white/80 pointer-events-none" />
      <select
        value={dossier.id}
        onChange={(event) => switchDossier(event.target.value)}
        aria-label="Changer de dossier"
        className={`appearance-none cursor-pointer bg-white/10 hover:bg-white/20 rounded-md text-white font-semibold outline-none transition-colors pl-8 pr-10 ${
          compact ? "max-w-[190px] text-[12.5px] py-1" : "max-w-[270px] md:max-w-[360px] text-[14px] py-1.5"
        }`}
      >
        {dossiers.map((item) => (
          <option key={item.id} value={item.id} className="text-[#1A1A2E]">
            {item.raison_sociale}
          </option>
        ))}
      </select>
      <ChevronDown size={18} strokeWidth={2.5} className="absolute right-2.5 text-white pointer-events-none" />
    </div>
  );

  const SidebarContent = ({ compact = false }: { compact?: boolean } = {}) => (
    <>
      {/* Dossier identity */}
      <div className={`pt-4 pb-3 border-b border-white/[0.07] ${compact ? "px-0" : "px-[18px]"}`}>
        <div className={`flex items-center ${compact ? "justify-center" : "gap-2.5"}`}>
          <div className="w-9 h-9 rounded-lg bg-[#C8924A] flex items-center justify-center flex-shrink-0 text-[13px] font-bold text-white">
            {initials}
          </div>
          {!compact && (
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-white truncate leading-tight">
                {dossier.raison_sociale}
              </div>
              {dossier.regime_tva && (
                <div className="text-[10px] text-[#C8924A]/70 mt-0.5 capitalize">TVA {dossier.regime_tva}</div>
              )}
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 py-2 overflow-y-auto">
        {NAV_GROUPS.map(({ group, items }) => (
          <div key={group}>
            {!compact && (
              <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "1.5px", color: "rgba(255,255,255,0.14)", padding: "14px 18px 6px" }}>
                {group}
              </div>
            )}
            {items.filter(item => entitled(item.feature)).map(({ slug, icon: Icon, label, permission }) => {
              const locked = !allowed(permission);
              return (
              <Link key={slug} href={`${base}/${slug}`} title={compact ? label : undefined}
                className={`flex items-center py-[9px] text-[12.5px] transition-all border-r-2 ${
                  compact ? "justify-center px-0" : "gap-2.5 px-[18px]"
                } ${
                  isActive(slug)
                    ? "text-[#C8924A] bg-[rgba(200,146,74,0.10)] border-[#C8924A]"
                    : locked
                      ? "text-white/25 hover:text-white/45 hover:bg-white/5 border-transparent"
                      : "text-white/50 hover:text-white/85 hover:bg-white/5 border-transparent"
                }`}>
                <Icon size={compact ? 18 : 14} />
                {!compact && label}
                {!compact && locked && <Lock size={11} className="ml-auto opacity-70" />}
              </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className={`py-3 border-t border-white/[0.07] flex items-center ${compact ? "justify-center px-0" : "px-[18px] gap-2.5"}`}>
        <div className="w-[28px] h-[28px] rounded-full bg-[#C8924A] flex items-center justify-center text-[10px] font-bold text-[#0D1526] flex-shrink-0">
          {userInitials}
        </div>
        {!compact && (
          <>
            <div className="min-w-0 flex-1">
              <div className="text-[11.5px] text-white/70 font-medium truncate">{userName || userEmail}</div>
              <div className="text-[10px] text-white/30">{roleLabel || "Comptable Pro"}</div>
            </div>
            <button onClick={signOut} className="text-white/30 hover:text-red-400 transition-colors ml-1">
              <LogOut size={13} />
            </button>
          </>
        )}
      </div>
    </>
  );

  return (
    <PlanEntitlementsProvider value={entitlements}>
      <AccountOwnerProvider ownerId={ownerId}>
      <Toaster position="top-right" toastOptions={{ style: { fontSize: "13px" } }} />
      <PermissionBoundary permissions={permissions}>
      <div className="flex flex-col h-screen overflow-hidden bg-[#FAFAF6]">

        {/* Dossier context banner */}
        <div className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 h-[48px]"
          style={{ backgroundColor: "rgb(138, 149, 160)" }}>
          <Link href="/comptable-pro"
            className="flex items-center gap-1.5 text-white/90 hover:text-white text-[12.5px] font-medium transition-colors">
            <ChevronLeft size={15} />
            <span className="hidden sm:inline">Retour au cabinet</span>
          </Link>

          <div className="flex items-center gap-2 min-w-0">
            <DossierSwitcher />
            {dossier.ice && (
              <span className="hidden md:inline text-[11px] text-white/70 bg-white/10 rounded px-1.5 py-0.5">
                ICE {dossier.ice}
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
        <aside
          className="hidden md:flex fixed top-[48px] left-0 bottom-0 flex-col z-50 transition-[width] duration-200 overflow-visible"
          style={{ width: sidebarCollapsed ? 56 : 210, background: SIDEBAR_BACKGROUND }}
        >
          <SidebarContent compact={sidebarCollapsed} />
          <button
            onClick={() => setSidebarCollapsed(v => !v)}
            title={sidebarCollapsed ? "Développer" : "Réduire"}
            className="absolute top-[42px] -right-[11px] w-[22px] h-[22px] rounded-full flex items-center justify-center transition-colors z-[70]"
            style={{
              background: "#1a2540",
              border: "1px solid rgba(255,255,255,0.14)",
              color: "rgba(255,255,255,0.45)",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.9)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.3)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.45)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.14)"; }}
          >
            {sidebarCollapsed ? <ChevronRight size={11} /> : <ChevronLeft size={11} />}
          </button>
        </aside>

        {/* Main content — fixed so height is always exactly viewport minus banner/sidebar */}
        <div
          className={`fixed top-[48px] left-0 right-0 bottom-0 overflow-y-auto bg-[#FAFAF6] z-40 transition-[left] duration-200 ${
            sidebarCollapsed ? "md:left-[56px]" : "md:left-[210px]"
          }`}
        >
          <div className="page-fade p-4 md:p-[24px_22px_18px] pb-[72px] md:pb-[18px]">
            {pageAllowed ? children : <AccessRestricted backHref="/comptable-pro" reason={featureAllowed ? "permission" : "plan"} />}
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
            <div
              className="md:hidden fixed top-0 left-0 h-full w-[260px] z-[70] flex flex-col"
              style={{ background: SIDEBAR_BACKGROUND }}
            >
              <div className="flex items-center justify-between px-4 h-[52px] border-b border-white/10 flex-shrink-0"
                style={{ backgroundColor: "rgb(138, 149, 160)" }}>
                <DossierSwitcher compact />
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
      </PermissionBoundary>
      </AccountOwnerProvider>
    </PlanEntitlementsProvider>
  );
}
