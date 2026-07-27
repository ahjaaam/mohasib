"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Headset, Send, CheckCircle2 } from "lucide-react";

export default function SupportTicketButton({ dossierId }: { dossierId?: string }) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

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
        setOpen(false);
        reset();
      }, 2500);
    } catch {
      setError("Impossible d'envoyer votre demande. Réessayez.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-10 w-10 items-center justify-center border border-transparent text-[#777E8B] transition-colors hover:border-[#E1E0DA] hover:bg-[#F5F4EF] hover:text-[#1A1A2E]"
        title="Contacter le support"
        aria-label="Contacter le support"
        aria-expanded={open}
      >
        <Headset size={16} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2.5 w-[calc(100vw-24px)] max-w-[340px] overflow-hidden border border-[#DADAD5] border-t-2 border-t-[#C8924A] bg-white shadow-[0_18px_42px_rgba(13,21,38,0.15)]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(0,0,0,0.06)]">
            <span className="text-[12.5px] font-semibold text-[#1A1A2E]">Besoin d&apos;aide ?</span>
          </div>

          {sent ? (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
              <CheckCircle2 size={22} className="text-[#059669]" aria-hidden="true" />
              <p className="text-[12px] font-semibold text-[#1A1A2E]">Demande envoyée</p>
              <p className="text-[11px] text-[#6B7280]">Notre équipe vous répond rapidement.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="p-4">
              <p className="mb-3 text-[11px] leading-snug text-[#6B7280]">
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
        </div>
      )}
    </div>
  );
}
