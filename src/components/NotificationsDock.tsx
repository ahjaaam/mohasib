"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  CheckCheck,
  ExternalLink,
  Inbox,
  Loader2,
  Mail,
  MailOpen,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import {
  deleteReadNotifications,
  dismissNotification,
  fetchInboxNotifications,
  markAllRead,
  markClicked,
  markRead,
  type Notification,
} from "@/lib/notifications/actions";

type Folder = "inbox" | "unread" | "priority" | "archived";

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

function fullDate(value: string) {
  return new Date(value).toLocaleDateString("fr-MA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function NotificationsDock({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<Notification[]>([]);
  const [folder, setFolder] = useState<Folder>("inbox");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(30);
  const [loading, setLoading] = useState(true);
  const [, startTransition] = useTransition();
  const unreadCount = messages.filter((message) => !message.is_read && !message.is_dismissed).length;
  const priorityCount = messages.filter((message) => message.priority === "high" && !message.is_dismissed).length;
  const archivedCount = messages.filter((message) => message.is_dismissed).length;
  const filtered = useMemo(() => messages.filter((message) => {
    if (folder === "unread") return (!message.is_read || message.id === selectedId) && !message.is_dismissed;
    if (folder === "priority") return message.priority === "high" && !message.is_dismissed;
    if (folder === "archived") return message.is_dismissed;
    return !message.is_dismissed;
  }), [folder, messages, selectedId]);
  const visibleMessages = filtered.slice(0, visibleCount);
  const selected = selectedId ? filtered.find((message) => message.id === selectedId) ?? null : null;

  useEffect(() => {
    if (!open) return;
    let active = true;
    void fetchInboxNotifications()
      .then((items) => { if (active) setMessages(items); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open]);

  function openMessage(message: Notification) {
    setSelectedId(message.id);
    if (message.is_read || message.type === "attention_action") return;
    setMessages((current) => current.map((item) => item.id === message.id ? { ...item, is_read: true } : item));
    startTransition(() => { void markRead(message.id); });
  }

  function markEverythingRead() {
    setMessages((current) => current.map((message) => ({ ...message, is_read: true })));
    startTransition(() => { void markAllRead(); });
  }

  function selectFolder(nextFolder: Folder) {
    setFolder(nextFolder);
    setSelectedId(null);
    setVisibleCount(30);
  }

  function archiveMessage(message: Notification) {
    if (message.type === "attention_action") return;
    setMessages((current) => current.map((item) => item.id === message.id ? { ...item, is_dismissed: true, is_read: true } : item));
    setSelectedId(null);
    startTransition(() => { void dismissNotification(message.id); });
  }

  function deleteRead() {
    setMessages((current) => current.filter((message) => !message.is_read || message.type === "attention_action"));
    setSelectedId(null);
    startTransition(() => { void deleteReadNotifications(); });
  }

  function refreshMessages() {
    setLoading(true);
    void fetchInboxNotifications()
      .then(setMessages)
      .finally(() => setLoading(false));
  }

  const folders: Array<{ key: Folder; label: string; count: number; icon: typeof Inbox }> = [
    { key: "inbox", label: "Réception", count: messages.filter((message) => !message.is_dismissed).length, icon: Inbox },
    { key: "unread", label: "Non lus", count: unreadCount, icon: Mail },
    { key: "priority", label: "Priorité", count: priorityCount, icon: AlertTriangle },
    { key: "archived", label: "Archivés", count: archivedCount, icon: Archive },
  ];

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
              <CheckCheck size={13} /> <span className="hidden sm:inline">Tout lire</span>
            </button>
          )}
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center text-[#6B7280] hover:bg-black/[0.04]" aria-label="Fermer la boîte de réception">
            <X size={16} />
          </button>
        </div>
      </header>

      {selected ? (
        <article className="flex-1 overflow-y-auto bg-white">
          <header className="border-b border-black/[0.06] px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {selected.priority === "high" && <span className="bg-red-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-red-600">Prioritaire</span>}
                </div>
                <h3 className="mt-2 text-[17px] font-bold leading-snug text-[#1A1A2E]">{selected.title}</h3>
              </div>
              {!selected.is_dismissed && selected.type !== "attention_action" && (
                <button type="button" onClick={() => archiveMessage(selected)} className="flex h-8 items-center gap-1.5 px-2 text-[10.5px] font-semibold text-[#6B7280] hover:bg-[#F7F7F3]" title="Archiver ce message">
                  <Archive size={13} /> Archiver
                </button>
              )}
            </div>
            <div className="mt-4 flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0D1526] text-[10px] font-bold text-white">M</span>
              <div>
                <p className="text-[11.5px] font-bold text-[#1A1A2E]">{selected.type === "attention_action" ? "Mohasib Actions" : "Mohasib"}</p>
                <p className="text-[9.5px] text-[#8A909B]">{fullDate(selected.created_at)}</p>
              </div>
            </div>
          </header>
          <div className="px-5 py-5">
            <p className="whitespace-pre-line text-[13px] leading-6 text-[#3F4652]">{selected.message}</p>
            {selected.link && !selected.is_dismissed && (
              <Link href={selected.link} onClick={() => { void markClicked(selected.id); onClose(); }} className="mt-6 inline-flex h-9 items-center gap-2 bg-[#0D1526] px-4 text-[11px] font-bold text-white hover:bg-[#1C2940]">
                Ouvrir l&apos;action <ExternalLink size={12} />
              </Link>
            )}
          </div>
        </article>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-shrink-0 items-center gap-1 overflow-x-auto border-b border-black/[0.07] bg-[#F7F7F3] p-2" aria-label="Dossiers de messages">
            {folders.map(({ key, label, count, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => selectFolder(key)}
                className={`flex h-8 min-w-fit items-center gap-1.5 px-2 text-[10.5px] font-semibold ${folder === key ? "bg-white text-[#1A1A2E] shadow-[0_1px_2px_rgba(13,21,38,0.08)]" : "text-[#6B7280] hover:bg-white/70"}`}
              >
                <Icon size={12} className={key === "priority" && count ? "text-red-500" : "text-[#8A909B]"} />
                {label}
                {count > 0 && <span className="text-[9px] text-[#9A9FA8]">{count}</span>}
              </button>
            ))}
          </div>
          <div className="flex h-10 flex-shrink-0 items-center justify-between border-b border-black/[0.06] px-3">
            <span className="text-[9.5px] font-bold uppercase tracking-[0.7px] text-[#9A9FA8]">{folders.find((item) => item.key === folder)?.label} · {filtered.length}</span>
            <div className="flex items-center gap-0.5">
              <button type="button" onClick={deleteRead} className="flex h-7 w-7 items-center justify-center text-[#8A909B] hover:bg-[#F7F7F3] hover:text-red-600" title="Supprimer les messages lus"><Trash2 size={12} /></button>
              <button type="button" onClick={refreshMessages} className="flex h-7 w-7 items-center justify-center text-[#8A909B] hover:bg-[#F7F7F3] hover:text-[#1A1A2E]" title="Actualiser"><RefreshCw size={12} className={loading ? "animate-spin" : ""} /></button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex h-full items-center justify-center gap-2 text-[11px] text-[#8A909B]"><Loader2 size={14} className="animate-spin" /> Chargement…</div>
            ) : visibleMessages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                <MailOpen size={26} className="text-[#C8CBCF]" />
                <p className="mt-3 text-[12px] font-semibold text-[#6B7280]">Aucun message</p>
                <p className="mt-1 text-[10.5px] text-[#9CA3AF]">Ce dossier est vide.</p>
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
                  <span className={`truncate text-[10.5px] ${message.is_read ? "font-semibold text-[#6B7280]" : "font-bold text-[#1A1A2E]"}`}>{message.type === "attention_action" ? "Mohasib Actions" : "Mohasib"}</span>
                  <span className="flex-shrink-0 text-[9.5px] text-[#9CA3AF]">{relativeDate(message.created_at)}</span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <p className={`min-w-0 flex-1 truncate text-[11.5px] ${message.is_read ? "font-medium text-[#374151]" : "font-bold text-[#1A1A2E]"}`}>{message.title}</p>
                  {message.priority === "high" && <AlertTriangle size={11} className="flex-shrink-0 text-red-500" />}
                </div>
                <p className="mt-0.5 truncate text-[10.5px] text-[#858B95]">{message.message}</p>
              </button>
            ))}
          </div>
          {filtered.length > visibleCount && (
            <button type="button" onClick={() => setVisibleCount((count) => count + 30)} className="h-10 flex-shrink-0 border-t border-black/[0.07] bg-white text-[10.5px] font-semibold text-[#8A5E25] hover:bg-[#FAFAF7]">Afficher plus</button>
          )}
        </div>
      )}
    </aside>
  );
}
