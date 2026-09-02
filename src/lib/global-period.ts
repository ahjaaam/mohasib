export type GlobalPeriodPreset = "this_month" | "previous_month" | "this_quarter" | "this_year" | "custom" | "all";

export type GlobalPeriod = {
  preset: GlobalPeriodPreset;
  start: string;
  end: string;
};

export const GLOBAL_PERIOD_STORAGE_KEY = "mohasib_global_period";
export const GLOBAL_PERIOD_EVENT = "mohasib:global-period-change";

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function monthRange(year: number, month: number): Pick<GlobalPeriod, "start" | "end"> {
  const firstDay = new Date(year, month, 1);
  const normalizedYear = firstDay.getFullYear();
  const normalizedMonth = firstDay.getMonth();
  return {
    start: isoDate(normalizedYear, normalizedMonth, 1),
    end: isoDate(normalizedYear, normalizedMonth, new Date(normalizedYear, normalizedMonth + 1, 0).getDate()),
  };
}

export function periodForPreset(preset: Exclude<GlobalPeriodPreset, "custom">, now = new Date()): GlobalPeriod {
  const year = now.getFullYear();
  const month = now.getMonth();

  if (preset === "all") return { preset, start: "", end: "" };
  if (preset === "this_year") return { preset, start: isoDate(year, 0, 1), end: isoDate(year, 11, 31) };
  if (preset === "this_quarter") {
    const firstMonth = Math.floor(month / 3) * 3;
    return {
      preset,
      start: isoDate(year, firstMonth, 1),
      end: isoDate(year, firstMonth + 2, new Date(year, firstMonth + 3, 0).getDate()),
    };
  }
  if (preset === "previous_month") return { preset, ...monthRange(year, month - 1) };
  return { preset: "this_month", ...monthRange(year, month) };
}

export function defaultGlobalPeriod(now = new Date()) {
  return periodForPreset("this_year", now);
}

export function isGlobalPeriod(value: unknown): value is GlobalPeriod {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<GlobalPeriod>;
  const presets: GlobalPeriodPreset[] = ["this_month", "previous_month", "this_quarter", "this_year", "custom", "all"];
  return Boolean(
    candidate.preset && presets.includes(candidate.preset)
      && typeof candidate.start === "string"
      && typeof candidate.end === "string"
      && (candidate.preset === "all" || /^\d{4}-\d{2}-\d{2}$/.test(candidate.start))
      && (candidate.preset === "all" || /^\d{4}-\d{2}-\d{2}$/.test(candidate.end))
  );
}

export function parseGlobalPeriod(value?: string | null): GlobalPeriod {
  if (!value) return defaultGlobalPeriod();
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(value));
    return isGlobalPeriod(parsed) ? parsed : defaultGlobalPeriod();
  } catch {
    return defaultGlobalPeriod();
  }
}

export function globalPeriodLabel(period: GlobalPeriod) {
  const labels: Record<Exclude<GlobalPeriodPreset, "custom">, string> = {
    this_month: "Ce mois",
    previous_month: "Mois précédent",
    this_quarter: "Ce trimestre",
    this_year: "Cette année",
    all: "Toutes les dates",
  };
  if (period.preset !== "custom") return labels[period.preset];
  const format = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  return `${format(period.start)} – ${format(period.end)}`;
}
