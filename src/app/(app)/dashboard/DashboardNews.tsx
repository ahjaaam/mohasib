"use client";

// ─── Types ──────────────────────────────────────────────────────────────────

interface DeadlineItem {
  id: string;
  icon: string;
  title: string;
  dueDate: Date;
  daysUntil: number;
  link: string;
}

// ─── Fiscal Calendar (auto-calculated) ──────────────────────────────────────

function nextDayOfMonth(day: number, from: Date): Date {
  const y = from.getFullYear();
  const m = from.getMonth();
  let d = new Date(y, m, day);
  if (d <= from) d = new Date(y, m + 1, day);
  return d;
}

function nextLastDayOfMonth(from: Date): Date {
  const y = from.getFullYear();
  const m = from.getMonth();
  let d = new Date(y, m + 1, 0);
  if (d <= from) d = new Date(y, m + 2, 0);
  return d;
}

function daysUntilDate(date: Date, from: Date): number {
  return Math.ceil((date.getTime() - from.getTime()) / 86400000);
}

function fmtDate(date: Date): string {
  return date.toLocaleDateString("fr-MA", { day: "numeric", month: "long", year: "numeric" });
}

function computeDeadlines(now: Date): DeadlineItem[] {
  const items: DeadlineItem[] = [];

  const tvaDate = nextDayOfMonth(20, now);
  items.push({
    id: "tva-mensuelle",
    icon: "📅",
    title: "Déclaration TVA mensuelle",
    dueDate: tvaDate,
    daysUntil: daysUntilDate(tvaDate, now),
    link: "https://tax.gov.ma",
  });

  const cnssDate = nextLastDayOfMonth(now);
  items.push({
    id: "cnss",
    icon: "📋",
    title: "Déclaration CNSS mensuelle",
    dueDate: cnssDate,
    daysUntil: daysUntilDate(cnssDate, now),
    link: "https://www.cnss.ma",
  });

  const isSchedule = [
    { m: 2, d: 31, q: 1 }, { m: 5, d: 30, q: 2 },
    { m: 8, d: 30, q: 3 }, { m: 11, d: 31, q: 4 },
    { m: 14, d: 31, q: 1 }, { m: 17, d: 30, q: 2 },
  ];
  for (const s of isSchedule) {
    const year = now.getFullYear() + (s.m >= 12 ? 1 : 0);
    const month = s.m % 12;
    const candidate = new Date(year, month, s.d);
    if (candidate > now) {
      items.push({
        id: "is-acompte",
        icon: "🏢",
        title: `Acompte IS — T${s.q}`,
        dueDate: candidate,
        daysUntil: daysUntilDate(candidate, now),
        link: "https://tax.gov.ma",
      });
      break;
    }
  }

  let irDate = new Date(now.getFullYear(), 1, 28);
  if (irDate <= now) irDate = new Date(now.getFullYear() + 1, 1, 28);
  items.push({
    id: "ir-annuel",
    icon: "📊",
    title: "Déclaration IR annuelle",
    dueDate: irDate,
    daysUntil: daysUntilDate(irDate, now),
    link: "https://tax.gov.ma",
  });

  let tpDate = new Date(now.getFullYear(), 0, 31);
  if (tpDate <= now) tpDate = new Date(now.getFullYear() + 1, 0, 31);
  items.push({
    id: "taxe-pro",
    icon: "🏪",
    title: "Taxe professionnelle",
    dueDate: tpDate,
    daysUntil: daysUntilDate(tpDate, now),
    link: "https://tax.gov.ma",
  });

  return items.sort((a, b) => a.daysUntil - b.daysUntil).slice(0, 4);
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function DashboardNews() {
  const now = new Date();
  const deadlines = computeDeadlines(now);

  return (
    <div>
      <div className="mb-2.5">
        <span className="text-[13px] font-semibold text-[#1A1A2E]">Actualités fiscales</span>
        <div className="text-[10.5px] text-[#9CA3AF] mt-0.5">Maroc 🇲🇦 — DGI & comptabilité</div>
      </div>

      <div className="text-[9.5px] uppercase tracking-[0.8px] text-[#9CA3AF] font-semibold mb-1.5">
        Prochaines échéances
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {deadlines.map((d) => {
          const days = d.daysUntil;
          const barColor = days < 7 ? "#DC2626" : days < 20 ? "#F59E0B" : days < 30 ? "#C8924A" : "#059669";
          const textColor = days < 7 ? "text-[#DC2626]" : days < 20 ? "text-[#F59E0B]" : days < 30 ? "text-[#C8924A]" : "text-[#059669]";
          const pct = Math.max(3, Math.min(95, (1 - days / 60) * 100));

          return (
            <a
              key={d.id}
              href={d.link}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white border border-[rgba(0,0,0,0.07)] rounded-xl px-3 py-2.5 block hover:border-[rgba(0,0,0,0.13)] transition-colors no-underline"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm flex-shrink-0">{d.icon}</span>
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
                  {days}j
                </span>
              </div>
              <div className="mt-2 h-[3px] bg-[#F3F4F6] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, backgroundColor: barColor }}
                />
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
