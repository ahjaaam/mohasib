"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { CircleHelp, Send, CheckCircle2, X } from "lucide-react";

type SupportTicket = {
  id: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
};

const ticketDate = new Intl.DateTimeFormat("fr-MA", { day: "numeric", month: "short", year: "numeric" });
const statusLabels: Record<string, string> = {
  nouveau: "Nouveau",
  "contacté": "Contacté",
  "finalisé": "Finalisé",
  cancelled: "Annulé",
};

export default function SupportTicketButton({
  dossierId,
  open,
  onToggle,
  onClose,
}: {
  dossierId?: string;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(false);
  const [historyVersion, setHistoryVersion] = useState(0);
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    async function loadHistory() {
      setHistoryLoading(true);
      setHistoryError(false);
      try {
        const response = await fetch("/api/support/tickets", { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error();
        const data: { tickets: SupportTicket[] } = await response.json();
        if (!controller.signal.aborted) setTickets(data.tickets);
      } catch {
        if (!controller.signal.aborted) setHistoryError(true);
      } finally {
        if (!controller.signal.aborted) setHistoryLoading(false);
      }
    }
    void loadHistory();
    return () => controller.abort();
  }, [open, historyVersion]);

  function reset() {
    setSubject("");
    setMessage("");
    setSent(false);
    setError(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!subject.trim() || !message.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      const response = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, message, page_url: pathname, dossier_id: dossierId }),
      });
      if (!response.ok) throw new Error();
      setSent(true);
      setHistoryVersion((version) => version + 1);
      setTimeout(() => {
        onClose();
        reset();
      }, 2500);
    } catch {
      setError("Impossible d'envoyer votre demande. Réessayez.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        className={`flex h-10 w-10 items-center justify-center border text-[#777E8B] transition-colors ${
          open
            ? "border-[#C8924A] bg-[rgba(200,146,74,0.16)]"
            : "border-transparent bg-[rgba(200,146,74,0.08)] hover:border-[#D8C19D] hover:bg-[rgba(200,146,74,0.14)]"
        }`}
        title="Besoin d'aide"
        aria-label="Besoin d'aide"
        aria-expanded={open}
        aria-controls="mohasib-support-dock"
      >
        <CircleHelp size={18} />
      </button>

      {open && (
        <aside
          id="mohasib-support-dock"
          role="dialog"
          aria-label="Besoin d'aide"
          className="mohasib-side-card fixed bottom-[calc(56px+env(safe-area-inset-bottom))] right-0 top-16 z-[80] flex w-full flex-col overflow-hidden sm:w-[400px] md:bottom-[14px] md:right-[14px]"
        >
          <div className="flex h-14 flex-shrink-0 items-center justify-between border-b border-black/[0.07] px-4">
            <div className="flex items-center gap-2.5">
              <CircleHelp size={16} className="text-[#C8924A]" />
              <span className="text-[13px] font-bold text-[#1A1A2E]">Besoin d&apos;aide ?</span>
            </div>
            <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center text-[#6B7280] hover:bg-black/[0.04]" aria-label="Fermer l'aide">
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {sent ? (
              <div className="flex flex-col items-center justify-center gap-2 px-5 py-8 text-center">
                <CheckCircle2 size={22} className="text-[#059669]" aria-hidden="true" />
                <p className="text-[12px] font-semibold text-[#1A1A2E]">Demande envoyée</p>
                <p className="text-[11px] text-[#6B7280]">Notre équipe vous répond rapidement.</p>
              </div>
            ) : (
              <form onSubmit={submit} className="p-5">
              <p className="mb-5 text-[12px] leading-5 text-[#6B7280]">
                Décrivez votre problème, notre équipe reçoit votre demande immédiatement.
              </p>
              <label className="block">
                <span className="mb-1 block text-[10.5px] font-medium text-[#6B7280]">Sujet</span>
                <input
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder="Ex : Problème avec une facture"
                  maxLength={150}
                  required
                  className="mb-3 w-full border border-[#DADAD5] px-2.5 py-2 text-[12.5px] outline-none transition-colors focus:border-[#C8924A]"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10.5px] font-medium text-[#6B7280]">Message</span>
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Expliquez votre problème en quelques mots…"
                  maxLength={4000}
                  required
                  rows={4}
                  className="mb-3 w-full resize-none border border-[#DADAD5] px-2.5 py-2 text-[12.5px] outline-none transition-colors focus:border-[#C8924A]"
                />
              </label>
              {error && <p className="mb-2 text-[11px] text-[#DC2626]">{error}</p>}
              <button
                type="submit"
                disabled={sending || !subject.trim() || !message.trim()}
                className="flex w-full items-center justify-center gap-1.5 bg-[#C8924A] px-4 py-2.5 text-[12px] font-bold text-white transition-colors hover:bg-[#B8823A] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? "Envoi…" : <>Envoyer <Send size={13} /></>}
              </button>
              </form>
            )}

            <section aria-labelledby="support-history-title" className="border-t border-black/[0.07] px-5 py-5">
              <h2 id="support-history-title" className="text-[12px] font-bold text-[#1A1A2E]">Historique de mes demandes</h2>
              {historyLoading ? (
                <p className="mt-3 text-[11px] text-[#6B7280]">Chargement de l&apos;historique…</p>
              ) : historyError ? (
                <div className="mt-3 text-[11px] text-[#6B7280]">
                  <p>Impossible de charger l&apos;historique.</p>
                  <button type="button" onClick={() => setHistoryVersion((version) => version + 1)} className="mt-1 font-semibold text-[#A66C25] hover:underline">Réessayer</button>
                </div>
              ) : tickets.length === 0 ? (
                <p className="mt-3 text-[11px] text-[#6B7280]">Vous n&apos;avez pas encore envoyé de demande.</p>
              ) : (
                <ul className="mt-3 divide-y divide-black/[0.07] border-y border-black/[0.07]">
                  {tickets.map((ticket) => (
                    <li key={ticket.id} className="py-3">
                      <details className="group">
                        <summary className="cursor-pointer list-none marker:hidden [&::-webkit-details-marker]:hidden">
                          <span className="flex items-start justify-between gap-2">
                            <span className="min-w-0 break-words text-[11.5px] font-semibold text-[#1A1A2E] group-open:text-[#A66C25]">{ticket.subject}</span>
                            <span className="shrink-0 bg-[#F7F1E8] px-2 py-0.5 text-[10px] font-medium text-[#8A612D]">{statusLabels[ticket.status] ?? ticket.status}</span>
                          </span>
                          <span className="mt-1 block text-[10px] text-[#777E8B]">{ticketDate.format(new Date(ticket.created_at))}</span>
                        </summary>
                        <p className="mt-2 whitespace-pre-wrap break-words text-[11px] leading-4 text-[#6B7280]">{ticket.message}</p>
                      </details>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </aside>
      )}
    </>
  );
}
