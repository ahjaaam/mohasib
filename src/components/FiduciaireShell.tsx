"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Toaster } from "react-hot-toast";
import {
  LayoutDashboard, Folder, FolderPlus, Receipt, Download,
  Banknote, Settings, LogOut, Calendar, Building2, X, Menu,
  ChevronLeft, Lock,
} from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import AccessRestricted from "@/components/AccessRestricted";
import PermissionBoundary from "@/components/PermissionBoundary";
import { type PlanEntitlements, type PlanFeature } from "@/lib/plan-features";
import { PlanEntitlementsProvider } from "@/hooks/usePlanEntitlements";
import { AccountOwnerProvider } from "@/hooks/useAccountOwner";

const NAV_GROUPS = [
  {
    group: "VUE GLOBALE",
    items: [
      { href: "/comptable-pro", icon: LayoutDashboard, label: "Vue d'ensemble", exact: true, permission: "dossier:read" },
      { href: "/comptable-pro/calendrier", icon: Calendar, label: "Calendrier comptable", exact: false, permission: "dossier:read" },
      { href: "/comptable-pro/inbox-global", icon: Receipt, label: "Inbox global", exact: false, permission: "document:read", feature: "inbox_global" as PlanFeature },
    ],
  },
  {
    group: "DOSSIERS CLIENTS",
    items: [
      { href: "/comptable-pro/dossiers", icon: Folder, label: "Tous les dossiers", exact: false, permission: "dossier:read" },
      { href: "/comptable-pro/dossiers/new", icon: FolderPlus, label: "+ Nouveau dossier", exact: true, permission: "settings:update" },
    ],
  },
  {
    group: "MASSE",
    items: [
      { href: "/comptable-pro/declarations", icon: Receipt, label: "Déclarations TVA", exact: false, permission: "tva_declaration:read", feature: "mass_declarations" as PlanFeature },
      { href: "/comptable-pro/exports", icon: Download, label: "Exports CGNC", exact: false, permission: "report:export", feature: "mass_declarations" as PlanFeature },
      { href: "/comptable-pro/paie", icon: Banknote, label: "Bulletins de paie", exact: false, permission: "bulletin_paie:read" },
    ],
  },
  {
    group: "PARAMÈTRES",
    items: [
      { href: "/comptable-pro/settings", icon: Settings, label: "Mon cabinet", exact: false, permission: "settings:update" },
    ],
  },
];

interface Props {
  children: React.ReactNode;
  userName?: string | null;
  userEmail?: string | null;
  cabinetName?: string | null;
  permissions?: string[] | null;
  roleLabel?: string | null;
  entitlements: PlanEntitlements;
  ownerId: string;
}

