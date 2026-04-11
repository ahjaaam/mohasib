"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { markRead, dismissNotification } from "@/lib/notifications/actions";
import toast from "react-hot-toast";

interface NotifRow {
  id: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  priority: "high" | "normal";
  created_at: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 60) return `${minutes || 1}min`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}j`;
  return new Date(dateStr).toLocaleDateString("fr-MA", { day: "2-digit", month: "2-digit" });
}

export default function NotificationBell({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotifRow[]>([]);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();
  const router = useRouter();

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("notifications")
      .select("id, title, message, link, is_read, priority, created_at")
      .eq("user_id", userId)
      .eq("is_dismissed", false)
      .order("created_at", { ascending: false })
      .limit(5);
    setItems((data ?? []) as NotifRow[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("notifications-bell")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload: any) => {
          const n = payload.new as NotifRow;
          setItems((prev) => [n, ...prev].slice(0, 5));
          if (n.priority === "high") {
            toast(`🔔 ${n.title}`, { duration: 4000, icon: "🔴" });
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const unreadHigh = items.filter((n) => !n.is_read && n.priority === "high").length;
  const unreadAll = items.filter((n) => !n.is_read).length;

  function handleItemClick(n: NotifRow) {
    setItems((prev) => prev.map((x) => x.id === n.id ? { ...x, is_read: true } : x));
    markRead(n.id);
    setOpen(false);
    if (n.link) router.push(n.link);
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative w-8 h-8 flex items-center justify-center rounded-lg text-[#6B7280] hover:text-[#1A1A2E] hover:bg-[#F3F4F6] transition-all"
        title="Notifications"
      >
        <Bell size={16} />
        {unreadHigh > 0 && (
          <span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-[#DC2626] text-white text-[9px] font-bold flex items-center justify-center animate-pulse">
            {unreadHigh > 9 ? "9+" : unreadHigh}
          </span>
        )}
        {unreadHigh === 0 && unreadAll > 0 && (
          <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-[#C8924A]" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-[340px] bg-white rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-[rgba(0,0,0,0.08)] z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(0,0,0,0.06)]">
            <span className="text-[12.5px] font-semibold text-[#1A1A2E]">
              Notifications
              {unreadAll > 0 && (
                <span className="ml-1.5 text-[10px] bg-[#C8924A] text-white font-bold px-1.5 py-0.5 rounded-full">
                  {unreadAll}
                </span>
              )}
            </span>
            <Link
              href="/notifications"
              className="text-[11px] text-[#C8924A] hover:underline"
              onClick={() => setOpen(false)}
            >
              Voir tout →
            </Link>
          </div>

          {/* List */}
          <div className="max-h-[360px] overflow-y-auto">
            {loading && (
              <div className="text-center py-6 text-[12px] text-[#9CA3AF]">Chargement...</div>
            )}
            {!loading && items.length === 0 && (
              <div className="text-center py-8 text-[12px] text-[#9CA3AF]">
                <div className="text-xl mb-1">✓</div>
                Tout est à jour
              </div>
            )}
            {!loading && items.map((n) => (
              <div
                key={n.id}
                onClick={() => handleItemClick(n)}
                className={`flex items-start gap-3 px-4 py-3 cursor-pointer border-b border-[rgba(0,0,0,0.04)] last:border-0 transition-colors hover:bg-[#FAFAF6] ${
                  !n.is_read ? "bg-[#FEFDF9]" : ""
                }`}
                style={{ borderLeft: `2px solid ${n.priority === "high" ? "#DC2626" : "#E5E7EB"}` }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-[12px] leading-snug truncate ${!n.is_read ? "font-semibold text-[#1A1A2E]" : "text-[#374151]"}`}>
                      {n.title}
                    </p>
                    <span className="text-[10px] text-[#9CA3AF] flex-shrink-0">{timeAgo(n.created_at)}</span>
                  </div>
                  <p className="text-[11px] text-[#6B7280] mt-0.5 leading-snug line-clamp-2">{n.message}</p>
                </div>
                {!n.is_read && (
                  <div className="w-1.5 h-1.5 rounded-full bg-[#C8924A] flex-shrink-0 mt-1.5" />
                )}
              </div>
            ))}
          </div>

          {/* Footer */}
          {items.length > 0 && (
            <div className="px-4 py-2.5 border-t border-[rgba(0,0,0,0.06)]">
              <Link
                href="/notifications"
                onClick={() => setOpen(false)}
                className="block text-center text-[11.5px] text-[#6B7280] hover:text-[#C8924A] transition-colors"
              >
                Toutes les notifications →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
