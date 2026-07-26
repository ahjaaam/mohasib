"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";

export type SortDirection = "asc" | "desc";

interface Props<T extends string> {
  sortKey: T;
  label: string;
  activeKey: T;
  direction: SortDirection;
  onSort: (key: T) => void;
  className?: string;
  align?: "left" | "right" | "center";
}

export default function SortableTh<T extends string>({
  sortKey,
  label,
  activeKey,
  direction,
  onSort,
  className = "",
  align,
}: Props<T>) {
  const active = activeKey === sortKey;
  const Icon = active ? (direction === "asc" ? ArrowUp : ArrowDown) : ChevronsUpDown;
  const numericColumn = /(?:montant|total|prix|solde|débit|crédit|ht|ttc|tva|ca\b)/i.test(label);
  const resolvedAlign = align ?? (numericColumn ? "right" : "left");
  const justify = resolvedAlign === "right" ? "justify-end" : resolvedAlign === "center" ? "justify-center" : "justify-start";

  return (
    <th
      className={`${resolvedAlign === "right" ? "text-right" : resolvedAlign === "center" ? "text-center" : ""} ${className}`}
      aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1.5 ${justify} text-inherit transition hover:text-[#C8924A]`}
      >
        <span>{label}</span>
        <Icon size={12} className={active ? "text-[#C8924A]" : "text-[#9CA3AF]"} />
      </button>
    </th>
  );
}

export function nextSort<T extends string>(
  currentKey: T,
  currentDirection: SortDirection,
  nextKey: T,
): { key: T; direction: SortDirection } {
  if (currentKey === nextKey) {
    return { key: nextKey, direction: currentDirection === "asc" ? "desc" : "asc" };
  }
  return { key: nextKey, direction: "asc" };
}

export function compareValues(a: unknown, b: unknown, direction: SortDirection) {
  const dir = direction === "asc" ? 1 : -1;
  const emptyA = a === null || a === undefined || a === "";
  const emptyB = b === null || b === undefined || b === "";
  if (emptyA && emptyB) return 0;
  if (emptyA) return 1;
  if (emptyB) return -1;

  if (typeof a === "number" && typeof b === "number") return (a - b) * dir;

  const dateA = typeof a === "string" ? Date.parse(a) : NaN;
  const dateB = typeof b === "string" ? Date.parse(b) : NaN;
  if (!Number.isNaN(dateA) && !Number.isNaN(dateB) && /^\d{4}-\d{2}-\d{2}/.test(String(a))) {
    return (dateA - dateB) * dir;
  }

  return String(a).localeCompare(String(b), "fr", { numeric: true, sensitivity: "base" }) * dir;
}
