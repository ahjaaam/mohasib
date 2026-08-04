"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";

export default function TableBulkActions({
  count,
  noun,
  busy = false,
  onClear,
  children,
}: {
  count: number;
  noun: string;
  busy?: boolean;
  onClear: () => void;
  children: ReactNode;
}) {
  if (count === 0) return null;

  return (
    <div className="mb-3 flex flex-col gap-2 border border-[#E7D3B5] bg-[#FAF3E8] px-3 py-2.5 sm:flex-row sm:items-center">
      <div className="flex items-center gap-2">
        <span className="flex h-6 min-w-6 items-center justify-center bg-[#C8924A] px-1.5 text-[11px] font-bold text-white">
          {count}
        </span>
        <span className="text-[12px] font-semibold text-[#5D4527]">
          {noun}{count > 1 ? "s" : ""} sélectionné{count > 1 ? "s" : ""}
        </span>
      </div>
      <div className="flex flex-1 flex-wrap items-center gap-1.5 sm:justify-end">
        {children}
        <button
          type="button"
          onClick={onClear}
          disabled={busy}
          title="Annuler la sélection"
          aria-label="Annuler la sélection"
          className="flex h-8 w-8 items-center justify-center border border-[#D8C6A9] bg-white text-[#6B7280] transition-colors hover:text-[#1A1A2E] disabled:opacity-50"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}
