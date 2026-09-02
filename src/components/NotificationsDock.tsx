"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCheck, ExternalLink, Inbox, Loader2, MailOpen, X } from "lucide-react";
import {
  fetchAllNotifications,
  markAllRead,
  markClicked,
  markRead,
  type Notification,
} from "@/lib/notifications/actions";

function relativeDate(value: string) {
  const elapsed = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(elapsed / 60000);
  const hours = Math.floor(elapsed / 3600000);
  const days = Math.floor(elapsed / 86400000);
  if (minutes < 60) return `${Math.max(1, minutes)} min`;
  if (hours < 24) return `${hours} h`;
  if (days < 7) return `${days} j`;
  return new Date(value).toLocaleDateString("fr-MA", { day: "2-digit", month: "short" });
}

export default function NotificationsDock({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<Notification[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [, startTransition] = useTransition();
  const selected = selectedId ? messages.find((message) => message.id === selectedId) ?? null : null;
  const visibleMessages = messages.filter((message) => !message.is_dismissed);
  const unreadCount = visibleMessages.filter((message) => !message.is_read).length;

  useEffect(() => {
    if (!open) return;
    let active = true;
    void fetchAllNotifications()
      .then((items) => { if (active) setMessages(items); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open]);

  function openMessage(message: Notification) {
    setSelectedId(message.id);
    if (message.is_read) return;
    setMessages((current) => current.map((item) => item.id === message.id ? { ...item, is_read: true } : item));
    startTransition(() => { void markRead(message.id); });
  }

  function markEverythingRead() {
    setMessages((current) => current.map((message) => ({ ...message, is_read: true })));
    startTransition(() => { void markAllRead(); });
  }

  if (!open) return null;

  return (
    <aside
      id="mohasib-notifications-dock"
      role="dialog"
      aria-label="Boîte de réception"
      className="mohasib-side-card fixed bottom-[calc(56px+env(safe-area-inset-bottom))] right-0 top-16 z-[80] flex w-full flex-col overflow-hidden sm:w-[400px] md:bottom-[14px] md:right-[14px]"
    >
      <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-black/[0.07] px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          {selected && (
            <button type="button" onClick={() => setSelectedId(null)} className="flex h-8 w-8 items-center justify-center text-[#6B7280] hover:bg-black/[0.04]" aria-label="Retour aux messages">
              <ArrowLeft size={15} />
            </button>
          )}
          <Inbox size={16} className="text-[#C8924A]" />
          <div className="min-w-0">
            <h2 className="truncate text-[13px] font-bold text-[#1A1A2E]">Boîte de réception</h2>
            <p className="text-[10px] text-[#8A909B]">{unreadCount} non lu{unreadCount !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {!selected && unreadCount > 0 && (
            <button type="button" onClick={markEverythingRead} className="flex h-8 items-center gap-1.5 px-2 text-[10.5px] font-semibold text-[#6B7280] hover:bg-black/[0.04]" title="Tout marquer comme lu">
              <CheckCheck size={13} /> Tout lire
            </button>
          )}
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center text-[#6B7280] hover:bg-black/[0.04]" aria-label="Fermer la boîte de réception">
            <X size={16} />
          </button>
        </div>
      </header>

      {selected ? (
        <article className="flex-1 overflow-y-auto bg-white px-5 py-5">
          <div className="flex items-center justify-between gap-3 text-[10px] text-[#9CA3AF]">
            <span className="font-semibold text-[#6B7280]">Mohasib</span>
            <span>{relativeDate(selected.created_at)}</span>
          </div>
          <h3 className="mt-4 text-[17px] font-bold leading-snug text-[#1A1A2E]">{selected.title}</h3>
          <p className="mt-4 whitespace-pre-line text-[13px] leading-6 text-[#3F4652]">{selected.message}</p>
          {selected.link && (
            <Link href={selected.link} onClick={() => void markClicked(selected.id)} className="mt-6 inline-flex h-9 items-center gap-2 bg-[#0D1526] px-4 text-[11px] font-bold text-white hover:bg-[#1C2940]">
              Ouvrir l&apos;action <ExternalLink size={12} />
            </Link>
          )}
        </article>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex h-full items-center justify-center gap-2 text-[11px] text-[#8A909B]"><Loader2 size={14} className="animate-spin" /> Chargement…</div>
            ) : visibleMessages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                <MailOpen size={26} className="text-[#C8CBCF]" />
                <p className="mt-3 text-[12px] font-semibold text-[#6B7280]">Aucun message</p>
              </div>
            ) : visibleMessages.map((message) => (
              <button
                key={message.id}
                type="button"
                onClick={() => openMessage(message)}
                className={`relative block w-full border-b border-black/[0.06] px-4 py-3.5 text-left transition-colors ${message.is_read ? "bg-white hover:bg-[#F7F7F3]" : "bg-[#FFFDF8] hover:bg-[#FAF6EE]"}`}
              >
                {!message.is_read && <span className="absolute left-0 top-0 h-full w-0.5 bg-[#C8924A]" />}
                <div className="flex items-center justify-between gap-3">
                  <span className={`truncate text-[11.5px] ${message.is_read ? "font-semibold text-[#4F5662]" : "font-bold text-[#1A1A2E]"}`}>{message.title}</span>
                  <span className="flex-shrink-0 text-[9.5px] text-[#9CA3AF]">{relativeDate(message.created_at)}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-[10.5px] leading-4 text-[#7B818B]">{message.message}</p>
              </button>
            ))}
          </div>
          <Link href="/notifications" className="flex h-11 flex-shrink-0 items-center justify-center border-t border-black/[0.07] bg-white text-[11px] font-semibold text-[#8A5E25] hover:bg-[#FAFAF7]">
            Ouvrir la boîte complète
          </Link>
        </div>
      )}
    </aside>
  );
}
