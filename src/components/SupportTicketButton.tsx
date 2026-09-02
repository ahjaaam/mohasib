"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { CircleHelp, Send, CheckCircle2, X } from "lucide-react";

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
  const pathname = usePathname();

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

          {sent ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-5 text-center">
              <CheckCircle2 size={22} className="text-[#059669]" aria-hidden="true" />
              <p className="text-[12px] font-semibold text-[#1A1A2E]">Demande envoyée</p>
              <p className="text-[11px] text-[#6B7280]">Notre équipe vous répond rapidement.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="flex-1 overflow-y-auto p-5">
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
        </aside>
      )}
    </>
  );
}
