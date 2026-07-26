"use client";

import { useRouter } from "next/navigation";
import type { JournalCode } from "@/types/fiduciaire";
import { JOURNAL_LABELS as JOURNAL_SHORT_LABELS } from "@/types/fiduciaire";

export type JournalFilter = JournalCode | "ALL";
export const JOURNAL_OPTIONS: JournalFilter[] = ["ALL", "VT", "AC", "BQ", "CA", "OD"];

export default function EcrituresFilters({
  basePath,
  period,
  journal,
  search,
}: {
  basePath: string;
  period: string;
  journal: JournalFilter;
  search: string;
}) {
  const router = useRouter();

  function navigate(next: { periode?: string; journal?: string }) {
    const params = new URLSearchParams({
      periode: next.periode ?? period,
      journal: next.journal ?? journal,
      ...(search ? { q: search } : {}),
    });
    router.push(`${basePath}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-[12px] text-[#6B7280]">Période :</span>
      <input
        type="month"
        defaultValue={period}
        className="input py-1 text-[12.5px] w-[140px]"
        onChange={(e) => navigate({ periode: e.target.value })}
      />
      <span className="text-[12px] text-[#6B7280]">Journal :</span>
      <select
        defaultValue={journal}
        className="input py-1 text-[12.5px] w-[170px]"
        onChange={(e) => navigate({ journal: e.target.value })}
      >
        {JOURNAL_OPTIONS.map((j) => (
          <option key={j} value={j}>
            {j === "ALL" ? "Tous les journaux" : `${j} — ${JOURNAL_SHORT_LABELS[j]}`}
          </option>
        ))}
      </select>
    </div>
  );
}
