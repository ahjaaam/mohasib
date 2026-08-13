"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Toaster } from "react-hot-toast";
import {
  LayoutDashboard, ChartNoAxesCombined, FileText, Users, ArrowLeftRight, PenLine, LayoutTemplate,
  Calculator, Download, BarChart2, UserRoundCog, Archive,
  Inbox, Building2, X, GitMerge, Lock,
  ReceiptText,
} from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import AccessRestricted from "@/components/AccessRestricted";
import PermissionBoundary from "@/components/PermissionBoundary";
import { type PlanEntitlements, type PlanFeature } from "@/lib/plan-features";
import { FEATURES } from "@/lib/features";
import { PlanEntitlementsProvider } from "@/hooks/usePlanEntitlements";
import { AccountOwnerProvider } from "@/hooks/useAccountOwner";
import AppTopBar from "@/components/AppTopBar";
import SidebarToggleButton from "@/components/SidebarToggleButton";
import SidebarLogo from "@/components/SidebarLogo";
import SidebarItemTooltip from "@/components/SidebarItemTooltip";

const SIDEBAR_BACKGROUND = "#111621";

const NAV_GROUPS = [
  {
    group: "ADMIN",
    items: [
      { slug: "dashboard",    icon: ChartNoAxesCombined, label: "Tableau de bord", permission: "report:read" },
      { slug: "inbox",        icon: Inbox,           label: "Achats", permission: "document:read" },
      { slug: "receipts",     icon: ReceiptText,     label: "Justificatifs", permission: "document:read" },
      { slug: "invoices",     icon: FileText,        label: "Factures clients", permission: "invoice:read" },
      { slug: "clients",      icon: Users,           label: "Clients", permission: "invoice:read" },
      { slug: "transactions", icon: ArrowLeftRight,  label: "Transactions", permission: "accounting:read" },
      { slug: "paie",         icon: UserRoundCog,    label: "La paie", permission: "bulletin_paie:read", feature: "paie" as PlanFeature },
      { slug: "archive",      icon: Archive,         label: "Archive", permission: "document:read" },
    ],
  },
  {
    group: "COMPTABILITÉ",
    items: [
      FEATURES.SAISIE_ENABLED
        ? { slug: "saisie", icon: PenLine, label: "Saisie comptable", permission: "accounting:read", feature: "saisie" as PlanFeature }
        : { slug: "ecritures", icon: LayoutTemplate, label: "Écritures", permission: "accounting:read" },
      ...(FEATURES.GRAND_LIVRE_ENABLED
        ? [{ slug: "grand-livre", icon: BarChart2, label: "Grand Livre", permission: "report:read" }]
        : []),
      { slug: "tva",         icon: Calculator, label: "Déclaration TVA", permission: "tva_declaration:read" },
      { slug: "export",      icon: Download,  label: "Export CGNC", permission: "report:export", feature: "export_fiduciaire" as PlanFeature },
      ...(FEATURES.BILAN_ENABLED
        ? [{ slug: "bilan", icon: BarChart2, label: "Bilan / CPC", permission: "report:read", feature: "bilan" as PlanFeature }]
        : []),
      { slug: "rapprochement", icon: GitMerge,       label: "Rapprochement", permission: "accounting:read", feature: "bank_import" as PlanFeature },
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
  userId?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  userCompany?: string | null;
  userAvatar?: string | null;
  permissions?: string[] | null;
  roleLabel?: string | null;
  isClientPortal?: boolean;
  entitlements: PlanEntitlements;
  ownerId: string;
  sidebarTheme?: "dark" | "cream";
}

export default function DossierShell({ children, dossier, dossiers = [dossier], userId, userName, userEmail, userCompany, userAvatar, permissions = null, roleLabel, isClientPortal = false, entitlements, ownerId, sidebarTheme = "cream" }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { can } = usePermissions(permissions);
  const allowed = (permission?: string) => !permission || can(...permission.split(":") as [string, string]);
  const entitled = (feature?: PlanFeature) => !feature || entitlements.features[feature];
  const lightSidebar = sidebarTheme === "cream";
  const sidebarBackground = lightSidebar ? "#FFF" : SIDEBAR_BACKGROUND;

  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  const base = `/comptable-pro/dossiers/${dossier.id}`;
  const currentSlug = pathname.split(`${base}/`)[1]?.split("/")[0];
  const currentGroup = NAV_GROUPS.find(group => group.items.some(item => item.slug === currentSlug));
  const currentItem = currentGroup?.items.find(item => item.slug === currentSlug);
  const permissionAllowed = allowed(currentItem?.permission);
  const featureAllowed = entitled(currentItem?.feature);
  const clientPortalBlocked = isClientPortal && currentGroup?.group === "COMPTABILITÉ";
  const pageAllowed = permissionAllowed && featureAllowed && !clientPortalBlocked;
  const topBarItems = NAV_GROUPS.flatMap(group => group.items)
    .filter(item => entitled(item.feature))
    .map(({ slug, icon, label }) => ({ href: `${base}/${slug}`, label, icon, keywords: `${label} navigation page` }));

  function isActive(slug: string) {
    const href = `${base}/${slug}`;
    return pathname === href || pathname.startsWith(href + "/");
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/connexion");
    router.refresh();
  }

  const SidebarContent = ({ compact = false }: { compact?: boolean } = {}) => (
    <>
      {/* Mohasib branding */}
      <div className={`h-16 flex-shrink-0 border-b flex items-center ${lightSidebar ? "border-black/[0.08]" : "border-white/[0.07]"} ${compact ? "justify-center px-0" : "px-[18px]"}`}>
        <SidebarLogo light={lightSidebar} compact={compact} />
      </div>

      <nav className="flex-1 py-2 overflow-y-auto">
        {NAV_GROUPS.map(({ group, items }) => (
          <div key={group}>
            {!compact && (
              <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "1.5px", color: lightSidebar ? "#9A9386" : "rgba(255,255,255,0.14)", padding: "14px 18px 6px" }}>
                {group}
              </div>
            )}
            {items.filter(item => entitled(item.feature)).map(({ slug, icon: Icon, label, permission }) => {
              const locked = !allowed(permission) || (isClientPortal && group === "COMPTABILITÉ");
              return (
              <SidebarItemTooltip key={slug} enabled={compact} label={label}>
                <Link href={`${base}/${slug}`} aria-label={compact ? label : undefined}
                  className={`flex items-center py-[9px] text-[13px] transition-all border-r-2 ${
                    compact ? "justify-center px-0" : "gap-2.5 px-[18px]"
                  } ${
                    isActive(slug)
                      ? "text-[#C8924A] bg-[rgba(200,146,74,0.10)] border-[#C8924A]"
                      : locked
                        ? lightSidebar
                          ? "text-[#1A1A2E]/25 hover:text-[#1A1A2E]/45 hover:bg-black/[0.04] border-transparent"
                          : "text-white/25 hover:text-white/45 hover:bg-white/5 border-transparent"
                        : lightSidebar
                          ? "text-[#5F5A50] hover:text-[#1A1A2E] hover:bg-black/[0.04] border-transparent"
                          : "text-white/50 hover:text-white/85 hover:bg-white/5 border-transparent"
                  }`}>
                  <Icon size={compact ? 18 : 15} />
                  {!compact && label}
                  {!compact && locked && <Lock size={11} className="ml-auto opacity-70" />}
                </Link>
              </SidebarItemTooltip>
              );
            })}
          </div>
        ))}
      </nav>
    </>
  );

  return (
    <PlanEntitlementsProvider value={entitlements}>
      <AccountOwnerProvider ownerId={ownerId}>
      <Toaster position="top-right" toastOptions={{ style: { fontSize: "13px" } }} />
      <PermissionBoundary permissions={permissions}>
      <div className="flex flex-col h-screen overflow-hidden bg-[#FAFAF6]" data-sidebar-theme={sidebarTheme}>

        {/* Sidebar + (search bar / content) column, side by side */}
        <div className="flex flex-1 min-h-0">
          {/* Desktop sidebar */}
          <aside
            className="hidden md:flex flex-col flex-shrink-0 relative transition-[width] duration-200 overflow-visible"
            style={{ width: sidebarCollapsed ? 56 : 210, background: sidebarBackground }}
          >
            <SidebarContent compact={sidebarCollapsed} />
            <SidebarToggleButton
              collapsed={sidebarCollapsed}
              onToggle={() => setSidebarCollapsed((collapsed) => !collapsed)}
              light={lightSidebar}
            />
          </aside>

          {/* Right column: search top bar + scrollable page content */}
          <div className="mohasib-main-column flex flex-col flex-1 min-w-0 overflow-hidden transition-[margin] duration-200">
            <AppTopBar
              items={topBarItems}
              userName={userName}
              userEmail={userEmail}
              userId={userId}
              avatarUrl={userAvatar}
              showBrand
              topBarTheme={sidebarTheme}
              workspaceLabel={dossier.raison_sociale}
              cabinetMenuItems={!isClientPortal ? [
                { href: "/dashboard", label: userCompany?.trim() || "Mon entreprise", icon: LayoutDashboard },
                ...dossiers.map((item) => ({
                  href: `/comptable-pro/dossiers/${item.id}/dashboard`,
                  label: item.raison_sociale,
                  icon: Building2,
                  active: item.id === dossier.id,
                })),
              ] : undefined}
              onOpenMobileMenu={() => setDrawerOpen(true)}
              onSignOut={signOut}
              settingsHref={`${base}/settings`}
              dossierId={dossier.id}
            />
            <div className="h-16 flex-shrink-0" aria-hidden="true" />
            <main className="flex-1 overflow-y-auto">
              <div className="page-fade p-4 md:p-[24px_22px_18px] pb-[72px] md:pb-[18px]">
                {pageAllowed ? children : <AccessRestricted backHref="/comptable-pro" reason={featureAllowed ? "permission" : "plan"} />}
              </div>
            </main>
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
              style={{ background: sidebarBackground }}
            >
              <div className={`flex items-center justify-between px-4 h-[52px] border-b flex-shrink-0 ${lightSidebar ? "border-black/10" : "border-white/10"}`}
                style={{ background: sidebarBackground }}>
                <span className={`truncate text-[13px] font-semibold ${lightSidebar ? "text-[#1A1A2E]" : "text-white"}`}>{dossier.raison_sociale}</span>
                <button onClick={() => setDrawerOpen(false)} className={`p-1 ${lightSidebar ? "text-[#6F695D] hover:text-[#1A1A2E]" : "text-white/80 hover:text-white"}`}>
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
