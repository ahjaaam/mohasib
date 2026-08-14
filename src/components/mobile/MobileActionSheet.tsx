"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

type Props = {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
};

export default function MobileActionSheet({ open, title, description, onClose, children }: Props) {
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="mobile-action-sheet md:hidden" role="presentation">
      <button
        type="button"
        className="mobile-action-sheet__backdrop"
        aria-label="Fermer"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-action-sheet-title"
        className="mobile-action-sheet__panel"
      >
        <div className="mobile-action-sheet__handle" aria-hidden="true" />
        <div className="flex items-start justify-between gap-4 px-5 pb-4">
          <div>
            <h2 id="mobile-action-sheet-title" className="text-[18px] font-bold text-[#111827]">{title}</h2>
            {description ? <p className="mt-1 text-[12px] leading-5 text-[#737985]">{description}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="mobile-icon-button -mr-1" aria-label="Fermer">
            <X size={19} />
          </button>
        </div>
        <div className="px-4 pb-[calc(18px+env(safe-area-inset-bottom))]">{children}</div>
      </section>
    </div>
  );
}
