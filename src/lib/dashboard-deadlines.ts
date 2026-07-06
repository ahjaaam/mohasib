export interface DashboardDeadline {
  id: string;
  title: string;
  date: string;
  link?: string;
  source?: "automatic" | "manual";
}

type DashboardDeadlineOptions = {
  tvaRegime?: string | null;
  tvaAssujetti?: boolean | null;
};

const AUTOMATIC_DEADLINE_IDS = new Set([
  "tva",
  "tva-mensuelle",
  "tva-trimestrielle",
  "cnss",
  "is-acompte",
  "ir-annuel",
  "taxe-pro",
]);

function toDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function nextDayOfMonth(day: number, from: Date) {
  const next = new Date(from.getFullYear(), from.getMonth(), day);
  return next <= from ? new Date(from.getFullYear(), from.getMonth() + 1, day) : next;
}

function nextLastDayOfMonth(from: Date) {
  const next = new Date(from.getFullYear(), from.getMonth() + 1, 0);
  return next <= from ? new Date(from.getFullYear(), from.getMonth() + 2, 0) : next;
}

function nextQuarterlyTvaDeadline(from: Date) {
  const dueMonths = [0, 3, 6, 9];
  for (let offset = 0; offset <= 12; offset += 1) {
    const month = from.getMonth() + offset;
    const normalizedMonth = month % 12;
    if (!dueMonths.includes(normalizedMonth)) continue;
    const year = from.getFullYear() + Math.floor(month / 12);
    const candidate = new Date(year, normalizedMonth, 20);
    if (candidate > from) return candidate;
  }
  return new Date(from.getFullYear() + 1, 0, 20);
}

export function getDefaultDashboardDeadlines(now = new Date(), options: DashboardDeadlineOptions = {}): DashboardDeadline[] {
  const isSchedule = [
    { month: 2, day: 31, quarter: 1 },
    { month: 5, day: 30, quarter: 2 },
    { month: 8, day: 30, quarter: 3 },
    { month: 11, day: 31, quarter: 4 },
    { month: 14, day: 31, quarter: 1 },
  ];
  const nextIs = isSchedule.find(({ month, day }) => {
    const year = now.getFullYear() + (month >= 12 ? 1 : 0);
    return new Date(year, month % 12, day) > now;
  })!;

  let irDate = new Date(now.getFullYear(), 1, 28);
  if (irDate <= now) irDate = new Date(now.getFullYear() + 1, 1, 28);

  let professionalTaxDate = new Date(now.getFullYear(), 0, 31);
  if (professionalTaxDate <= now) professionalTaxDate = new Date(now.getFullYear() + 1, 0, 31);

  const regime = options.tvaRegime?.toLowerCase() === "trimestriel" ? "trimestriel" : "mensuel";
  const deadlines: DashboardDeadline[] = [
    { id: "cnss", title: "Déclaration CNSS mensuelle", date: toDateInput(nextLastDayOfMonth(now)), link: "https://www.cnss.ma", source: "automatic" },
    {
      id: "is-acompte",
      title: `Acompte IS — T${nextIs.quarter}`,
      date: toDateInput(new Date(now.getFullYear() + (nextIs.month >= 12 ? 1 : 0), nextIs.month % 12, nextIs.day)),
      link: "https://tax.gov.ma",
      source: "automatic",
    },
    { id: "ir-annuel", title: "Déclaration IR annuelle", date: toDateInput(irDate), link: "https://tax.gov.ma", source: "automatic" },
    { id: "taxe-pro", title: "Taxe professionnelle", date: toDateInput(professionalTaxDate), link: "https://tax.gov.ma", source: "automatic" },
  ];

  if (options.tvaAssujetti !== false) {
    deadlines.unshift({
      id: "tva",
      title: regime === "trimestriel" ? "Déclaration TVA trimestrielle" : "Déclaration TVA mensuelle",
      date: toDateInput(regime === "trimestriel" ? nextQuarterlyTvaDeadline(now) : nextDayOfMonth(20, now)),
      link: "https://tax.gov.ma",
      source: "automatic",
    });
  }

  return deadlines;
}

export function parseDeadlineDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function mergeDashboardDeadlines(
  savedDeadlines: DashboardDeadline[] | null | undefined,
  now = new Date(),
  options: DashboardDeadlineOptions = {},
): DashboardDeadline[] {
  const automatic = getDefaultDashboardDeadlines(now, options);
  const saved = savedDeadlines ?? [];
  const savedById = new Map(saved.map(item => [item.id, item]));

  const mergedAutomatic = automatic.map(item => {
    const legacyTvaOverride = item.id === "tva"
      ? savedById.get("tva-mensuelle") ?? savedById.get("tva-trimestrielle")
      : undefined;
    const override = savedById.get(item.id) ?? legacyTvaOverride;
    return {
      ...item,
      title: override?.title?.trim() || item.title,
      link: override?.link ?? item.link,
      source: "automatic" as const,
    };
  });

  const manual = saved
    .filter(item => !AUTOMATIC_DEADLINE_IDS.has(item.id) && item.source !== "automatic")
    .map(item => ({ ...item, source: "manual" as const }));

  return [...mergedAutomatic, ...manual];
}
