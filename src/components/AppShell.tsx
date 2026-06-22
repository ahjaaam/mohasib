"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Toaster } from "react-hot-toast";
import {
  LayoutDashboard, FileText, Users, ArrowLeftRight,
  LogOut, Menu, Inbox, Download,
  Settings, Receipt, FolderOpen, BarChart2, Banknote, Briefcase, CreditCard, PenLine,
  ChevronLeft, ChevronRight, GitMerge, Lock,
} from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import AccessRestricted from "@/components/AccessRestricted";
import PermissionBoundary from "@/components/PermissionBoundary";
import { featureForPath, type PlanEntitlements, type PlanFeature } from "@/lib/plan-features";
import { TRIAL_LIMITS } from "@/lib/trial-limits";
import TrialLimitModal from "@/components/TrialLimitModal";
import { PlanEntitlementsProvider } from "@/hooks/usePlanEntitlements";
import { AccountOwnerProvider } from "@/hooks/useAccountOwner";

const NAV_MAIN = [
  { href: "/dashboard",    icon: LayoutDashboard, label: "Tableau de bord",    key: "dashboard", permission: "report:read" },
  { href: "/inbox",        icon: Inbox,           label: "Boîte de réception", key: "inbox", permission: "document:read" },
  { href: "/invoices",          icon: FileText,   label: "Factures",            key: "invoices", permission: "invoice:read" },
  { href: "/suivi-paiements",   icon: CreditCard, label: "Suivi des paiements", key: "suivi-paiements", permission: "invoice:read" },
  { href: "/clients",           icon: Users,      label: "Clients",             key: "clients", permission: "invoice:read" },
  { href: "/transactions", icon: ArrowLeftRight,  label: "Transactions",       key: "transactions", permission: "accounting:read" },
  { href: "/rapprochement", icon: GitMerge,       label: "Rapprochement",      key: "rapprochement", permission: "accounting:read", feature: "bank_import" as PlanFeature },
  { href: "/saisie",       icon: PenLine,         label: "Saisie comptable",   key: "saisie", permission: "accounting:read", feature: "saisie" as PlanFeature },
  { href: "/tva",          icon: Receipt,         label: "Déclarations TVA",   key: "tva", permission: "tva_declaration:read" },
  { href: "/paie",         icon: Banknote,        label: "La Paie",            key: "paie", permission: "bulletin_paie:read", feature: "paie" as PlanFeature },
  { href: "/export",       icon: Download,        label: "Exports",            key: "export", permission: "report:export", feature: "export_fiduciaire" as PlanFeature },
  { href: "/archive",      icon: FolderOpen,      label: "Archive",            key: "archive", permission: "document:read" },
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
  } | null;
  entitlements: PlanEntitlements;
}

export default function AppShell({ children, ownerId, userEmail, userName, userCompany, isFiduciaire, permissions = null, roleLabel, accessScope, accountState, entitlements }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const pathname = usePathname();
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

  useEffect(() => { setDrawerOpen(false); }, [pathname]);

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

  const trialDays = accountState?.trial_ends_at ? Math.ceil((new Date(accountState.trial_ends_at).getTime() - Date.now()) / 86400000) : null;
  const isTrial = accountState?.subscription_status === "trial";
  const trialSummary = accountState ? {
    invoices: Number(accountState.trial_invoices_used ?? 0),
    ocr: Number(accountState.trial_ocr_used ?? 0),
    bank: Number(accountState.trial_bank_statements_used ?? 0),
  } : null;

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
      </nav>

      {isFiduciaire && accessScope !== "business_only" && (
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
          } ${pathname === "/settings" ? "text-[#C8924A]" : allowed("settings:update") || allowed("settings:manage_team") ? "text-white/40 hover:text-white/75" : "text-white/25 hover:text-white/45"}`}>
          <Settings size={sidebarCollapsed ? 18 : 15} />
          {!sidebarCollapsed && "Paramètres"}
          {!sidebarCollapsed && !allowed("settings:update") && !allowed("settings:manage_team") && <Lock size={11} className="ml-auto opacity-70" />}
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
              {roleLabel && <div className="mt-1 text-[9px] font-semibold text-[#C8924A]">{roleLabel}</div>}
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
    <PlanEntitlementsProvider value={entitlements}>
      <AccountOwnerProvider ownerId={ownerId}>
      <Toaster position="top-right" toastOptions={{ style: { fontSize: "13px" } }} />
      <TrialLimitModal />
      <PermissionBoundary permissions={permissions}>
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
          className={`flex flex-col flex-1 min-w-0 h-screen overflow-hidden transition-[margin] duration-200 ${
            sidebarCollapsed ? "md:ml-[56px]" : "md:ml-[210px]"
          }`}
        >

          {/* Page content */}
          <main className="flex-1 overflow-hidden flex flex-col">
            {accountState?.is_suspended && <div className="bg-red-700 px-4 py-2 text-center text-[11px] font-semibold text-white">Ce compte est suspendu. {accountState.suspended_reason || "Contactez le support Mohasib."}</div>}
            {!accountState?.is_suspended && accountState?.subscription_status === "grace" && <div className="bg-amber-100 px-4 py-2 text-center text-[11px] font-semibold text-amber-900">Votre abonnement est arrivé à échéance. Renouvelez-le pour conserver toutes les fonctionnalités.</div>}
            {!accountState?.is_suspended && accountState?.subscription_status === "expired" && <div className="bg-red-100 px-4 py-2 text-center text-[11px] font-semibold text-red-800">Votre abonnement a expiré. Les fonctionnalités premium sont en lecture seule.</div>}
            {!accountState?.is_suspended && isTrial && trialDays !== null && trialDays >= 0 && (
              <div className="bg-amber-100 px-4 py-2 text-center text-[11px] font-semibold text-amber-900">
                <span className="hidden sm:inline">
                  Essai gratuit — {trialDays} jour{trialDays > 1 ? "s" : ""} restant{trialDays > 1 ? "s" : ""} · Factures {trialSummary?.invoices ?? 0}/{TRIAL_LIMITS.invoices} · Scans {trialSummary?.ocr ?? 0}/{TRIAL_LIMITS.ocr_scans} · Relevés {trialSummary?.bank ?? 0}/{TRIAL_LIMITS.bank_statements} ·{" "}
                </span>
                <span className="sm:hidden">Essai · {trialDays}j restants · </span>
                <Link href="/tarifs" className="underline">Passer à un plan payant</Link>
              </div>
            )}
            <div className="page-fade overflow-y-auto flex-1 p-4 md:p-[24px_22px_18px] pb-[72px] md:pb-[18px]">{accountState?.is_suspended ? <AccessRestricted reason="suspended" /> : pageAllowed ? children : <AccessRestricted reason={featureAllowed ? "permission" : "plan"} />}</div>
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
                {ALL_NAV.filter(item => entitled("feature" in item ? item.feature : undefined)).map(({ href, icon: Icon, label, soon, permission }: any) => (
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
                      <span style={{ background: "rgba(200,146,74,0.15)", color: "#C8924A", fontSize: "9px", padding: "1px 6px", borderRadius: "20px", marginLeft: 4 }}>
                        Bientôt
                      </span>
                    )}
                    {!allowed(permission) && <Lock size={11} className="ml-auto" />}
                  </Link>
                ))}

                {/* Fiduciaire */}
                {isFiduciaire && accessScope !== "business_only" && (
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
      </PermissionBoundary>
      </AccountOwnerProvider>
    </PlanEntitlementsProvider>
  );
}
