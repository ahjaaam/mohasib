"use client";

import { mergeDashboardDeadlines, parseDeadlineDate, type DashboardDeadline } from "@/lib/dashboard-deadlines";

function daysUntilDate(date: Date, from: Date): number {
  return Math.ceil((date.getTime() - from.getTime()) / 86400000);
}

function fmtDate(date: Date): string {
  return date.toLocaleDateString("fr-MA", { day: "numeric", month: "long", year: "numeric" });
}

export default function DashboardNews({
  deadlines: savedDeadlines,
  tvaRegime,
  tvaAssujetti,
}: {
  deadlines: DashboardDeadline[] | null;
  tvaRegime?: string | null;
  tvaAssujetti?: boolean | null;
}) {
  const now = new Date();
  const deadlines = mergeDashboardDeadlines(savedDeadlines, now, { tvaRegime, tvaAssujetti })
    .map(item => {
      const dueDate = parseDeadlineDate(item.date);
      return { ...item, dueDate, daysUntil: daysUntilDate(dueDate, now) };
    })
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 4);

  return (
    <div className="grid grid-cols-2 gap-2">
      {deadlines.length === 0 && (
        <div className="col-span-2 bg-white border border-dashed border-[rgba(0,0,0,0.12)] rounded-xl px-3 py-7 text-center text-[11.5px] text-[#9CA3AF]">
          Aucune échéance configurée
        </div>
      )}
      {deadlines.map((d) => {
        const days = d.daysUntil;
        const barColor = days < 7 ? "#DC2626" : days < 20 ? "#F59E0B" : days < 30 ? "#C8924A" : "#059669";
        const textColor = days < 7 ? "text-[#DC2626]" : days < 20 ? "text-[#F59E0B]" : days < 30 ? "text-[#C8924A]" : "text-[#059669]";
        const pct = Math.max(3, Math.min(95, (1 - days / 60) * 100));

        return (
          <a
            key={d.id}
            href={d.link || undefined}
            target={d.link ? "_blank" : undefined}
            rel={d.link ? "noopener noreferrer" : undefined}
            className="bg-white border border-[rgba(0,0,0,0.07)] rounded-xl px-3 py-2.5 block hover:border-[rgba(0,0,0,0.13)] transition-colors no-underline"
            style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
<div className="min-w-0">
                  <div className="text-[12px] font-semibold text-[#1A1A2E] leading-snug">
                    {d.title}
                  </div>
                  <div className="text-[10.5px] text-[#6B7280]">
                    {fmtDate(d.dueDate)}
                  </div>
                </div>
              </div>
              <span className={`flex-shrink-0 text-[11px] font-bold ${textColor} whitespace-nowrap`}>
                {days < 0 ? "En retard" : days === 0 ? "Aujourd'hui" : `${days}j`}
              </span>
            </div>
            <div className="mt-2 h-[5px] bg-[#E5E7EB] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, backgroundColor: barColor }}
              />
            </div>
          </a>
        );
      })}
    </div>
  );
}
