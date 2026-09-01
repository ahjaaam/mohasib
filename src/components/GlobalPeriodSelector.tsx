"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, Check, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useGlobalPeriod } from "@/hooks/useGlobalPeriod";
import { globalPeriodLabel, periodForPreset, type GlobalPeriodPreset } from "@/lib/global-period";

const PRESETS: Array<{ value: Exclude<GlobalPeriodPreset, "custom">; label: string }> = [
  { value: "this_month", label: "Ce mois" },
  { value: "previous_month", label: "Mois précédent" },
  { value: "this_quarter", label: "Ce trimestre" },
  { value: "this_year", label: "Cette année" },
  { value: "all", label: "Toutes les dates" },
];

export default function GlobalPeriodSelector({ onOpen, align = "right" }: { onOpen?: () => void; align?: "left" | "right" }) {
  const router = useRouter();
  const { period, setPeriod } = useGlobalPeriod();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [start, setStart] = useState(period.start);
  const [end, setEnd] = useState(period.end);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setCustomOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function choosePreset(preset: Exclude<GlobalPeriodPreset, "custom">) {
    const next = periodForPreset(preset);
    setStart(next.start);
    setEnd(next.end);
    setPeriod(next);
    router.refresh();
    setOpen(false);
    setCustomOpen(false);
  }

  function applyCustom() {
    if (!start || !end || start > end) return;
    setPeriod({ preset: "custom", start, end });
    router.refresh();
    setOpen(false);
    setCustomOpen(false);
  }

  return (
    <div ref={rootRef} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => {
          if (!open) onOpen?.();
          if (open) setCustomOpen(false);
          setOpen((value) => !value);
        }}
        className={`app-topbar-period flex h-10 items-center gap-2 border px-2.5 text-[12px] font-semibold transition-colors sm:px-3 ${
          open ? "border-[#C8924A] bg-[#F7F7F3] text-[#8A5E25]" : "border-transparent bg-[#F7F7F3] text-[#4B5260] hover:text-[#8A5E25]"
        }`}
        aria-label={`Période de travail : ${globalPeriodLabel(period)}`}
        aria-expanded={open}
      >
        <CalendarDays size={15} />
        <span className="hidden max-w-[150px] truncate lg:block">{globalPeriodLabel(period)}</span>
        <ChevronDown size={13} className={`hidden transition-transform lg:block ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className={`absolute top-[calc(100%+9px)] z-50 w-[310px] border border-[#DADAD5] border-t-2 border-t-[#C8924A] bg-white p-2 shadow-[0_18px_42px_rgba(13,21,38,0.15)] ${align === "left" ? "left-0" : "right-0"}`}>
          <div className="px-2 pb-1.5 pt-1 text-[9px] font-bold uppercase tracking-[0.9px] text-[#9A9FA8]">Période de travail</div>
          {PRESETS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => choosePreset(item.value)}
              className="flex w-full items-center justify-between px-2 py-2 text-left text-[12.5px] text-[#303644] transition-colors hover:bg-[#F4F3ED]"
            >
              {item.label}
              {period.preset === item.value && <Check size={14} className="text-[#C8924A]" />}
            </button>
          ))}
          <div className="my-1 border-t border-[#ECECE8]" />
          <button
            type="button"
            onClick={() => setCustomOpen((value) => !value)}
            className="flex w-full items-center justify-between px-2 py-2 text-left text-[12.5px] font-semibold text-[#303644] transition-colors hover:bg-[#F4F3ED]"
          >
            Période personnalisée…
            {period.preset === "custom" && <Check size={14} className="text-[#C8924A]" />}
          </button>
          {customOpen && (
            <div className="mt-1 border-t border-[#ECECE8] bg-[#FAFAF7] p-2.5">
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[10px] font-semibold text-[#6B7280]">Du
                  <input type="date" value={start} onChange={(event) => setStart(event.target.value)} className="mt-1 h-9 w-full border border-[#DADAD5] bg-white px-2 text-[11px] text-[#303644] outline-none focus:border-[#C8924A]" />
                </label>
                <label className="text-[10px] font-semibold text-[#6B7280]">Au
                  <input type="date" value={end} onChange={(event) => setEnd(event.target.value)} className="mt-1 h-9 w-full border border-[#DADAD5] bg-white px-2 text-[11px] text-[#303644] outline-none focus:border-[#C8924A]" />
                </label>
              </div>
              {start && end && start > end && <p className="mt-1.5 text-[10px] text-red-600">La date de fin doit suivre la date de début.</p>}
              <button type="button" onClick={applyCustom} disabled={!start || !end || start > end} className="mt-2.5 h-8 w-full bg-[#0D1526] text-[11px] font-bold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40">Appliquer</button>
            </div>
          )}
          <p className="mx-2 mt-1.5 border-t border-[#ECECE8] pt-2 text-[9.5px] leading-4 text-[#9297A0]">Cette période reste active pendant votre session.</p>
        </div>
      )}
    </div>
  );
}
