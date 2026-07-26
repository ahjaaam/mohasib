"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText, Landmark, PenLine } from "lucide-react";
import SortableTh, { compareValues, nextSort, type SortDirection } from "@/components/SortableTh";
import type { JournalCode } from "@/types/fiduciaire";

export interface EcritureRow {
  date: string;
  numero_piece: string;
  compte: string;
  libelle: string;
  debit: number;
  credit: number;
  source: "facture" | "document" | "banque" | "manuel";
  journal: JournalCode;
  href?: string;
}

type SortKey = "date" | "numero_piece" | "compte" | "libelle" | "debit" | "credit" | "journal";

function fmt(n: number) {
  return n.toLocaleString("fr-MA", { minimumFractionDigits: 2 });
}
function fmtDate(d: string) {
  try { return new Date(d + "T00:00:00").toLocaleDateString("fr-MA", { day: "2-digit", month: "2-digit", year: "numeric" }); }
  catch { return d; }
}

function SourceBadge({ source }: { source: EcritureRow["source"] }) {
  const map = {
    facture: { label: "Facture", className: "bg-[#EFF6FF] text-[#1D4ED8]", icon: FileText },
    document: { label: "Document", className: "bg-[#FEF3C7] text-[#92400E]", icon: FileText },
    banque: { label: "Relevé bancaire", className: "bg-[#D1FAE5] text-[#065F46]", icon: Landmark },
    manuel: { label: "Manuel", className: "bg-[#F3F4F6] text-[#6B7280]", icon: PenLine },
  } as const;
  const { label, className, icon: Icon } = map[source];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 ${className}`}>
      <Icon size={9} /> {label}
    </span>
  );
}

export default function EcrituresTable({
  rows,
  compteLabel = "Compte",
}: {
  rows: EcritureRow[];
  compteLabel?: string;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  function handleSort(nextKey: SortKey) {
    const next = nextSort(sortKey, sortDirection, nextKey);
    setSortKey(next.key);
    setSortDirection(next.direction);
  }

  const sorted = [...rows].sort((a, b) => compareValues(a[sortKey], b[sortKey], sortDirection));
  const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px]">
        <thead>
          <tr className="bg-[#F9FAFB] border-b border-[rgba(0,0,0,0.06)]">
            <SortableTh sortKey="date" label="Date" activeKey={sortKey} direction={sortDirection} onSort={handleSort}
              className="px-3 py-2 text-[10.5px] font-semibold text-[#6B7280] uppercase tracking-wide" />
            <SortableTh sortKey="numero_piece" label="Pièce" activeKey={sortKey} direction={sortDirection} onSort={handleSort}
              className="px-3 py-2 text-[10.5px] font-semibold text-[#6B7280] uppercase tracking-wide" />
            <SortableTh sortKey="compte" label={compteLabel} activeKey={sortKey} direction={sortDirection} onSort={handleSort}
              className="px-3 py-2 text-[10.5px] font-semibold text-[#6B7280] uppercase tracking-wide" />
            <SortableTh sortKey="libelle" label="Libellé" activeKey={sortKey} direction={sortDirection} onSort={handleSort}
              className="px-3 py-2 text-[10.5px] font-semibold text-[#6B7280] uppercase tracking-wide" />
            <th className="text-left px-3 py-2 text-[10.5px] font-semibold text-[#6B7280] uppercase tracking-wide">Source</th>
            <SortableTh sortKey="debit" label="Débit" activeKey={sortKey} direction={sortDirection} onSort={handleSort} align="right"
              className="px-3 py-2 text-[10.5px] font-semibold text-[#6B7280] uppercase tracking-wide" />
            <SortableTh sortKey="credit" label="Crédit" activeKey={sortKey} direction={sortDirection} onSort={handleSort} align="right"
              className="px-3 py-2 text-[10.5px] font-semibold text-[#6B7280] uppercase tracking-wide" />
            <SortableTh sortKey="journal" label="Journal" activeKey={sortKey} direction={sortDirection} onSort={handleSort}
              className="px-3 py-2 text-[10.5px] font-semibold text-[#6B7280] uppercase tracking-wide" />
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr><td colSpan={8} className="empty-cell">Aucune écriture pour cette période.</td></tr>
          ) : sorted.map((row, idx) => (
            <tr key={idx} className="border-b border-[rgba(0,0,0,0.04)] hover:bg-[#FAFAF6]">
              <td className="px-3 py-2 text-[12px] text-[#374151]">{fmtDate(row.date)}</td>
              <td className="px-3 py-2 text-[12px] text-[#374151]">{row.numero_piece || "—"}</td>
              <td className="px-3 py-2 text-[12px] font-mono text-[#374151]">{row.compte || "—"}</td>
              <td className="px-3 py-2 text-[12px] text-[#374151]">{row.libelle}</td>
              <td className="px-3 py-2">
                {row.href ? (
                  <Link href={row.href}><SourceBadge source={row.source} /></Link>
                ) : (
                  <SourceBadge source={row.source} />
                )}
              </td>
              <td className="px-3 py-2 text-right text-[12px] tabular-nums text-[#374151]">{row.debit > 0 ? fmt(row.debit) : ""}</td>
              <td className="px-3 py-2 text-right text-[12px] tabular-nums text-[#374151]">{row.credit > 0 ? fmt(row.credit) : ""}</td>
              <td className="px-3 py-2 text-[11px] font-semibold text-[#6B7280]">{row.journal}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-[#F9F9F6] border-t border-[rgba(0,0,0,0.08)]">
            <td colSpan={5} className="px-3 py-2 text-right text-[12px] font-semibold text-[#1A1A2E]">Total</td>
            <td className="px-3 py-2 text-right text-[12px] font-bold tabular-nums text-[#1A1A2E]">{fmt(totalDebit)}</td>
            <td className="px-3 py-2 text-right text-[12px] font-bold tabular-nums text-[#1A1A2E]">{fmt(totalCredit)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
