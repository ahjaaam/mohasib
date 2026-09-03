"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Toaster } from "react-hot-toast";
import {
  LayoutDashboard, ChartNoAxesCombined, FileText, Users, ArrowLeftRight, PenLine, Scale,
  Calculator, Download, UserRoundCog, FolderOpen, BarChart2,
  Inbox, Building2, GitMerge, Lock, Menu, CreditCard, LogOut,
  ReceiptText, Landmark,
} from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import AccessRestricted from "@/components/AccessRestricted";
import PermissionBoundary from "@/components/PermissionBoundary";
import { type PlanEntitlements, type PlanFeature } from "@/lib/plan-features";
import { FEATURES } from "@/lib/features";
import { PlanEntitlementsProvider } from "@/hooks/usePlanEntitlements";
import { AccountOwnerProvider } from "@/hooks/useAccountOwner";
import AppTopBar from "@/components/AppTopBar";
import SidebarLogo from "@/components/SidebarLogo";
import SidebarItemTooltip from "@/components/SidebarItemTooltip";
import SidebarAccountMenu from "@/components/SidebarAccountMenu";
import { useSidebarCollapsed } from "@/hooks/useSidebarCollapsed";

const SIDEBAR_BACKGROUND = "#111621";
const CLIENT_PORTAL_BLOCKED_SLUGS = ["tresorerie", "transactions", "rapprochement", "saisie", "ecritures", "grand-livre", "tva", "bilan", "export-fiduciaire"];

