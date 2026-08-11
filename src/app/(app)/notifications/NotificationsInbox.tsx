"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Archive,
  CheckCheck,
  ExternalLink,
  Inbox,
  Mail,
  MailOpen,
  RefreshCw,
  Trash2,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import {
  deleteReadNotifications,
  dismissNotification,
  markAllRead,
  markClicked,
  markRead,
  type Notification,
} from "@/lib/notifications/actions";

type Folder = "inbox" | "unread" | "priority" | "archived";

function relativeDate(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
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

export default function NotificationsInbox({
  initialNotifications,
}: {
  initialNotifications: Notification[];
}) {
  const [messages, setMessages] = useState(initialNotifications);
  const [folder, setFolder] = useState<Folder>("inbox");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(30);
  const [, startTransition] = useTransition();
  const router = useRouter();

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

  function selectFolder(nextFolder: Folder) {
    setFolder(nextFolder);
    setSelectedId(null);
    setVisibleCount(30);
  }

  function openMessage(message: Notification) {
    setSelectedId(message.id);
    if (message.is_read || message.type === "attention_action") return;
    setMessages((current) => current.map((item) => item.id === message.id ? { ...item, is_read: true } : item));
    startTransition(() => { void markRead(message.id); });
  }

  function archiveMessage(message: Notification) {
    if (message.type === "attention_action") return;
    setMessages((current) => current.map((item) => item.id === message.id ? { ...item, is_dismissed: true, is_read: true } : item));
    setSelectedId(null);
    startTransition(() => { void dismissNotification(message.id); });
  }

  function markEverythingRead() {
    setMessages((current) => current.map((message) => ({ ...message, is_read: true })));
    startTransition(() => { void markAllRead(); });
  }

  async function deleteRead() {
    setMessages((current) => current.filter((message) => !message.is_read || message.type === "attention_action"));
    setSelectedId(null);
    await deleteReadNotifications();
  }

  const folders: Array<{ key: Folder; label: string; count?: number; icon: typeof Inbox }> = [
    { key: "inbox", label: "Réception", count: messages.filter((message) => !message.is_dismissed).length, icon: Inbox },
    { key: "unread", label: "Non lus", count: unreadCount, icon: Mail },
    { key: "priority", label: "Prioritaires", count: priorityCount, icon: AlertTriangle },
    { key: "archived", label: "Archivés", count: archivedCount, icon: Archive },
  ];

  return (
    <div className="min-w-0">
      <PageHeader
        title="Boîte de réception"
        subtitle="Vos messages, alertes et actions importantes au même endroit"
        icon={<Mail size={18} />}
      />

      <section className="min-h-[570px] overflow-hidden border border-[rgba(0,0,0,0.09)] bg-white shadow-[0_1px_3px_rgba(13,21,38,0.05)]" aria-label="Messages Mohasib">
        <div className="flex h-11 items-center justify-between border-b border-[#E7E7E2] bg-[#FAFAF7] px-3">
          <div className="flex items-center gap-2 text-[11px] text-[#6B7280]">
            <MailOpen size={14} />
            <span><strong className="text-[#1A1A2E]">{unreadCount}</strong> message{unreadCount !== 1 ? "s" : ""} non lu{unreadCount !== 1 ? "s" : ""}</span>
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button type="button" onClick={markEverythingRead} className="flex h-8 items-center gap-1.5 px-2 text-[10.5px] font-semibold text-[#6B7280] hover:bg-white hover:text-[#8A5E25]" title="Tout marquer comme lu">
                <CheckCheck size={13} /> <span className="hidden sm:inline">Tout lire</span>
              </button>
            )}
            <button type="button" onClick={() => void deleteRead()} className="flex h-8 items-center gap-1.5 px-2 text-[10.5px] font-semibold text-[#6B7280] hover:bg-white hover:text-red-600" title="Supprimer les messages lus">
              <Trash2 size={12} /> <span className="hidden sm:inline">Supprimer les lus</span>
            </button>
            <button type="button" onClick={() => router.refresh()} className="flex h-8 w-8 items-center justify-center text-[#6B7280] hover:bg-white hover:text-[#1A1A2E]" title="Actualiser">
              <RefreshCw size={13} />
            </button>
          </div>
        </div>

        <div className="grid min-h-[525px] lg:grid-cols-[170px_340px_minmax(0,1fr)]">
          <nav className="flex gap-1 overflow-x-auto border-b border-[#E7E7E2] bg-[#F7F7F3] p-2 lg:block lg:border-b-0 lg:border-r lg:p-3" aria-label="Dossiers de messages">
            {folders.map(({ key, label, count, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => selectFolder(key)}
                className={`flex h-9 min-w-fit items-center gap-2 px-2.5 text-[11.5px] font-semibold transition-colors lg:mb-1 lg:w-full ${folder === key ? "bg-white text-[#1A1A2E] shadow-[0_1px_2px_rgba(13,21,38,0.06)]" : "text-[#6B7280] hover:bg-white/70 hover:text-[#1A1A2E]"}`}
              >
                <Icon size={14} className={key === "priority" && count ? "text-red-500" : "text-[#8A909B]"} />
                <span className="flex-1 text-left">{label}</span>
                {Boolean(count) && <span className="text-[9.5px] font-bold text-[#8A909B]">{count}</span>}
              </button>
            ))}
          </nav>

          <div className="border-b border-[#E7E7E2] lg:border-b-0 lg:border-r">
            <div className="border-b border-[#ECECE8] px-3 py-2 text-[9.5px] font-bold uppercase tracking-[0.8px] text-[#9A9FA8]">
              {folders.find((item) => item.key === folder)?.label} · {filtered.length}
            </div>
            <div className="max-h-[470px] overflow-y-auto lg:max-h-[485px]">
              {visibleMessages.length === 0 ? (
                <div className="px-5 py-14 text-center">
                  <MailOpen size={24} className="mx-auto text-[#C8CBCF]" />
                  <p className="mt-2 text-[12px] font-semibold text-[#6B7280]">Aucun message</p>
                  <p className="mt-1 text-[10.5px] text-[#9CA3AF]">Ce dossier est vide.</p>
                </div>
              ) : visibleMessages.map((message) => (
                <button
                  key={message.id}
                  type="button"
                  onClick={() => openMessage(message)}
                  className={`relative block w-full border-b border-[#EFEFEA] px-3 py-3 text-left transition-colors ${selected?.id === message.id ? "bg-[#F5F0E7]" : !message.is_read ? "bg-[#FFFDF8] hover:bg-[#FAFAF6]" : "bg-white hover:bg-[#FAFAF6]"}`}
                >
                  {!message.is_read && <span className="absolute left-0 top-0 h-full w-0.5 bg-[#C8924A]" />}
                  <div className="flex items-center justify-between gap-2">
                    <span className={`truncate text-[10.5px] ${!message.is_read ? "font-bold text-[#1A1A2E]" : "font-semibold text-[#6B7280]"}`}>
                      {message.type === "attention_action" ? "Mohasib Actions" : "Mohasib"}
                    </span>
                    <span className="flex-shrink-0 text-[9.5px] text-[#9CA3AF]">{relativeDate(message.created_at)}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <p className={`min-w-0 flex-1 truncate text-[11.5px] ${!message.is_read ? "font-bold text-[#1A1A2E]" : "font-medium text-[#374151]"}`}>{message.title}</p>
                    {message.priority === "high" && <AlertTriangle size={11} className="flex-shrink-0 text-red-500" />}
                  </div>
                  <p className="mt-0.5 truncate text-[10.5px] text-[#858B95]">{message.message}</p>
                </button>
              ))}
            </div>
            {filtered.length > visibleCount && (
              <button type="button" onClick={() => setVisibleCount((count) => count + 30)} className="h-9 w-full border-t border-[#ECECE8] text-[10.5px] font-semibold text-[#8A5E25] hover:bg-[#FAFAF7]">Afficher plus</button>
            )}
          </div>

          <article className="min-w-0 bg-white">
            {selected ? (
              <>
                <header className="border-b border-[#ECECE8] px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {selected.priority === "high" && <span className="bg-red-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-red-600">Prioritaire</span>}
                        {!selected.is_read && <span className="bg-[#FBF1E3] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#9A6325]">Nouveau</span>}
                      </div>
                      <h2 className="mt-2 text-[17px] font-bold leading-snug text-[#1A1A2E]">{selected.title}</h2>
                    </div>
                    {!selected.is_dismissed && selected.type !== "attention_action" && (
                      <button type="button" onClick={() => archiveMessage(selected)} className="flex h-8 items-center gap-1.5 px-2 text-[10.5px] font-semibold text-[#6B7280] hover:bg-[#F7F7F3] hover:text-[#1A1A2E]" title="Archiver ce message">
                        <Archive size={13} /> <span className="hidden xl:inline">Archiver</span>
                      </button>
                    )}
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0D1526] text-[11px] font-bold text-white">M</span>
                    <div className="min-w-0">
                      <p className="text-[11.5px] font-bold text-[#1A1A2E]">{selected.type === "attention_action" ? "Mohasib Actions" : "Mohasib"}</p>
                      <p className="text-[9.5px] text-[#8A909B]">{fullDate(selected.created_at)}</p>
                    </div>
                  </div>
                </header>
                <div className="px-5 py-6">
                  <p className="max-w-2xl whitespace-pre-line text-[13px] leading-6 text-[#3F4652]">{selected.message}</p>
                  {selected.link && !selected.is_dismissed && (
                    <Link href={selected.link} onClick={() => { openMessage(selected); void markClicked(selected.id); }} className="mt-6 inline-flex h-9 items-center gap-2 bg-[#0D1526] px-4 text-[11px] font-bold text-white transition-colors hover:bg-[#1C2940]">
                      Ouvrir l&apos;action <ExternalLink size={12} />
                    </Link>
                  )}
                </div>
              </>
            ) : (
              <div className="flex min-h-[400px] flex-col items-center justify-center px-6 text-center">
                <MailOpen size={30} className="text-[#C8CBCF]" />
                <p className="mt-3 text-[12.5px] font-semibold text-[#6B7280]">Sélectionnez un message</p>
                <p className="mt-1 text-[10.5px] text-[#9CA3AF]">Son contenu apparaîtra ici, comme dans une boîte email.</p>
              </div>
            )}
          </article>
        </div>
      </section>
    </div>
  );
}
