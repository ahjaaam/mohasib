"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Toaster } from "react-hot-toast";
import {
  LayoutDashboard, FileText, Users, ArrowLeftRight,
  LogOut, Menu, Inbox, Download,
  Settings, Calculator, FolderOpen, BarChart2, Banknote, Briefcase, CreditCard, PenLine, LayoutTemplate,
  GitMerge, Lock, Calendar, ChevronDown,
} from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import AccessRestricted from "@/components/AccessRestricted";
import PermissionBoundary from "@/components/PermissionBoundary";
import { featureForPath, type PlanEntitlements, type PlanFeature } from "@/lib/plan-features";
import { FEATURES } from "@/lib/features";
import { TRIAL_LIMITS } from "@/lib/trial-limits";
import TrialLimitModal from "@/components/TrialLimitModal";
import { PlanEntitlementsProvider } from "@/hooks/usePlanEntitlements";
import { AccountOwnerProvider } from "@/hooks/useAccountOwner";
import AppTopBar from "@/components/AppTopBar";

const SIDEBAR_BACKGROUND = "linear-gradient(160deg, #1e2536 0%, #000000 100%)";

const NAV_MAIN = [
  { href: "/dashboard",    icon: LayoutDashboard, label: "Tableau de bord",    key: "dashboard", permission: "report:read" },
  { href: "/inbox",        icon: Inbox,           label: "Boîte de réception", key: "inbox", permission: "document:read" },
  { href: "/invoices",          icon: FileText,   label: "Factures",            key: "invoices", permission: "invoice:read" },
  { href: "/suivi-paiements",   icon: CreditCard, label: "Suivi des paiements", key: "suivi-paiements", permission: "invoice:read" },
  { href: "/clients",           icon: Users,      label: "Clients",             key: "clients", permission: "invoice:read" },
  { href: "/transactions", icon: ArrowLeftRight,  label: "Transactions",       key: "transactions", permission: "accounting:read" },
  { href: "/rapprochement", icon: GitMerge,       label: "Rapprochement",      key: "rapprochement", permission: "accounting:read", feature: "bank_import" as PlanFeature },
  FEATURES.SAISIE_ENABLED
    ? { href: "/saisie", icon: PenLine, label: "Saisie comptable", key: "saisie", permission: "accounting:read", feature: "saisie" as PlanFeature }
    : { href: "/ecritures", icon: LayoutTemplate, label: "Écritures", key: "ecritures", permission: "accounting:read" },
  { href: "/tva",          icon: Calculator,      label: "Déclarations TVA",   key: "tva", permission: "tva_declaration:read" },
  { href: "/paie",         icon: Banknote,        label: "La Paie",            key: "paie", permission: "bulletin_paie:read", feature: "paie" as PlanFeature },
  { href: "/export",       icon: Download,        label: "Exports",            key: "export", permission: "report:export", feature: "export_fiduciaire" as PlanFeature },
  { href: "/archive",      icon: FolderOpen,      label: "Archive",            key: "archive", permission: "document:read" },
];

const CABINET_NAV = [
  { href: "/comptable-pro", icon: LayoutDashboard, label: "Vue d'ensemble", exact: true, permission: "dossier:read" },
  { href: "/comptable-pro/calendrier", icon: Calendar, label: "Calendrier", exact: false, permission: "dossier:read" },
  { href: "/comptable-pro/exports", icon: Download, label: "Exports CGNC", exact: false, permission: "report:export", feature: "mass_declarations" as PlanFeature },
  { href: "/comptable-pro/settings", icon: Settings, label: "Mon cabinet", exact: false, permission: "settings:update" },
];

const NAV_SOON: typeof NAV_MAIN = [];

const ALL_NAV = [
  ...NAV_MAIN,
  ...NAV_SOON,
  { href: "/rapports", icon: BarChart2,     label: "Rapports",     key: "rapports", soon: true, permission: "report:read" },
  { href: "/settings", icon: Settings,      label: "Paramètres",   key: "settings", permission: "settings:update" },
];

