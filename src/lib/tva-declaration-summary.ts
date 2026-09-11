export type VatDeclarationStatus = "not_started" | "draft" | "validated" | "filed";

export interface VatDeclarationPeriod {
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  deadline: string;
  queryPeriod: string;
}

const MONTHS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
] as const;

function isoDate(year: number, monthIndex: number, day: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseIsoMonth(value: string) {
  const match = /^(\d{4})-(\d{2})/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (!Number.isInteger(year) || monthIndex < 0 || monthIndex > 11) return null;
  return { year, monthIndex };
}

export function vatDeclarationPeriod(regime: string | null | undefined, anchorDate: string): VatDeclarationPeriod {
  const parsed = parseIsoMonth(anchorDate);
  if (!parsed) throw new Error("Invalid VAT period anchor date");

  const { year, monthIndex } = parsed;
  const quarterly = regime === "Trimestriel";
  const startMonth = quarterly ? Math.floor(monthIndex / 3) * 3 : monthIndex;
  const endMonth = quarterly ? startMonth + 2 : startMonth;
  const endDay = new Date(Date.UTC(year, endMonth + 1, 0)).getUTCDate();
  const deadlineMonth = endMonth + 1;
  const deadlineYear = year + Math.floor(deadlineMonth / 12);
  const normalizedDeadlineMonth = deadlineMonth % 12;
  const quarter = Math.floor(startMonth / 3) + 1;

  return {
    periodStart: isoDate(year, startMonth, 1),
    periodEnd: isoDate(year, endMonth, endDay),
    periodLabel: quarterly ? `T${quarter} ${year}` : `${MONTHS_FR[startMonth]} ${year}`,
    deadline: isoDate(deadlineYear, normalizedDeadlineMonth, 20),
    queryPeriod: `${year}-${String(startMonth + 1).padStart(2, "0")}`,
  };
}

export function normalizeVatDeclarationStatus(value: string | null | undefined): VatDeclarationStatus {
  const normalized = (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

  if (["depose", "deposee", "declare", "declaree", "filed", "submitted"].includes(normalized)) return "filed";
  if (["valide", "validee", "validated", "approved"].includes(normalized)) return "validated";
  if (["brouillon", "draft", "pending"].includes(normalized)) return "draft";
  return "not_started";
}

export function resolveVatDeclarationStatus(
  statut: string | null | undefined,
  legacyStatus: string | null | undefined,
): VatDeclarationStatus {
  const statuses = [normalizeVatDeclarationStatus(statut), normalizeVatDeclarationStatus(legacyStatus)];
  if (statuses.includes("filed")) return "filed";
  if (statuses.includes("validated")) return "validated";
  if (statuses.includes("draft")) return "draft";
  return "not_started";
}

export function vatDeclarationStatusLabel(status: VatDeclarationStatus) {
  if (status === "filed") return "Déposée";
  if (status === "validated") return "Validée";
  if (status === "draft") return "Brouillon";
  return "À préparer";
}
