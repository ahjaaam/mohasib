"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { CheckCheck, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  markRead,
  markAllRead,
  dismissNotification,
  deleteReadNotifications,
  type Notification,
} from "@/lib/notifications/actions";

type Filter = "all" | "unread" | "high" | "archived";

const PAGE_SIZE = 20;

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 60) return `Il y a ${minutes || 1} min`;
  if (hours < 24) return `Il y a ${hours}h`;
  if (days < 7) return `Il y a ${days} jour${days > 1 ? "s" : ""}`;
  return new Date(dateStr).toLocaleDateString("fr-MA", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function NotificationsPage() {
  const [all, setAll] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const [, startTransition] = useTransition();
  const supabase = createClient();

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setAll((data ?? []) as Notification[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function handleMarkAllRead() {
    setAll((prev) => prev.map((n) => ({ ...n, is_read: true })));
    startTransition(() => { markAllRead(); });
  }

  function handleDismiss(id: string) {
    setAll((prev) => prev.map((n) => n.id === id ? { ...n, is_dismissed: true, is_read: true } : n));
    startTransition(() => { dismissNotification(id); });
  }

  function handleClick(n: Notification) {
    setAll((prev) => prev.map((x) => x.id === n.id ? { ...x, is_read: true } : x));
    startTransition(() => { markRead(n.id); });
  }

  async function handleDeleteRead() {
    setAll((prev) => prev.filter((n) => !n.is_read));
    await deleteReadNotifications();
  }

  const filtered = all.filter((n) => {
    if (filter === "unread") return !n.is_read && !n.is_dismissed;
    if (filter === "high") return n.priority === "high" && !n.is_dismissed;
    if (filter === "archived") return n.is_dismissed;
    return !n.is_dismissed;
  });

  const paginated = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = filtered.length > paginated.length;
  const unreadCount = all.filter((n) => !n.is_read && !n.is_dismissed).length;

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "all", label: "Toutes" },
    { key: "unread", label: "Non lues" },
    { key: "high", label: "Priorité haute" },
    { key: "archived", label: "Archivées" },
  ];

  return (
    <div className="max-w-2xl">
      {/* Bulk actions */}
      <div className="flex items-center justify-between mb-3">
        <div className="tabs">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={`tab ${filter === f.key ? "active" : ""}`}
              onClick={() => { setFilter(f.key); setPage(1); }}
            >
              {f.label}
              {f.key === "unread" && unreadCount > 0 && (
                <span className="ml-1.5 text-[10px] bg-[#C8924A] text-white font-bold px-1.5 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1 text-[11.5px] text-[#C8924A] hover:text-[#A87240] transition-colors"
            >
              <CheckCheck size={13} />
              Tout marquer comme lu
            </button>
          )}
          <button
            onClick={handleDeleteRead}
            className="flex items-center gap-1 text-[11.5px] text-[#6B7280] hover:text-[#DC2626] transition-colors"
          >
            <Trash2 size={12} />
            Supprimer les lues
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-12 text-[12.5px] text-[#9CA3AF]">Chargement...</div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl px-5 py-12 text-center">
          <div className="text-3xl mb-2">✓</div>
          <p className="text-[13px] font-medium text-[#6B7280]">Aucune notification</p>
          <p className="text-[11.5px] text-[#9CA3AF] mt-1">
            {filter === "unread" ? "Tout est lu !" : filter === "high" ? "Aucune alerte haute priorité" : "Rien ici pour l'instant"}
          </p>
        </div>
      )}

      {/* List */}
      {!loading && paginated.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {paginated.map((n) => {
            const isHigh = n.priority === "high";
            const inner = (
              <div
                className={`group relative flex items-start gap-3 rounded-xl border px-4 py-3 transition-all ${
                  !n.is_read && !n.is_dismissed
                    ? "bg-[#FEFDF9] border-[rgba(200,146,74,0.2)]"
                    : "bg-white border-[rgba(0,0,0,0.07)]"
                }`}
                style={{ borderLeft: `3px solid ${isHigh ? "#DC2626" : "#E5E7EB"}` }}
              >
                {!n.is_read && !n.is_dismissed && (
                  <div className="absolute top-3.5 right-9 w-1.5 h-1.5 rounded-full bg-[#C8924A]" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-[12.5px] leading-snug ${!n.is_read ? "font-semibold text-[#1A1A2E]" : "font-medium text-[#374151]"}`}>
                      {n.title}
                    </p>
                    <span className="text-[10.5px] text-[#9CA3AF] whitespace-nowrap flex-shrink-0 mt-0.5">
                      {timeAgo(n.created_at)}
                    </span>
                  </div>
                  <p className="text-[11.5px] text-[#6B7280] mt-0.5 leading-snug">{n.message}</p>
                  {n.link && !n.is_dismissed && (
                    <span className="inline-block mt-1 text-[11px] text-[#C8924A] font-medium">Voir →</span>
                  )}
                </div>
                {!n.is_dismissed && (
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDismiss(n.id); }}
                    className="flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity text-[#9CA3AF] hover:text-[#DC2626]"
                    title="Archiver"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            );

            if (n.link && !n.is_dismissed) {
              return (
                <Link key={n.id} href={n.link} onClick={() => handleClick(n)} className="block hover:no-underline">
                  {inner}
                </Link>
              );
            }
            return <div key={n.id} onClick={() => handleClick(n)}>{inner}</div>;
          })}
        </div>
      )}

      {/* Load more */}
      {hasMore && (
        <div className="mt-4 text-center">
          <button
            onClick={() => setPage((p) => p + 1)}
            className="btn btn-outline"
          >
            Charger plus
          </button>
        </div>
      )}
    </div>
  );
}