interface Props {
  children: React.ReactNode;
  userId?: string | null;
  ownerId: string;
  userEmail?: string | null;
  userName?: string | null;
  userCompany?: string | null;
  userAvatar?: string | null;
  isFiduciaire?: boolean;
  permissions?: string[] | null;
  roleLabel?: string | null;
  accessScope?: string | null;
  accountState?: {
    subscription_status?: string | null;
    subscription_ends_at?: string | null;
    trial_ends_at?: string | null;
    is_suspended?: boolean | null;
    suspended_reason?: string | null;
    trial_invoices_used?: number | null;
    trial_ocr_used?: number | null;
    trial_documents_used?: number | null;
    trial_bank_statements_used?: number | null;
    trial_employees_used?: number | null;
    trial_tva_declarations_used?: number | null;
    trial_dossiers_used?: number | null;
    trial_clients_used?: number | null;
    trial_transactions_used?: number | null;
    trial_accounting_entries_used?: number | null;
    trial_rapprochement_sessions_used?: number | null;
    trial_rapprochement_matches_used?: number | null;
  } | null;
  entitlements: PlanEntitlements;
}

export default function AppShell({ children, userId, ownerId, userEmail, userName, userAvatar, isFiduciaire, permissions = null, accessScope, accountState, entitlements }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [referenceTime] = useState(() => Date.now());
  const pathname = usePathname();
  const [cabinetOpen, setCabinetOpen] = useState(pathname.startsWith("/comptable-pro"));
  useEffect(() => {
    if (pathname.startsWith("/comptable-pro")) setCabinetOpen(true);
  }, [pathname]);
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();
  const { can } = usePermissions(permissions);
  const allowed = (permission?: string) => !permission || can(...permission.split(":") as [string, string]);
  const entitled = (feature?: PlanFeature) => !feature || entitlements.features[feature];
  const normalizedPath = pathname
    .replace(/^\/tableau-de-bord/, "/dashboard")
    .replace(/^\/boite-de-reception/, "/inbox")
    .replace(/^\/factures/, "/invoices")
    .replace(/^\/declarations-tva/, "/tva")
    .replace(/^\/export-fiduciaire/, "/export")
    .replace(/^\/parametres/, "/settings");
  const currentNav = ALL_NAV.find(item => normalizedPath === item.href || normalizedPath.startsWith(`${item.href}/`));
  const currentFeature = featureForPath(pathname) ?? (currentNav && "feature" in currentNav ? currentNav.feature : undefined);
  const routePermission = /^\/invoices\/(?:new|devis\/new|avoir\/new)$/.test(normalizedPath) || /^\/invoices\/[^/]+\/edit$/.test(normalizedPath)
    ? "invoice:create"
    : currentNav?.permission;
  const permissionAllowed = normalizedPath.startsWith("/settings")
    ? allowed("settings:update") || allowed("settings:manage_team")
    : allowed(routePermission);
  const featureAllowed = entitled(currentFeature);
  const pageAllowed = permissionAllowed && featureAllowed;
  const topBarItems = ALL_NAV
    .filter((item: any) => !item.soon && allowed(item.permission) && entitled(item.feature))
    .map(({ href, label, icon }: any) => ({ href, label, icon, keywords: `${label} navigation page` }));

  useEffect(() => { setDrawerOpen(false); }, [pathname]);
  useEffect(() => {
    if (!searchParams.get("dossier_id")) {
      document.cookie = "active_dossier_id=; path=/; max-age=0";
    }
  }, [pathname, searchParams]);

  // Dossier sub-routes have their own DossierShell — don't double-wrap.
  // All hooks must run before this early return (Rules of Hooks).
  const isDossierWorkspace = /^\/comptable-pro\/dossiers\/[0-9a-f-]{36}/.test(pathname);
  if (isDossierWorkspace) {
    return (
      <>
        <Toaster position="top-right" toastOptions={{ style: { fontSize: "13px" } }} />
        {children}
      </>
    );
  }

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

  const trialDays = accountState?.trial_ends_at ? Math.ceil((new Date(accountState.trial_ends_at).getTime() - referenceTime) / 86400000) : null;
  const isTrial = accountState?.subscription_status === "trial";
  const trialSummary = accountState ? {
    invoices: Number(accountState.trial_invoices_used ?? 0),
    ocr: Number(accountState.trial_ocr_used ?? 0),
    bank: Number(accountState.trial_bank_statements_used ?? 0),
    clients: Number(accountState.trial_clients_used ?? 0),
    transactions: Number(accountState.trial_transactions_used ?? 0),
    entries: Number(accountState.trial_accounting_entries_used ?? 0),
    rapprochement: Number(accountState.trial_rapprochement_sessions_used ?? 0),
  } : null;

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
        {NAV_MAIN.filter(item => entitled(item.feature)).map(({ href, icon: Icon, label, permission }: any) => {
          const locked = !allowed(permission);
          return (
          <Link key={href} href={href} title={sidebarCollapsed ? label : undefined}
            className={`flex items-center py-[12px] text-[13px] transition-all border-r-2 ${
              sidebarCollapsed ? "justify-center px-0" : "gap-2.5 px-[18px]"
            } ${
              isActive(href)
                ? "text-[#C8924A] bg-[rgba(200,146,74,0.10)] border-[#C8924A]"
                : locked
                  ? "text-white/25 hover:text-white/45 hover:bg-white/5 border-transparent"
                  : "text-white/50 hover:text-white/85 hover:bg-white/5 border-transparent"
            }`}>
            <Icon size={sidebarCollapsed ? 18 : 15} />
            {!sidebarCollapsed && label}
            {!sidebarCollapsed && locked && <Lock size={11} className="ml-auto opacity-70" />}
          </Link>
          );
        })}

        {isFiduciaire && accessScope !== "business_only" && (
          sidebarCollapsed ? (
            <Link href="/comptable-pro" title="Mon Cabinet"
              className={`flex items-center justify-center py-[12px] text-[13px] transition-all border-r-2 ${
                pathname.startsWith("/comptable-pro")
                  ? "text-[#C8924A] bg-[rgba(200,146,74,0.10)] border-[#C8924A]"
                  : "text-white/50 hover:text-white/85 hover:bg-white/5 border-transparent"
              }`}>
              <Briefcase size={18} />
            </Link>
          ) : (
            <div>
              <button type="button" onClick={() => setCabinetOpen(v => !v)}
                className={`w-full flex items-center gap-2.5 px-[18px] py-[12px] text-[13px] transition-all border-r-2 ${
                  pathname.startsWith("/comptable-pro")
                    ? "text-[#C8924A] bg-[rgba(200,146,74,0.10)] border-[#C8924A]"
                    : "text-white/50 hover:text-white/85 hover:bg-white/5 border-transparent"
                }`}>
                <Briefcase size={15} />
                <span className="flex-1 text-left">Mon Cabinet</span>
                <ChevronDown size={13} className={`transition-transform ${cabinetOpen ? "rotate-180" : ""}`} />
              </button>

              {cabinetOpen && (
                <div className="pb-1">
                  {CABINET_NAV.filter(item => entitled(item.feature)).map(({ href, icon: Icon, label, permission, exact }) => {
                    const locked = !allowed(permission);
                    const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
                    return (
                      <Link key={href} href={href}
                        className={`flex items-center gap-2 pl-[38px] pr-[18px] py-[9px] text-[12.5px] transition-all border-r-2 ${
                          active
                            ? "text-[#C8924A] bg-[rgba(200,146,74,0.08)] border-[#C8924A]"
                            : locked
                              ? "text-white/20 hover:text-white/40 hover:bg-white/5 border-transparent"
                              : "text-white/40 hover:text-white/75 hover:bg-white/5 border-transparent"
                        }`}>
                        <Icon size={13} />
                        {label}
                        {locked && <Lock size={10} className="ml-auto opacity-70" />}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )
        )}
      </nav>

    </>
  );

  return (
    <PlanEntitlementsProvider value={entitlements}>
      <AccountOwnerProvider ownerId={ownerId}>
      <Toaster position="top-right" toastOptions={{ style: { fontSize: "13px" } }} />
      <TrialLimitModal />
      <PermissionBoundary permissions={permissions}>
      <div className="mohasib-app flex h-screen overflow-hidden bg-[#FAFAF6]">

        {/* Desktop sidebar */}
        <aside
          className="hidden md:flex fixed top-0 left-0 h-full flex-col z-20 transition-[width] duration-200 overflow-visible"
          style={{ width: sidebarCollapsed ? 56 : 210, background: SIDEBAR_BACKGROUND }}
        >
          <SidebarContent />
        </aside>

        {/* Main */}
        <div
          className={`flex flex-col flex-1 min-w-0 h-screen overflow-hidden transition-[margin] duration-200 ${
            sidebarCollapsed ? "md:ml-[56px]" : "md:ml-[210px]"
          }`}
        >
          <AppTopBar
            key={pathname}
            items={topBarItems}
            userName={userName}
            userEmail={userEmail}
            userId={userId}
            avatarUrl={userAvatar}
            sidebarCollapsed={sidebarCollapsed}
            onToggleSidebar={() => setSidebarCollapsed((collapsed) => !collapsed)}
            onSignOut={signOut}
          />

          {/* Page content */}
          <main className="flex-1 overflow-hidden flex flex-col">
            {accountState?.is_suspended && <div className="bg-red-700 px-4 py-2 text-center text-[11px] font-semibold text-white">Ce compte est suspendu. {accountState.suspended_reason || "Contactez le support Mohasib."}</div>}
            {!accountState?.is_suspended && accountState?.subscription_status === "grace" && <div className="bg-amber-100 px-4 py-2 text-center text-[11px] font-semibold text-amber-900">Votre abonnement est arrivé à échéance. Renouvelez-le pour conserver toutes les fonctionnalités.</div>}
            {!accountState?.is_suspended && accountState?.subscription_status === "expired" && <div className="bg-red-100 px-4 py-2 text-center text-[11px] font-semibold text-red-800">Votre abonnement a expiré. Les fonctionnalités premium sont en lecture seule.</div>}
            {!accountState?.is_suspended && isTrial && trialDays !== null && trialDays >= 0 && (
              <div className="bg-amber-100 px-4 py-2 text-center text-[11px] font-semibold text-amber-900">
                <span className="hidden sm:inline">
                  Essai gratuit — {trialDays} jour{trialDays > 1 ? "s" : ""} restant{trialDays > 1 ? "s" : ""} · Factures {trialSummary?.invoices ?? 0}/{TRIAL_LIMITS.invoices} · Clients {trialSummary?.clients ?? 0}/{TRIAL_LIMITS.clients} · Transactions {trialSummary?.transactions ?? 0}/{TRIAL_LIMITS.transactions} · Écritures {trialSummary?.entries ?? 0}/{TRIAL_LIMITS.accounting_entries} · Rapprochements {trialSummary?.rapprochement ?? 0}/{TRIAL_LIMITS.rapprochement_sessions} ·{" "}
                </span>
                <span className="sm:hidden">Essai · {trialDays}j restants · </span>
                <Link href="/tarifs" className="underline">Passer à un plan payant</Link>
              </div>
            )}
            <div className="page-fade overflow-y-auto flex-1 p-4 md:p-[24px_22px_18px] pb-[calc(72px+env(safe-area-inset-bottom))] md:pb-[18px]">{accountState?.is_suspended ? <AccessRestricted reason="suspended" /> : pageAllowed ? children : <AccessRestricted reason={featureAllowed ? "permission" : "plan"} />}</div>
          </main>
        </div>

        {/* ── MOBILE BOTTOM NAV ──────────────────────────────────────────────── */}
        <nav
          className="pwa-bottom-nav md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around"
          style={{
            height: "calc(56px + env(safe-area-inset-bottom))",
            paddingBottom: "env(safe-area-inset-bottom)",
            background: SIDEBAR_BACKGROUND,
            borderTop: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          {/* Accueil */}
          <Link href="/dashboard" className="relative flex flex-col items-center justify-center gap-[3px] flex-1 h-full"
            style={{ color: isActive("/dashboard") ? "#C8924A" : allowed("report:read") ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.22)" }}>
            <LayoutDashboard size={19} />
            <span style={{ fontSize: 10, fontWeight: 500 }}>Accueil</span>
            {!allowed("report:read") && <Lock size={9} className="absolute right-[24%] top-2" />}
          </Link>

          {/* Factures */}
          <Link href="/invoices" className="relative flex flex-col items-center justify-center gap-[3px] flex-1 h-full"
            style={{ color: isActive("/invoices") ? "#C8924A" : allowed("invoice:read") ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.22)" }}>
            <FileText size={19} />
            <span style={{ fontSize: 10, fontWeight: 500 }}>Factures</span>
            {!allowed("invoice:read") && <Lock size={9} className="absolute right-[24%] top-2" />}
          </Link>

          {/* Archive */}
          <Link href="/archive" className="relative flex flex-col items-center justify-center gap-[3px] flex-1 h-full"
            style={{ color: isActive("/archive") ? "#C8924A" : allowed("document:read") ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.22)" }}>
            <Download size={19} />
            <span style={{ fontSize: 10, fontWeight: 500 }}>Archive</span>
            {!allowed("document:read") && <Lock size={9} className="absolute right-[24%] top-2" />}
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
                background: SIDEBAR_BACKGROUND,
                borderRadius: "16px 16px 0 0",
                padding: "16px 0 calc(24px + env(safe-area-inset-bottom))",
                maxHeight: "80vh",
              }}
            >
              {/* Drag handle */}
              <div className="flex justify-center mb-3">
                <div style={{ width: 32, height: 4, borderRadius: 9999, backgroundColor: "rgba(255,255,255,0.2)" }} />
              </div>

              {/* Nav items */}
              <div className="overflow-y-auto">
                {NAV_MAIN.filter(item => entitled(item.feature)).map(({ href, icon: Icon, label, permission }: any) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setDrawerOpen(false)}
                    className="flex items-center gap-3 px-[20px] py-[12px] transition-colors"
                    style={{ color: isActive(href) ? "#C8924A" : allowed(permission) ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.28)" }}
                  >
                    <Icon size={16} />
                    <span style={{ fontSize: 14, fontWeight: 500 }}>{label}</span>
                    {!allowed(permission) && <Lock size={11} className="ml-auto" />}
                  </Link>
                ))}

                {/* Cabinet */}
                {isFiduciaire && accessScope !== "business_only" && (
                  <>
                    <div className="flex items-center gap-3 px-[20px] py-[12px]"
                      style={{ color: pathname.startsWith("/comptable-pro") ? "#C8924A" : "rgba(255,255,255,0.7)" }}>
                      <Briefcase size={16} />
                      <span style={{ fontSize: 14, fontWeight: 500 }}>Mon Cabinet</span>
                    </div>
                    {CABINET_NAV.filter(item => entitled(item.feature)).map(({ href, icon: Icon, label, permission, exact }) => {
                      const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
                      return (
                        <Link key={href} href={href} onClick={() => setDrawerOpen(false)}
                          className="flex items-center gap-3 pl-[44px] pr-[20px] py-[10px] transition-colors"
                          style={{ color: active ? "#C8924A" : allowed(permission) ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.25)" }}>
                          <Icon size={14} />
                          <span style={{ fontSize: 13 }}>{label}</span>
                          {!allowed(permission) && <Lock size={10} className="ml-auto" />}
                        </Link>
                      );
                    })}
                  </>
                )}

                {ALL_NAV.filter(item => item.href === "/rapports").map(({ href, icon: Icon, label, soon, permission }: any) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setDrawerOpen(false)}
                    className="flex items-center gap-3 px-[20px] py-[12px] transition-colors"
                    style={{ color: isActive(href) ? "#C8924A" : allowed(permission) ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.28)" }}
                  >
                    <Icon size={16} />
                    <span style={{ fontSize: 14, fontWeight: 500 }}>{label}</span>
                    {soon && (
                      <span className="badge" style={{ background: "rgba(200,146,74,0.15)", color: "#C8924A", fontSize: "9px", padding: "1px 6px", borderRadius: "20px", marginLeft: 4 }}>
                        Bientôt
                      </span>
                    )}
                    {!allowed(permission) && <Lock size={11} className="ml-auto" />}
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
      </PermissionBoundary>
      </AccountOwnerProvider>
    </PlanEntitlementsProvider>
  );
}
