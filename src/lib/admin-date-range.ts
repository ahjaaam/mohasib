export type AdminDateRange = {
  preset: "day" | "week" | "month" | "all" | "custom";
  from: string | null;
  to: string | null;
  fromInput: string;
  toInput: string;
  label: string;
};

function validDate(value?: string) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)));
}

function dateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function adminDateRange(filters: Record<string, string | undefined>, now = new Date()): AdminDateRange {
  const requested = filters.range;
  const preset: AdminDateRange["preset"] = ["day", "week", "month", "custom"].includes(requested ?? "")
    ? requested as AdminDateRange["preset"]
    : "all";

  if (preset === "all") return { preset, from: null, to: null, fromInput: "", toInput: "", label: "Toutes les périodes" };

  let fromInput = "";
  let toInput = dateInput(now);

  if (preset === "day") fromInput = toInput;
  if (preset === "week") {
    const start = new Date(now);
    start.setUTCDate(start.getUTCDate() - 6);
    fromInput = dateInput(start);
  }
  if (preset === "month") fromInput = `${toInput.slice(0, 8)}01`;
  if (preset === "custom") {
    fromInput = validDate(filters.from) ? filters.from! : "";
    toInput = validDate(filters.to) ? filters.to! : "";
  }

  const from = fromInput ? `${fromInput}T00:00:00.000Z` : null;
  const to = toInput ? `${toInput}T23:59:59.999Z` : null;
  const label = preset === "day" ? "Aujourd’hui"
    : preset === "week" ? "7 derniers jours"
      : preset === "month" ? "Ce mois"
        : fromInput && toInput ? `${fromInput} → ${toInput}`
          : fromInput ? `Depuis le ${fromInput}`
            : toInput ? `Jusqu’au ${toInput}` : "Période personnalisée";

  return { preset, from, to, fromInput, toInput, label };
}

export function inAdminDateRange(value: string | null | undefined, range: AdminDateRange) {
  if (!value) return false;
  return (!range.from || value >= range.from) && (!range.to || value <= range.to);
}