// Keep dossier workspaces aligned with the default account navigation. Pages are
// shared wherever possible; only the dossier-prefixed href changes.
const NAV_ITEMS = [
  { slug: "tableau-de-bord", icon: ChartNoAxesCombined, label: "Tableau de bord", permission: "report:read" },
  { slug: "achats", icon: Inbox, label: "Achats", permission: "document:read" },
  { slug: "notes-de-frais", icon: ReceiptText, label: "Notes de frais", permission: "document:read" },
  { slug: "factures", icon: FileText, label: "Factures", permission: "invoice:read" },
  { slug: "suivi-paiements", icon: CreditCard, label: "Suivi des échéances", permission: "invoice:read" },
  { slug: "clients", icon: Users, label: "Clients", permission: "invoice:read" },
  ...(FEATURES.TREASURY_ENABLED
    ? [{ slug: "tresorerie", icon: Landmark, label: "Trésorerie", permission: "report:read" }]
    : []),
  { slug: "transactions", icon: ArrowLeftRight, label: "Transactions", permission: "accounting:read" },
  ...(FEATURES.RAPPROCHEMENT_ENABLED
    ? [{ slug: "rapprochement", icon: GitMerge, label: "Rapprochement", permission: "accounting:read", feature: "bank_import" as PlanFeature }]
    : []),
  FEATURES.SAISIE_ENABLED
    ? { slug: "saisie", icon: PenLine, label: "Saisie comptable", permission: "accounting:read", feature: "saisie" as PlanFeature }
    : { slug: "ecritures", icon: Scale, label: "Écritures", permission: "accounting:read" },
  ...(FEATURES.GRAND_LIVRE_ENABLED
    ? [{ slug: "grand-livre", icon: BarChart2, label: "Grand Livre", permission: "report:read" }]
    : []),
  { slug: "tva", icon: Calculator, label: "Déclarations TVA", permission: "tva_declaration:read" },
  ...(FEATURES.BILAN_ENABLED
    ? [{ slug: "bilan", icon: BarChart2, label: "Bilan / CPC", permission: "report:read", feature: "bilan" as PlanFeature }]
    : []),
  { slug: "paie", icon: UserRoundCog, label: "La paie", permission: "bulletin_paie:read", feature: "paie" as PlanFeature },
  { slug: "export-fiduciaire", icon: Download, label: "Exports", permission: "report:export", feature: "export_fiduciaire" as PlanFeature },
  { slug: "archive", icon: FolderOpen, label: "Archive", permission: "document:read" },
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

export default function DossierShell({ children, dossier, dossiers = [dossier], userId, userName, userEmail, userCompany, userAvatar, permissions = null, roleLabel, isClientPortal = false, entitlements, ownerId, sidebarTheme = "dark" }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { collapsed: sidebarCollapsed, toggleCollapsed: toggleSidebarCollapsed } = useSidebarCollapsed();
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
  const currentItem = NAV_ITEMS.find(item => item.slug === currentSlug);
  const permissionAllowed = allowed(currentItem?.permission);
  const featureAllowed = entitled(currentItem?.feature);
  const clientPortalBlocked = isClientPortal && CLIENT_PORTAL_BLOCKED_SLUGS.includes(currentSlug ?? "");
  const pageAllowed = permissionAllowed && featureAllowed && !clientPortalBlocked;
  const topBarItems = NAV_ITEMS
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
        {NAV_ITEMS.filter(item => entitled(item.feature)).map(({ slug, icon: Icon, label, permission }) => {
              const locked = !allowed(permission) || (isClientPortal && CLIENT_PORTAL_BLOCKED_SLUGS.includes(slug));
              return (
              <SidebarItemTooltip key={slug} enabled={compact} label={label}>
                <Link href={`${base}/${slug}`} aria-label={compact ? label : undefined}
                  className={`sidebar-nav-item flex items-center py-[13px] text-[13px] transition-all ${
                    compact
                      ? "mx-2 justify-center px-0"
                      : "mx-2 gap-3 px-[10px]"
                  } ${
                    isActive(slug)
                      ? "sidebar-nav-item--active text-[#C8924A]"
                      : locked
                        ? lightSidebar
                          ? "text-[#1A1A2E]/25 hover:text-[#1A1A2E]/45"
                          : "text-white/35 hover:text-white/55"
                        : lightSidebar
                          ? "text-[#5F5A50] hover:text-[#1A1A2E]"
                          : "text-white/80 hover:text-white"
                  }`}>
                  <Icon size={compact ? 19 : 16} />
                  {!compact && label}
                  {!compact && locked && <Lock size={11} className="ml-auto opacity-70" />}
                </Link>
              </SidebarItemTooltip>
              );
            })}
      </nav>
      <SidebarAccountMenu
        collapsed={compact}
        light={lightSidebar}
        userName={userName}
        userEmail={userEmail}
        settingsHref={`${base}/parametres`}
        onSignOut={signOut}
        onToggleSidebar={toggleSidebarCollapsed}
      />
    </>
  );

  return (
    <PlanEntitlementsProvider value={entitlements}>
      <AccountOwnerProvider ownerId={ownerId}>
      <Toaster position="top-right" toastOptions={{ style: { fontSize: "13px" } }} />
      <PermissionBoundary permissions={permissions}>
      <div
        className={`mohasib-app flex h-screen overflow-hidden ${lightSidebar ? "bg-white" : "bg-[#111621]"}`}
        data-sidebar-theme={sidebarTheme}
      >

          {/* Desktop sidebar */}
          <aside
            className="hidden md:flex fixed top-0 left-0 h-full flex-col z-20 transition-[width] duration-200 overflow-visible"
            style={{ width: sidebarCollapsed ? 56 : 210, background: sidebarBackground }}
          >
            <SidebarContent compact={sidebarCollapsed} />
          </aside>

          {/* Right column: search top bar + scrollable page content */}
          <div className={`mohasib-main-column flex flex-col flex-1 min-w-0 h-screen overflow-hidden transition-[margin] duration-200 ${sidebarCollapsed ? "md:ml-[56px]" : "md:ml-[210px]"}`}>
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
                { href: "/tableau-de-bord", label: userCompany?.trim() || "Mon entreprise", icon: LayoutDashboard },
                ...dossiers.map((item) => ({
                  href: `/comptable-pro/dossiers/${item.id}/tableau-de-bord`,
                  label: item.raison_sociale,
                  icon: Building2,
                  active: item.id === dossier.id,
                })),
              ] : undefined}
              onOpenMobileMenu={() => setDrawerOpen(true)}
              onSignOut={signOut}
              settingsHref={`${base}/parametres`}
              dossierId={dossier.id}
            />
            <div className="h-16 flex-shrink-0" aria-hidden="true" />
            <main className="app-content-frame flex-1 overflow-hidden flex flex-col">
              <div className="app-content-surface flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="page-fade overflow-y-auto flex-1 p-4 md:p-[24px_22px_18px] pb-[calc(72px+env(safe-area-inset-bottom))] md:pb-[18px]">
                  {pageAllowed ? children : <AccessRestricted backHref="/comptable-pro" reason={featureAllowed ? "permission" : "plan"} />}
                </div>
              </div>
            </main>
          </div>

        <nav
          className="pwa-bottom-nav md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around"
          style={{ height: "calc(56px + env(safe-area-inset-bottom))", paddingBottom: "env(safe-area-inset-bottom)", background: SIDEBAR_BACKGROUND, borderTop: "1px solid rgba(255,255,255,0.1)" }}
        >
          {[
            { slug: "tableau-de-bord", icon: ChartNoAxesCombined, label: "Accueil", permission: "report:read" },
            { slug: "factures", icon: FileText, label: "Factures", permission: "invoice:read" },
            { slug: "archive", icon: Download, label: "Archive", permission: "document:read" },
          ].map(({ slug, icon: Icon, label, permission }) => (
            <Link key={slug} href={`${base}/${slug}`} className="relative flex flex-col items-center justify-center gap-[3px] flex-1 h-full"
              style={{ color: isActive(slug) ? "#C8924A" : allowed(permission) ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.22)" }}>
              <Icon size={19} />
              <span style={{ fontSize: 10, fontWeight: 500 }}>{label}</span>
              {!allowed(permission) && <Lock size={9} className="absolute right-[24%] top-2" />}
            </Link>
          ))}
          <button onClick={() => setDrawerOpen(true)} className="flex flex-col items-center justify-center gap-[3px] flex-1 h-full"
            style={{ background: "none", border: "none", color: drawerOpen ? "#C8924A" : "rgba(255,255,255,0.45)" }}>
            <Menu size={19} />
            <span style={{ fontSize: 10, fontWeight: 500 }}>Menu</span>
          </button>
        </nav>

        {/* Mobile menu — same bottom-sheet pattern as the default workspace. */}
        {drawerOpen && (
          <>
            <div
              className="md:hidden fixed inset-0 z-[60]"
              style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
              onClick={() => setDrawerOpen(false)}
            />
            <div
              className="md:hidden fixed bottom-0 left-0 right-0 z-[70] flex flex-col"
              style={{ background: SIDEBAR_BACKGROUND, borderRadius: "16px 16px 0 0", padding: "16px 0 calc(24px + env(safe-area-inset-bottom))", maxHeight: "80vh" }}
            >
              <div className="flex justify-center mb-3">
                <div className="h-1 w-8 rounded-full bg-white/20" />
              </div>
              <div className="overflow-y-auto">
                {NAV_ITEMS.filter(item => entitled(item.feature)).map(({ slug, icon: Icon, label, permission }) => {
                  const locked = !allowed(permission) || (isClientPortal && CLIENT_PORTAL_BLOCKED_SLUGS.includes(slug));
                  return (
                    <Link key={slug} href={`${base}/${slug}`} onClick={() => setDrawerOpen(false)}
                      className="flex items-center gap-3 px-5 py-3 transition-colors"
                      style={{ color: isActive(slug) ? "#C8924A" : locked ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.7)" }}>
                      <Icon size={16} />
                      <span className="text-[14px] font-medium">{label}</span>
                      {locked && <Lock size={11} className="ml-auto" />}
                    </Link>
                  );
                })}
                <div className="mx-5 my-2 h-px bg-white/[0.07]" />
                <button onClick={signOut} className="flex w-full items-center gap-3 px-5 py-3 text-white/40">
                  <LogOut size={16} />
                  <span className="text-[14px]">Se déconnecter</span>
                </button>
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
