"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  ArrowUpRight,
  BriefcaseBusiness,
  Building2,
  CircleHelp,
  FileText,
  FolderOpen,
  Loader2,
  LogOut,
  Menu,
  Search,
  Settings,
  Sparkles,
  Truck,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import SupportTicketButton from "@/components/SupportTicketButton";
import ChatInterface from "@/app/(app)/chat/ChatInterface";
import type { GlobalSearchKind, GlobalSearchResult } from "@/lib/global-search";

export type TopBarSearchItem = {
  href: string;
  label: string;
  keywords?: string;
  icon: LucideIcon;
};

type Props = {
  items: TopBarSearchItem[];
  userName?: string | null;
  userEmail?: string | null;
  userId?: string | null;
  avatarUrl?: string | null;
  settingsHref?: string;
  dossierId?: string;
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
  userName,
  userEmail,
  userId,
  avatarUrl,
  settingsHref = "/settings",
  dossierId,
  onOpenMobileMenu,
  onSignOut,
}: Props) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [recordMatches, setRecordMatches] = useState<GlobalSearchResult[]>([]);
  const [recordSearchLoading, setRecordSearchLoading] = useState(false);
  const [recordSearchFailed, setRecordSearchFailed] = useState(false);

  const initials = userName
    ? userName.split(" ").slice(0, 2).map((word) => word[0]).join("").toUpperCase()
    : userEmail?.slice(0, 2).toUpperCase() ?? "U";

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
        setProfileOpen(false);
      }
    }

    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setChatOpen(false);
        setProfileOpen(false);
        setSearchOpen(true);
        inputRef.current?.focus();
      }
      if (event.key === "Escape") {
        setChatOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleShortcut);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleShortcut);
    };
  }, []);

  function openResult(href: string) {
    setSearchOpen(false);
    setQuery("");
    router.push(href);
  }

  return (
    <>
      <header
        ref={rootRef}
        className="relative z-40 flex h-16 flex-shrink-0 items-center justify-between gap-2 border-b border-[#E5E5E1] bg-[#FCFCFA] px-2 sm:gap-4 sm:px-4 md:px-6"
      >
      <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-3">
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
        <div className="group relative min-w-0 flex-1 md:max-w-[520px]">
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
            className="h-10 w-full border border-transparent bg-[#F7F7F3] pl-10 pr-14 text-[13px] text-[#1A1A2E] outline-none transition-colors placeholder:text-[#9CA3AF] hover:bg-[#F7F7F3] focus:border-transparent focus:bg-[#F7F7F3]"
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
              setProfileOpen(false);
              setChatOpen(false);
            }}
          />
        )}

        {userId && <SupportTicketButton dossierId={dossierId} />}

        <button
          type="button"
          onClick={() => {
            setChatOpen((open) => !open);
            setSearchOpen(false);
            setProfileOpen(false);
          }}
          title="Mohasib Chat"
          aria-label="Ouvrir Mohasib Chat"
          aria-expanded={chatOpen}
          aria-controls="mohasib-chat-dock"
          className={`hidden h-10 w-10 items-center justify-center border text-[#C8924A] transition-colors sm:flex ${
            chatOpen
              ? "border-[#C8924A] bg-[rgba(200,146,74,0.16)]"
              : "border-transparent bg-[rgba(200,146,74,0.08)] hover:border-[#D8C19D] hover:bg-[rgba(200,146,74,0.14)]"
          }`}
        >
          <Sparkles size={16} />
        </button>

        <div className="relative ml-0.5 flex-shrink-0 border-l border-[#E6E6E1] pl-1.5 sm:ml-2 sm:pl-3">
          <button
            type="button"
            onClick={() => {
              setProfileOpen((open) => !open);
              setSearchOpen(false);
              setChatOpen(false);
            }}
            className="flex h-10 w-10 items-center justify-center transition-colors hover:bg-[#F5F4EF]"
            aria-label="Ouvrir le menu du profil"
            aria-expanded={profileOpen}
          >
            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#D6D5CF] bg-[#EAE5DA] text-[10.5px] font-bold text-[#0D1526]">
              {avatarUrl ? (
                <span
                  className="h-full w-full rounded-full bg-cover bg-center"
                  style={{ backgroundImage: `url("${avatarUrl}")` }}
                  aria-hidden="true"
                />
              ) : (
                initials
              )}
            </span>
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-[calc(100%+9px)] w-[270px] border border-[#DADAD5] border-t-2 border-t-[#C8924A] bg-white p-2 shadow-[0_18px_42px_rgba(13,21,38,0.15)]">
              <div className="flex items-center gap-3 border-b border-[#ECECE8] px-2 py-2.5">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#D6D5CF] bg-[#EAE5DA] text-[11px] font-bold text-[#0D1526]">
                  {avatarUrl ? (
                    <span
                      className="h-full w-full rounded-full bg-cover bg-center"
                      style={{ backgroundImage: `url("${avatarUrl}")` }}
                      aria-hidden="true"
                    />
                  ) : (
                    initials
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[12.5px] font-bold text-[#1A1A2E]">{userName || userEmail || "Utilisateur"}</span>
                  {userEmail && <span className="mt-0.5 block truncate text-[10.5px] text-[#777E8B]">{userEmail}</span>}
                </span>
              </div>
              <Link
                href={settingsHref}
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
        </div>
      </div>
      </header>

      {chatOpen && (
        <div
          id="mohasib-chat-dock"
          role="dialog"
          aria-label="Mohasib Chat"
          className="fixed bottom-[68px] right-3 z-[80] h-[calc(100vh-148px)] w-[calc(100vw-24px)] overflow-hidden border border-[#D5D4CE] border-t-2 border-t-[#C8924A] bg-white shadow-[0_20px_55px_rgba(13,21,38,0.22)] md:bottom-5 md:right-5 md:h-[560px] md:max-h-[calc(100vh-88px)] md:min-h-[380px] md:w-[390px]"
        >
          <ChatInterface mode="dock" onClose={() => setChatOpen(false)} dossierId={dossierId} />
        </div>
      )}
    </>
  );
}
