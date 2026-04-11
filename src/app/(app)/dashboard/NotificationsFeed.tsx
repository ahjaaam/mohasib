"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CheckCheck, X } from "lucide-react";
import {
  markRead,
  markAllRead,
  dismissNotification,
  type Notification,
} from "@/lib/notifications/actions";

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

interface Props {
  initial: Notification[];
  totalCount: number;
}

export default function NotificationsFeed({ initial, totalCount }: Props) {
  const [items, setItems] = useState<Notification[]>(initial);
  const [, startTransition] = useTransition();

  const unread = items.filter((n) => !n.is_read && !n.is_dismissed);

  function handleMarkAllRead() {
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    startTransition(() => { markAllRead(); });
  }

  function handleDismiss(id: string) {
    setItems((prev) => prev.filter((n) => n.id !== id));
    startTransition(() => { dismissNotification(id); });
  }

  function handleClick(id: string) {
    setItems((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
    startTransition(() => { markRead(id); });
  }

  const visible = items.filter((n) => !n.is_dismissed);

  return (
    <div className="mb-4">
      {/* Section header */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="text-[10.5px] font-semibold text-[#6B7280] uppercase tracking-[0.7px]">
          Actualités &amp; Notifications
        </div>
        {unread.length > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-1 text-[11px] text-[#C8924A] hover:text-[#A87240] transition-colors"
          >
            <CheckCheck size={12} />
            Tout marquer comme lu
          </button>
        )}
      </div>

      {/* Empty state */}
      {visible.length === 0 && (
        <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl px-5 py-8 text-center">
          <div className="text-[22px] mb-1.5">✓</div>
          <p className="text-[12.5px] text-[#6B7280] font-medium">Tout est à jour</p>
          <p className="text-[11.5px] text-[#9CA3AF] mt-0.5">Aucune notification pour le moment</p>
        </div>
      )}

      {/* Feed */}
      {visible.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {visible.map((n) => (
            <NotificationItem
              key={n.id}
              notification={n}
              onDismiss={() => handleDismiss(n.id)}
              onClick={() => handleClick(n.id)}
            />
          ))}
        </div>
      )}

      {/* See all */}
      {totalCount > 10 && (
        <div className="mt-2 text-center">
          <Link
            href="/notifications"
            className="text-[11.5px] text-[#C8924A] hover:underline"
          >
            Voir toutes les notifications ({totalCount}) →
          </Link>
        </div>
      )}
    </div>
  );
}

// ─── Individual notification card ─────────────────────────────────────────────

function NotificationItem({
  notification: n,
  onDismiss,
  onClick,
}: {
  notification: Notification;
  onDismiss: () => void;
  onClick: () => void;
}) {
  const isHigh = n.priority === "high";

  const inner = (
    <div
      className={`group relative flex items-start gap-3 rounded-xl border px-4 py-3 transition-all ${
        !n.is_read
          ? "bg-[#FEFDF9] border-[rgba(200,146,74,0.2)]"
          : "bg-white border-[rgba(0,0,0,0.07)]"
      }`}
      style={{
        borderLeft: `3px solid ${isHigh ? "#DC2626" : "#E5E7EB"}`,
      }}
    >
      {/* Unread dot */}
      {!n.is_read && (
        <div className="absolute top-3.5 right-8 w-1.5 h-1.5 rounded-full bg-[#C8924A]" />
      )}

      {/* Content */}
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
        {n.link && (
          <span className="inline-block mt-1 text-[11px] text-[#C8924A] font-medium hover:underline">
            Voir →
          </span>
        )}
      </div>

      {/* Dismiss */}
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDismiss(); }}
        className="flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity text-[#9CA3AF] hover:text-[#DC2626]"
        title="Ignorer"
      >
        <X size={13} />
      </button>
    </div>
  );

  if (n.link) {
    return (
      <Link href={n.link} onClick={onClick} className="block hover:no-underline">
        {inner}
      </Link>
    );
  }
  return <div onClick={onClick}>{inner}</div>;
}