export default function FiduciaireShell({ children, userName, userEmail, cabinetName, permissions = null, roleLabel, entitlements, ownerId }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const isDossierWorkspace = /^\/comptable-pro\/dossiers\/[0-9a-f-]{36}/.test(pathname);
  const { can } = usePermissions(permissions);
  const allowed = (permission?: string) => !permission || can(...permission.split(":") as [string, string]);
  const entitled = (feature?: PlanFeature) => !feature || entitlements.features[feature];
  const currentItem = NAV_GROUPS.flatMap(group => group.items)
    .sort((a, b) => b.href.length - a.href.length)
    .find(item => item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`));
  const permissionAllowed = allowed(currentItem?.permission);
  const featureAllowed = entitled(currentItem?.feature);
  const pageAllowed = permissionAllowed && featureAllowed;

  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  // Dossier sub-routes have their own DossierShell — don't double-wrap
  // All hooks must run before this early return (Rules of Hooks)
  if (isDossierWorkspace) {
    return (
      <>
        <Toaster position="top-right" toastOptions={{ style: { fontSize: "13px" } }} />
        {children}
      </>
    );
  }

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    if (href === "/comptable-pro/dossiers") {
      return pathname === "/comptable-pro/dossiers" || (pathname.startsWith("/comptable-pro/dossiers/") && pathname !== "/comptable-pro/dossiers/new");
    }
    return pathname === href || pathname.startsWith(href + "/");
  }

  const initials = userName
    ? userName.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()
    : userEmail?.slice(0, 2).toUpperCase() ?? "U";

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/connexion");
    router.refresh();
  }

  const SidebarContent = () => (
    <>
      <div className="px-[18px] pt-5 pb-4 border-b border-white/[0.07]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#C8924A] flex items-center justify-center flex-shrink-0">
            <Building2 size={15} className="text-white" />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-white truncate leading-tight">
              {cabinetName || "Mon Cabinet"}
            </div>
            <div className="text-[10px] text-[#C8924A]/70 mt-0.5">Comptable Pro</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 py-2 overflow-y-auto">
        {NAV_GROUPS.map(({ group, items }) => (
          <div key={group}>
            <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "1.5px", color: "rgba(255,255,255,0.14)", padding: "14px 18px 6px" }}>
              {group}
            </div>
            {items.filter(item => entitled(item.feature)).map(({ href, icon: Icon, label, exact, permission }) => {
              const locked = !allowed(permission);
              return (
              <Link key={href} href={href}
                className={`flex items-center gap-2.5 px-[18px] py-[10px] text-[13px] transition-all border-r-2 ${
                  isActive(href, exact)
                    ? "text-[#C8924A] bg-[rgba(200,146,74,0.10)] border-[#C8924A]"
                    : locked
                      ? "text-white/25 hover:text-white/45 hover:bg-white/5 border-transparent"
                      : "text-white/50 hover:text-white/85 hover:bg-white/5 border-transparent"
                }`}>
                <Icon size={15} />
                {label}
                {locked && <Lock size={11} className="ml-auto opacity-70" />}
              </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-white/[0.07] px-[18px] py-[7px]">
        <Link href="/dashboard"
          className="flex items-center gap-2 px-0 py-[7px] text-[12px] transition-all text-white/25 hover:text-white/55">
          <ChevronLeft size={13} />
          Retour à Mohasib
        </Link>
      </div>

      <div className="px-[18px] py-3 border-t border-white/[0.07] flex items-center gap-2.5">
        <div className="w-[30px] h-[30px] rounded-full bg-[#C8924A] flex items-center justify-center text-[11px] font-bold text-[#0D1526] flex-shrink-0">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[12px] text-white/70 font-medium truncate">{userName || userEmail}</div>
          <div className="text-[10px] text-white/30">{roleLabel || "Comptable Pro"}</div>
        </div>
        <button onClick={signOut} className="text-white/30 hover:text-red-400 transition-colors ml-1">
          <LogOut size={14} />
        </button>
      </div>
    </>
  );

  return (
    <PlanEntitlementsProvider value={entitlements}>
      <AccountOwnerProvider ownerId={ownerId}>
      <Toaster position="top-right" toastOptions={{ style: { fontSize: "13px" } }} />
      <PermissionBoundary permissions={permissions}>
      <div className="flex h-screen overflow-hidden bg-[#FAFAF6]">

        {/* Desktop sidebar */}
        <aside className="hidden md:flex fixed top-0 left-0 h-full w-[210px] flex-col z-20 bg-[#0D1526]">
          <SidebarContent />
        </aside>

        {/* Main content */}
        <div className="flex flex-col flex-1 md:ml-[210px] min-w-0 h-screen overflow-hidden">
          <main className="flex-1 overflow-hidden flex flex-col">
            <div className="page-fade overflow-y-auto flex-1 pt-[68px] px-4 pb-[72px] md:p-[24px_22px_18px] md:pb-[18px]">
              {pageAllowed ? children : <AccessRestricted backHref="/comptable-pro" reason={featureAllowed ? "permission" : "plan"} />}
            </div>
          </main>
        </div>

        {/* Mobile top bar */}
        <div className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 h-[52px] bg-[#0D1526] border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#C8924A] flex items-center justify-center">
              <Building2 size={13} className="text-white" />
            </div>
            <span className="text-[13px] font-semibold text-white">{cabinetName || "Cabinet"}</span>
          </div>
          <button onClick={() => setDrawerOpen(true)} className="text-white/60 hover:text-white p-1">
            <Menu size={20} />
          </button>
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
              <div className="flex items-center justify-between px-4 h-[52px] border-b border-white/10 flex-shrink-0">
                <span className="text-[13px] font-semibold text-white">Navigation</span>
                <button onClick={() => setDrawerOpen(false)} className="text-white/40 hover:text-white p-1">
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
