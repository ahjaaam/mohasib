"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  ArrowUpRight,
  BriefcaseBusiness,
  Building2,
  ChevronDown,
  CircleHelp,
  CornerDownRight,
  FileText,
  FolderOpen,
  Loader2,
  Lock,
  LogOut,
  Menu,
  Phone,
  Search,
  ScrollText,
  Settings,
  Sparkles,
  Truck,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import SupportTicketButton from "@/components/SupportTicketButton";
import GlobalPeriodSelector from "@/components/GlobalPeriodSelector";
import ChatInterface from "@/app/(app)/chat/ChatInterface";
import type { GlobalSearchKind, GlobalSearchResult } from "@/lib/global-search";
import { appUrl } from "@/lib/public-urls";
import { usePermissions } from "@/hooks/usePermissions";
import { usePlanEntitlements } from "@/hooks/usePlanEntitlements";
import SidebarLogo from "@/components/SidebarLogo";

export type TopBarSearchItem = {
  href: string;
  label: string;
  keywords?: string;
  icon: LucideIcon;
};

type Props = {
  items: TopBarSearchItem[];
  primaryNav?: Array<{ href: string; label: string; active?: boolean }>;
  userName?: string | null;
  userEmail?: string | null;
  userId?: string | null;
  avatarUrl?: string | null;
  settingsHref?: string;
  dossierId?: string;
  invoicingOnly?: boolean;
  showBrand?: boolean;
  topBarTheme?: "dark" | "cream";
  workspaceLabel?: string;
  cabinetMenuItems?: Array<{
    href: string;
    label: string;
    icon: LucideIcon;
    active?: boolean;
    locked?: boolean;
  }>;
  guestMode?: boolean;
  onOpenMobileMenu?: () => void;
  onSignOut: () => void | Promise<void>;
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

const SEARCH_KIND_META: Record<GlobalSearchKind, { label: string; icon: LucideIcon }> = {
  client: { label: "Clients", icon: Building2 },
  invoice: { label: "Factures", icon: FileText },
  supplier: { label: "Fournisseurs", icon: Truck },
  employee: { label: "Employés", icon: UserRound },
  transaction: { label: "Transactions", icon: ArrowLeftRight },
  document: { label: "Documents", icon: FolderOpen },
  dossier: { label: "Dossiers", icon: BriefcaseBusiness },
};

export default function AppTopBar({
  items,
  primaryNav = [],
  userName,
  userEmail,
  userId,
  avatarUrl,
  settingsHref = "/settings",
  dossierId,
  invoicingOnly = false,
  showBrand = false,
  topBarTheme = "cream",
  workspaceLabel = "Mon Cabinet",
  cabinetMenuItems = [],
  guestMode = false,
  onOpenMobileMenu,
  onSignOut,
}: Props) {
  const router = useRouter();
  const { isOwner } = usePermissions();
  const entitlements = usePlanEntitlements();
  const darkTopBar = topBarTheme === "dark";
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [cabinetMenuOpen, setCabinetMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [recordMatches, setRecordMatches] = useState<GlobalSearchResult[]>([]);
  const [recordSearchLoading, setRecordSearchLoading] = useState(false);
  const [recordSearchFailed, setRecordSearchFailed] = useState(false);
  const companyWorkspaceItem = cabinetMenuItems[0];
  const cabinetWorkspaceItems = cabinetMenuItems.slice(1);

  const matches = useMemo(() => {
    const normalizedQuery = normalize(query);
    if (!normalizedQuery) return [];

    return items
      .filter((item) => normalize(`${item.label} ${item.keywords ?? ""}`).includes(normalizedQuery))
      .slice(0, 6);
  }, [items, query]);

  const groupedRecordMatches = useMemo(() => {
    return recordMatches.reduce((groups, result) => {
      const current = groups.get(result.kind) ?? [];
      current.push(result);
      groups.set(result.kind, current);
      return groups;
    }, new Map<GlobalSearchKind, GlobalSearchResult[]>());
  }, [recordMatches]);

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      setRecordMatches([]);
      setRecordSearchLoading(false);
      setRecordSearchFailed(false);
      return;
    }

    const controller = new AbortController();
    setRecordMatches([]);
    setRecordSearchLoading(true);
    setRecordSearchFailed(false);

    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(trimmedQuery)}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Search failed");
        const payload = await response.json() as { results?: GlobalSearchResult[] };
        setRecordMatches(Array.isArray(payload.results) ? payload.results : []);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setRecordMatches([]);
          setRecordSearchFailed(true);
        }
      } finally {
        if (!controller.signal.aborted) setRecordSearchLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setSearchOpen(false);
        setCabinetMenuOpen(false);
        setProfileOpen(false);
      }
    }

    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setChatOpen(false);
        setCabinetMenuOpen(false);
        setProfileOpen(false);
        setSearchOpen(true);
        inputRef.current?.focus();
      }
      if (event.key === "Escape") {
        setChatOpen(false);
        setCabinetMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleShortcut);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleShortcut);
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("mohasib-chat-open", chatOpen);
    return () => document.documentElement.classList.remove("mohasib-chat-open");
  }, [chatOpen]);

  function openResult(href: string) {
    setSearchOpen(false);
    setQuery("");
    router.push(href);
  }

  return (
    <>
      <header
        ref={rootRef}
        className={`fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between gap-2 border-b px-2 transition-colors sm:gap-4 sm:px-4 md:px-6 ${
          darkTopBar
            ? "app-topbar--dark border-white/10 bg-[#111621]"
            : "border-[#E8E8E4] bg-white"
        }`}
      >
      <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-3">
        {showBrand && (
          <Link
            href="/dashboard"
            className={`flex-shrink-0 items-center ${
              guestMode
                ? "flex w-[120px]"
                : `hidden sm:flex ${cabinetMenuItems.length > 0 ? "w-7" : "w-20"}`
            }`}
            aria-label="Mohasib"
          >
            {guestMode ? (
              <Image
                src="/logo2.png"
                alt="Mohasib AI"
                width={132}
                height={32}
                className="h-auto w-[120px] object-contain"
                priority
              />
            ) : (
              <SidebarLogo light={!darkTopBar} compact color="#C8924A" />
            )}
          </Link>
        )}
        {cabinetMenuItems.length > 0 && (
          <div className="relative hidden flex-shrink-0 md:block">
            <button
              type="button"
              onClick={() => {
                setCabinetMenuOpen((open) => !open);
                setSearchOpen(false);
                setProfileOpen(false);
                setChatOpen(false);
              }}
              className={`app-topbar-workspace flex h-10 items-center gap-2 border px-3 text-[13px] font-semibold transition-colors ${
                cabinetMenuOpen
                  ? "border-[#C8924A] bg-[#F7F7F3] text-[#8A5E25]"
                  : "border-transparent bg-[#F7F7F3] text-[#4B5260] hover:text-[#8A5E25]"
              }`}
              aria-label={`Ouvrir le menu ${workspaceLabel}`}
              aria-expanded={cabinetMenuOpen}
            >
              <span>{workspaceLabel}</span>
              <ChevronDown size={13} className={`transition-transform ${cabinetMenuOpen ? "rotate-180" : ""}`} />
            </button>

            {cabinetMenuOpen && (
              <div className="absolute left-0 top-[calc(100%+12px)] w-[270px] border border-[#DADAD5] border-t-2 border-t-[#C8924A] bg-white p-2 shadow-[0_18px_42px_rgba(13,21,38,0.15)]">
                {companyWorkspaceItem && (() => {
                  const CompanyIcon = companyWorkspaceItem.icon;
                  return (
                    <Link
                      href={companyWorkspaceItem.href}
                      onClick={() => setCabinetMenuOpen(false)}
                      className={`flex items-center gap-2.5 px-2.5 py-2.5 text-[12.5px] font-semibold transition-colors ${
                        companyWorkspaceItem.active
                          ? "bg-[rgba(200,146,74,0.10)] font-semibold text-[#A56F2D]"
                          : "text-[#4F514C] hover:bg-[#F4F3ED] hover:text-[#1A1A2E]"
                      }`}
                    >
                      <CompanyIcon size={14} className="flex-shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{companyWorkspaceItem.label}</span>
                      <span className="flex-shrink-0 text-[9px] font-semibold uppercase tracking-[0.5px] text-[#9A9FA8]">Par défaut</span>
                    </Link>
                  );
                })()}

                {cabinetWorkspaceItems.length > 0 && (
                  <>
                    <div className="my-1.5 border-t border-[#ECECE8]" />
                    <div className="px-2.5 pb-1 pt-1 text-[11px] font-bold uppercase tracking-[0.7px] text-[#6F746C]">
                      Mon Cabinet
                    </div>
                    {cabinetWorkspaceItems.map(({ href, label, active, locked }) => (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setCabinetMenuOpen(false)}
                        className={`flex items-center gap-2 py-2 pl-5 pr-2.5 text-[12.5px] transition-colors ${
                          active
                            ? "bg-[rgba(200,146,74,0.10)] font-semibold text-[#A56F2D]"
                            : locked
                              ? "text-[#A8A8A2] hover:bg-[#F7F7F3]"
                              : "text-[#4F514C] hover:bg-[#F4F3ED] hover:text-[#1A1A2E]"
                        }`}
                      >
                        <CornerDownRight size={13} className="flex-shrink-0 text-[#A7AAA3]" />
                        <span className="min-w-0 flex-1 truncate">{label}</span>
                        {locked && <Lock size={11} className="flex-shrink-0" />}
                      </Link>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        )}
        {!guestMode && cabinetMenuItems.length > 0 && (
          <GlobalPeriodSelector
            align="left"
            onOpen={() => {
              setSearchOpen(false);
              setCabinetMenuOpen(false);
              setProfileOpen(false);
              setChatOpen(false);
            }}
          />
        )}
        {primaryNav.length > 0 && (
          <nav className="hidden h-16 flex-shrink-0 items-center md:flex" aria-label="Navigation principale">
            {primaryNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex h-full items-center border-b-2 px-4 text-[13px] font-semibold transition-colors ${
                  item.active
                    ? "border-[#C8924A] text-[#0D1526]"
                    : "border-transparent text-[#777E8B] hover:text-[#0D1526]"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}
        {onOpenMobileMenu && (
          <button
            type="button"
            onClick={onOpenMobileMenu}
            title="Ouvrir le menu"
            aria-label="Ouvrir le menu"
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center border border-transparent text-[#777E8B] transition-colors hover:border-[#E1E0DA] hover:bg-[#F5F4EF] hover:text-[#C8924A] md:hidden"
          >
            <Menu size={18} />
          </button>
        )}
        <div className="group relative min-w-0 flex-1 md:max-w-[560px]">
          <label htmlFor="app-global-search" className="sr-only">
            Rechercher dans Mohasib
          </label>
          <Search
            size={16}
            strokeWidth={1.8}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8A909B]"
          />
          <input
            ref={inputRef}
            id="app-global-search"
            type="search"
            value={query}
            onFocus={() => {
              setSearchOpen(true);
              setCabinetMenuOpen(false);
              setProfileOpen(false);
              setChatOpen(false);
            }}
            onChange={(event) => {
              setQuery(event.target.value);
              setSearchOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setSearchOpen(false);
                inputRef.current?.blur();
              }
              const firstHref = matches[0]?.href ?? recordMatches[0]?.href;
              if (event.key === "Enter" && firstHref) {
                event.preventDefault();
                openResult(firstHref);
              }
            }}
            placeholder="Rechercher…"
            autoComplete="off"
            className="h-10 w-full border border-transparent bg-[#F8F8F6] pl-10 pr-14 text-[13px] text-[#1A1A2E] outline-none transition-colors placeholder:text-[#9CA3AF] hover:bg-[#F4F4F1] focus:border-[#E4E3DD] focus:bg-[#F8F8F6]"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={searchOpen && query.trim().length > 0}
            aria-controls="app-global-search-results"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 border border-[#DDDCD6] bg-[#F7F7F4] px-1.5 py-0.5 text-[9px] font-semibold text-[#8A909B] sm:block">
            ⌘ K
          </span>

          {searchOpen && query.trim() && (
            <div
              id="app-global-search-results"
              className="absolute left-0 top-[calc(100%+10px)] max-h-[min(520px,calc(100vh-96px))] w-[min(620px,calc(100vw-32px))] overflow-y-auto border border-[#DADAD5] border-t-2 border-t-[#C8924A] bg-white p-2 shadow-[0_18px_42px_rgba(13,21,38,0.15)]"
            >
              {matches.length > 0 && (
                <div className="mb-1">
                  <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-[0.9px] text-[#9A9FA8]">
                    Navigation
                  </div>
                  {matches.map(({ href, label, icon: Icon }) => (
                    <button
                      key={href}
                      type="button"
                      onClick={() => openResult(href)}
                      className="group/result flex w-full items-center gap-2.5 px-2 py-1.5 text-left text-[12.5px] text-[#303644] transition-colors hover:bg-[#F4F3ED]"
                    >
                      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center border border-[#E5E5E0] bg-[#FAFAF7] text-[#777E8B] transition-colors group-hover/result:border-[#D8C19D] group-hover/result:text-[#C8924A]">
                        <Icon size={13} />
                      </span>
                      <span className="min-w-0 flex-1 truncate">{label}</span>
                      <ArrowUpRight size={12} className="text-[#B0B4BB] transition-colors group-hover/result:text-[#C8924A]" />
                    </button>
                  ))}
                </div>
              )}

              {Array.from(groupedRecordMatches.entries()).map(([kind, results]) => {
                const { label: groupLabel, icon: Icon } = SEARCH_KIND_META[kind];
                return (
                  <div key={kind} className="mb-1 border-t border-[#EFEFEA] pt-1 first:border-t-0">
                    <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-[0.9px] text-[#9A9FA8]">
                      {groupLabel}
                    </div>
                    {results.map((result) => (
                      <button
                        key={`${result.kind}-${result.id}`}
                        type="button"
                        onClick={() => openResult(result.href)}
                        className="group/result flex w-full items-center gap-2.5 px-2 py-2 text-left transition-colors hover:bg-[#F4F3ED]"
                      >
                        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center border border-[#E5E5E0] bg-[#FAFAF7] text-[#777E8B] transition-colors group-hover/result:border-[#D8C19D] group-hover/result:text-[#C8924A]">
                          <Icon size={14} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12.5px] font-medium text-[#303644]">{result.label}</span>
                          <span className="block truncate text-[10.5px] text-[#8A909B]">{result.description}</span>
                        </span>
                        <ArrowUpRight size={12} className="flex-shrink-0 text-[#B0B4BB] transition-colors group-hover/result:text-[#C8924A]" />
                      </button>
                    ))}
                  </div>
                );
              })}

              {recordSearchLoading && (
                <div className="flex items-center justify-center gap-2 border-t border-[#EFEFEA] px-3 py-3 text-[11.5px] text-[#8A909B]">
                  <Loader2 size={13} className="animate-spin text-[#C8924A]" />
                  Recherche dans vos données…
                </div>
              )}

              {!recordSearchLoading && recordSearchFailed && (
                <div className="border-t border-[#EFEFEA] px-3 py-3 text-center text-[11.5px] text-[#8A909B]">
                  La recherche dans les données est momentanément indisponible.
                </div>
              )}

              {!recordSearchLoading && !recordSearchFailed && matches.length === 0 && recordMatches.length === 0 && (
                query.trim().length < 2 ? (
                  <div className="px-3 py-4 text-center text-[11.5px] text-[#8A909B]">
                    Saisissez au moins 2 caractères.
                  </div>
                ) : (
                  <div className="px-3 py-4 text-center text-[11.5px] text-[#8A909B]">
                    Aucun résultat pour « {query.trim()} »
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-shrink-0 items-center gap-1">
        {userId && (
          <NotificationBell
            userId={userId}
            onOpen={() => {
              setSearchOpen(false);
              setCabinetMenuOpen(false);
              setProfileOpen(false);
              setChatOpen(false);
            }}
          />
        )}

        {userId && <SupportTicketButton dossierId={dossierId} />}

        {!guestMode && cabinetMenuItems.length === 0 && (
          <GlobalPeriodSelector onOpen={() => {
            setSearchOpen(false);
            setCabinetMenuOpen(false);
            setProfileOpen(false);
            setChatOpen(false);
          }} />
        )}

        {!invoicingOnly && <button
          type="button"
          onClick={() => {
            setChatOpen((open) => !open);
            setSearchOpen(false);
            setCabinetMenuOpen(false);
            setProfileOpen(false);
          }}
          title="Mohasib Agent"
          aria-label="Ouvrir Mohasib Agent"
          aria-expanded={chatOpen}
          aria-controls="mohasib-chat-dock"
          className={`hidden h-10 w-10 items-center justify-center border text-[#C8924A] transition-colors sm:flex ${
            chatOpen
              ? "border-[#C8924A] bg-[rgba(200,146,74,0.16)]"
              : "border-transparent bg-[rgba(200,146,74,0.08)] hover:border-[#D8C19D] hover:bg-[rgba(200,146,74,0.14)]"
          }`}
        >
          <Sparkles size={16} />
        </button>}

        {guestMode ? (
          <>
            <a
              href="tel:+212670101952"
              className="inline-flex h-11 flex-shrink-0 items-center justify-center gap-[7px] text-[13px] font-semibold text-[#0D1526] transition-colors hover:text-[#C8924A] focus-visible:text-[#C8924A]"
              aria-label="Appeler le 06 70 10 19 52"
            >
              <Phone size={16} aria-hidden="true" />
              <span className="hidden lg:inline">06 70 10 19 52</span>
            </a>
            <Link
              href={appUrl("/connexion")}
              className="ml-1 inline-flex h-11 flex-shrink-0 items-center justify-center gap-[7px] text-[14px] font-semibold text-[#0D1526] transition-colors hover:text-[#976224] focus-visible:text-[#976224] sm:ml-3"
            >
              <Lock size={15} aria-hidden="true" />
              Se connecter
            </Link>
          </>
        ) : <div className="relative ml-0.5 flex-shrink-0 border-l border-[#E6E6E1] pl-1.5 sm:ml-2 sm:pl-3">
          <button
            type="button"
            onClick={() => {
              setProfileOpen((open) => !open);
              setSearchOpen(false);
              setCabinetMenuOpen(false);
              setChatOpen(false);
            }}
            className="flex h-10 w-10 items-center justify-center transition-colors hover:bg-[#F5F4EF]"
            aria-label="Ouvrir le menu du profil"
            aria-expanded={profileOpen}
          >
            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-[#D6D5CF] bg-[#F3F3EF] text-[#5F6672]">
              <UserRound size={16} strokeWidth={1.8} aria-hidden="true" />
            </span>
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-[calc(100%+9px)] w-[270px] border border-[#DADAD5] border-t-2 border-t-[#C8924A] bg-white p-2 shadow-[0_18px_42px_rgba(13,21,38,0.15)]">
              <div className="flex items-center gap-3 border-b border-[#ECECE8] px-2 py-2.5">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-[#D6D5CF] bg-[#F3F3EF] text-[#5F6672]">
                  <UserRound size={17} strokeWidth={1.8} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[12.5px] font-bold text-[#1A1A2E]">{userName || userEmail || "Utilisateur"}</span>
                  {userEmail && <span className="mt-0.5 block truncate text-[10.5px] text-[#777E8B]">{userEmail}</span>}
                </span>
              </div>
              <Link
                href={settingsHref}
                onClick={() => setProfileOpen(false)}
                className="mt-1.5 flex items-center gap-2.5 px-2 py-2 text-[12.5px] text-[#303644] transition-colors hover:bg-[#F4F3ED]"
              >
                <span className="flex h-7 w-7 items-center justify-center border border-[#E5E5E0] bg-[#FAFAF7] text-[#777E8B]">
                  <Settings size={13} />
                </span>
                <span>
                  <span className="block font-semibold">Paramètres</span>
                  <span className="mt-0.5 block text-[9.5px] text-[#9297A0]">Profil, entreprise et préférences</span>
                </span>
              </Link>
              {isOwner && entitlements.plan !== "free" && <Link
                href="/journal-audit"
                onClick={() => setProfileOpen(false)}
                className="flex items-center gap-2.5 px-2 py-2 text-[12.5px] text-[#303644] transition-colors hover:bg-[#F4F3ED]"
              >
                <span className="flex h-7 w-7 items-center justify-center border border-[#E5E5E0] bg-[#FAFAF7] text-[#777E8B]">
                  <ScrollText size={13} />
                </span>
                <span>
                  <span className="block font-semibold">Journal d&apos;audit</span>
                  <span className="mt-0.5 block text-[9.5px] text-[#9297A0]">Activité et traçabilité du compte</span>
                </span>
              </Link>}
              <Link
                href="/centre-aide"
                onClick={() => setProfileOpen(false)}
                className="flex items-center gap-2.5 px-2 py-2 text-[12.5px] text-[#303644] transition-colors hover:bg-[#F4F3ED]"
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
        </div>}
      </div>
      </header>

      {!invoicingOnly && chatOpen && (
        <div
          id="mohasib-chat-dock"
          role="dialog"
          aria-label="Mohasib Agent"
          className="fixed bottom-[calc(56px+env(safe-area-inset-bottom))] right-0 top-16 z-[80] w-full overflow-hidden border-l border-[#D5D4CE] bg-white shadow-[-12px_0_32px_rgba(13,21,38,0.12)] sm:w-[400px] md:bottom-0"
        >
          <ChatInterface
            mode="dock"
            onClose={() => setChatOpen(false)}
            dossierId={dossierId}
            userName={userName}
            avatarUrl={avatarUrl}
          />
        </div>
      )}
    </>
  );
}
