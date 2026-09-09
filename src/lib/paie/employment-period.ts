export type PayrollEligibilityReason =
  | "missing_hire_date"
  | "hired_after_period"
  | "contract_ended_before_period"
  | "inactive_without_end_date";

type EmployeePeriodData = {
  date_embauche?: string | null;
  date_fin_contrat?: string | null;
  statut?: string | null;
  is_active?: boolean | null;
};

export type PayrollEligibility =
  | { eligible: true; reason: null }
  | { eligible: false; reason: PayrollEligibilityReason };

export const PAYROLL_ELIGIBILITY_LABELS: Record<PayrollEligibilityReason, string> = {
  missing_hire_date: "Date d’embauche manquante",
  hired_after_period: "Embauche après la période",
  contract_ended_before_period: "Contrat terminé avant la période",
  inactive_without_end_date: "Salarié inactif sans date de fin de contrat",
};

export function getPayrollPeriodBounds(month: number, year: number) {
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 1900 || year > 9999) {
    throw new RangeError("Période de paie invalide");
  }

  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const end = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

function isoDate(value?: string | null) {
  const date = value?.slice(0, 10) ?? "";
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

export function getEmployeePayrollEligibility(
  employee: EmployeePeriodData,
  month: number,
  year: number,
): PayrollEligibility {
  const { start, end } = getPayrollPeriodBounds(month, year);
  const hireDate = isoDate(employee.date_embauche);
  const endDate = isoDate(employee.date_fin_contrat);

  if (!hireDate) return { eligible: false, reason: "missing_hire_date" };
  if (hireDate > end) return { eligible: false, reason: "hired_after_period" };
  if (endDate && endDate < start) return { eligible: false, reason: "contract_ended_before_period" };

  const explicitlyInactive = employee.is_active === false
    || (!!employee.statut && employee.statut !== "actif");
  if (explicitlyInactive && !endDate) {
    return { eligible: false, reason: "inactive_without_end_date" };
  }

  return { eligible: true, reason: null };
}
