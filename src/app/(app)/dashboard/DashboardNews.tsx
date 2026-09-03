"use client";

import { mergeDashboardDeadlines, parseDeadlineDate, type DashboardDeadline } from "@/lib/dashboard-deadlines";

function daysUntilDate(date: Date, from: Date): number {
  return Math.ceil((date.getTime() - from.getTime()) / 86400000);
}

const DATE_COLORS = [
  { background: "#FFF1DC", day: "#7A4312", month: "#A56628" },
  { background: "#E8F2FF", day: "#1E4F8A", month: "#5279A8" },
  { background: "#E8F7EF", day: "#196548", month: "#4B8A70" },
  { background: "#F2EBFF", day: "#5D3C8C", month: "#8065A7" },
  { background: "#FFECEF", day: "#8C3D4D", month: "#AD6976" },
  { background: "#E6F6F7", day: "#24666B", month: "#568C90" },
];

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
    .filter(item => item.daysUntil >= 0)
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 4);

  return (
    <div className="grid flex-1 auto-rows-fr grid-cols-2 overflow-hidden border border-[rgba(0,0,0,0.08)] bg-white">
      {deadlines.length === 0 && (
        <div className="col-span-2 flex h-full flex-col items-center justify-center px-4 text-center">
          <div className="text-[12px] font-semibold text-[#1A1A2E]">Aucune échéance à venir</div>
          <div className="mt-1 text-[10.5px] text-[#9CA3AF]">Configurez vos rappels dans les paramètres</div>
        </div>
      )}
      {deadlines.map((d, index) => {
        const days = d.daysUntil;
        const dateColor = DATE_COLORS[index % DATE_COLORS.length];
        const urgent = days <= 7;
        const approaching = days > 7 && days <= 20;
        const statusClass = urgent
          ? "bg-[#FEF2F2] text-[#B91C1C]"
          : approaching
            ? "bg-[#FFF7E8] text-[#9A631C]"
            : "bg-[#F1F3F6] text-[#39445A]";
        const statusLabel = days === 0 ? "Aujourd'hui" : `J-${days}`;
        const cardClassName = `flex min-w-0 items-center gap-2.5 px-3 py-2 no-underline transition-colors ${
          index % 2 === 1 ? "border-l border-[rgba(0,0,0,0.07)]" : ""
        } ${index >= 2 ? "border-t border-[rgba(0,0,0,0.07)]" : ""}`;
        const accessibleLabel = `${d.title}, ${d.dueDate.toLocaleDateString("fr-MA", { day: "numeric", month: "long", year: "numeric" })}, ${statusLabel}`;
        const content = (
          <>
            <time
              dateTime={d.date}
              className="flex h-10 w-10 flex-shrink-0 flex-col items-center justify-center leading-none"
              style={{ backgroundColor: dateColor.background }}
            >
              <span className="text-[15px] font-bold" style={{ color: dateColor.day }}>
                {d.dueDate.getDate()}
              </span>
              <span
                className="mt-1 text-[8px] font-bold uppercase tracking-[0.5px]"
                style={{ color: dateColor.month }}
              >
                {d.dueDate.toLocaleDateString("fr-MA", { month: "short" }).replace(".", "")}
              </span>
            </time>

            <div className="min-w-0 flex-1">
              <div className="line-clamp-2 text-[11.5px] font-semibold leading-[1.3] text-[#1A1A2E]">
                {d.title}
              </div>
              <span className={`mt-1 inline-flex px-1.5 py-0.5 text-[9px] font-bold ${statusClass}`}>
                {statusLabel}
              </span>
            </div>
          </>
        );

        return d.link ? (
          <a
            key={d.id}
            href={d.link}
            target="_blank"
            rel="noopener noreferrer"
            className={`${cardClassName} cursor-pointer hover:bg-[#FAFAF6]`}
            aria-label={accessibleLabel}
          >
            {content}
          </a>
        ) : (
          <div key={d.id} className={`${cardClassName} cursor-default`} aria-label={accessibleLabel}>
            {content}
          </div>
        );
      })}
    </div>
  );
}
