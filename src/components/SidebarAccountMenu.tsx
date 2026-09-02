"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronRight, CircleHelp, LogOut, ScrollText, Settings, UserRound } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { usePlanEntitlements } from "@/hooks/usePlanEntitlements";

type Props = {
  collapsed: boolean;
  light?: boolean;
  userName?: string | null;
  userEmail?: string | null;
  settingsHref?: string;
  onSignOut: () => void | Promise<void>;
  onToggleSidebar: () => void;
};

export default function SidebarAccountMenu({
  collapsed,
  light = false,
  userName,
  userEmail,
  settingsHref = "/parametres",
  onSignOut,
  onToggleSidebar,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const { isOwner } = usePermissions();
  const entitlements = usePlanEntitlements();
  const displayName = userName || userEmail || "Utilisateur";

  useEffect(() => {
    if (!open) return;

    function closeOnPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={`relative flex-shrink-0 border-t px-2 pb-3 pt-2 ${light ? "border-black/[0.08]" : "border-white/[0.07]"}`}
    >
      <div className={`flex items-center ${collapsed ? "flex-col gap-1" : "gap-1"}`}>
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className={`flex min-w-0 items-center transition-colors ${
            collapsed ? "h-10 w-10 justify-center" : "flex-1 gap-2.5 px-2 py-2"
          } ${
            light
              ? "text-[#4F514C] hover:bg-black/[0.04]"
              : "text-white/80 hover:bg-white/[0.05] hover:text-white"
          }`}
          aria-label="Ouvrir le menu du profil"
          aria-expanded={open}
        >
          <span className={`flex flex-shrink-0 items-center justify-center rounded-full border ${
            collapsed ? "h-8 w-8" : "h-9 w-9"
          } ${
            light
              ? "border-[#D6D5CF] bg-[#F3F3EF] text-[#5F6672]"
              : "border-white/[0.14] bg-white/[0.07] text-white/80"
          }`}>
            <UserRound size={collapsed ? 16 : 17} strokeWidth={1.8} aria-hidden="true" />
          </span>

          {!collapsed && (
            <>
              <span className="min-w-0 flex-1 text-left">
                <span className="block truncate text-[12.5px] font-semibold">{displayName}</span>
                {userEmail && <span className={`mt-0.5 block truncate text-[10px] ${light ? "text-[#777E8B]" : "text-white/45"}`}>{userEmail}</span>}
              </span>
              <ChevronDown size={13} className={`flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onToggleSidebar}
          title={collapsed ? "Développer la navigation" : "Réduire la navigation"}
          aria-label={collapsed ? "Développer la navigation" : "Réduire la navigation"}
          className={`flex h-8 w-7 flex-shrink-0 items-center justify-center border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8924A] ${
            light
              ? "border-[#D8D2C2] bg-white text-[#5D584E] hover:bg-[#F7F7F7] hover:text-[#1A1A2E]"
              : "border-white/[0.12] bg-white/[0.04] text-white/70 hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
          }`}
        >
          {collapsed ? <ChevronRight size={13} strokeWidth={2.2} /> : <ChevronLeft size={13} strokeWidth={2.2} />}
        </button>
      </div>

      {open && (
        <div className={`absolute z-[70] w-[270px] border border-[#DADAD5] border-t-2 border-t-[#C8924A] bg-white p-2 text-[#303644] shadow-[0_18px_42px_rgba(13,21,38,0.18)] ${
          collapsed
            ? "bottom-3 left-[calc(100%+8px)]"
            : "bottom-[calc(100%+8px)] left-2"
        }`}>
          <div className="flex items-center gap-3 border-b border-[#ECECE8] px-2 py-2.5">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-[#D6D5CF] bg-[#F3F3EF] text-[#5F6672]">
              <UserRound size={17} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[12.5px] font-bold text-[#1A1A2E]">{displayName}</span>
              {userEmail && <span className="mt-0.5 block truncate text-[10.5px] text-[#777E8B]">{userEmail}</span>}
            </span>
          </div>

          <Link
            href={settingsHref}
            onClick={() => setOpen(false)}
            className="mt-1.5 flex items-center gap-2.5 px-2 py-2 text-[12.5px] transition-colors hover:bg-[#F4F3ED]"
          >
            <span className="flex h-7 w-7 items-center justify-center border border-[#E5E5E0] bg-[#FAFAF7] text-[#777E8B]">
              <Settings size={13} />
            </span>
            <span>
              <span className="block font-semibold">Paramètres</span>
              <span className="mt-0.5 block text-[9.5px] text-[#9297A0]">Profil, entreprise et préférences</span>
            </span>
          </Link>

          {isOwner && entitlements.plan !== "free" && (
            <Link
              href="/journal-audit"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-2 py-2 text-[12.5px] transition-colors hover:bg-[#F4F3ED]"
            >
              <span className="flex h-7 w-7 items-center justify-center border border-[#E5E5E0] bg-[#FAFAF7] text-[#777E8B]">
                <ScrollText size={13} />
              </span>
              <span>
                <span className="block font-semibold">Journal d&apos;audit</span>
                <span className="mt-0.5 block text-[9.5px] text-[#9297A0]">Activité et traçabilité du compte</span>
              </span>
            </Link>
          )}

          <Link
            href="/centre-aide"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-2 py-2 text-[12.5px] transition-colors hover:bg-[#F4F3ED]"
          >
            <span className="flex h-7 w-7 items-center justify-center border border-[#E5E5E0] bg-[#FAFAF7] text-[#777E8B]">
              <CircleHelp size={13} />
            </span>
            <span>
              <span className="block font-semibold">Centre d&apos;aide</span>
              <span className="mt-0.5 block text-[9.5px] text-[#9297A0]">Guides et assistance</span>
            </span>
          </Link>

          <div className="my-1 border-t border-[#ECECE8]" />
          <button
            type="button"
            onClick={() => void onSignOut()}
            className="flex w-full items-center gap-2.5 px-2 py-2 text-left text-[12px] text-[#B42318] transition-colors hover:bg-[#FFF1F0]"
          >
            <span className="flex h-7 w-7 items-center justify-center">
              <LogOut size={13} />
            </span>
            Se déconnecter
          </button>
        </div>
      )}
    </div>
  );
}
