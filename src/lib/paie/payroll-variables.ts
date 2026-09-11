export interface PayrollHoursRow {
  employee_id: string;
  heures_normales?: number | string | null;
  heures_theoriques?: number | string | null;
  heures_sup_25?: number | string | null;
  heures_sup_50?: number | string | null;
  heures_sup_100?: number | string | null;
  jours_absence?: number | string | null;
  heures_absence?: number | string | null;
  montant_heures_sup?: number | string | null;
  montant_absence_deduit?: number | string | null;
}

export interface PayrollEarningRow {
  employee_id: string;
  prime_type: string;
  montant: number | string;
  is_imposable?: boolean | null;
  is_soumis_cnss?: boolean | null;
}

export interface PayrollLeaveRow {
  employee_id: string;
  date_debut: string;
  date_fin: string;
  nombre_jours?: number | string | null;
  impact_salaire?: number | string | null;
}

export interface PayrollVariables {
  heures_normales: number;
  heures_theoriques: number;
  heures_sup_25: number;
  heures_sup_50: number;
  heures_sup_100: number;
  jours_absence: number;
  heures_absence: number;
  montant_heures_sup: number;
  montant_absence_deduit: number;
  primes: number;
  indemnites: number;
  elements_imposables: number;
  elements_soumis_cnss: number;
}

export interface PayrollCalculationSummary {
  proration_factor?: number;
  salaire_base: number;
  retenue_absence: number;
  base_cnss: number;
  salaire_net_imposable: number;
  deduction_charge_famille: number;
  salaire_net_payer: number;
  cout_total_employeur: number;
}

function amount(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function emptyVariables(): PayrollVariables {
  return {
    heures_normales: 0,
    heures_theoriques: 0,
    heures_sup_25: 0,
    heures_sup_50: 0,
    heures_sup_100: 0,
    jours_absence: 0,
    heures_absence: 0,
    montant_heures_sup: 0,
    montant_absence_deduit: 0,
    primes: 0,
    indemnites: 0,
    elements_imposables: 0,
    elements_soumis_cnss: 0,
  };
}

export function isAllowanceType(type: string): boolean {
  return type.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes("indemnit");
}

export function aggregatePayrollVariables(
  employeeIds: string[],
  hoursRows: PayrollHoursRow[],
  earningRows: PayrollEarningRow[],
  leaveRows: PayrollLeaveRow[] = [],
  period?: { mois: number; annee: number; holidayDates?: string[] },
): Map<string, PayrollVariables> {
  const byEmployee = new Map(employeeIds.map((id) => [id, emptyVariables()]));

  for (const row of hoursRows) {
    const variables = byEmployee.get(row.employee_id);
    if (!variables) continue;
    variables.heures_normales = amount(row.heures_normales);
    variables.heures_theoriques = amount(row.heures_theoriques);
    variables.heures_sup_25 = amount(row.heures_sup_25);
    variables.heures_sup_50 = amount(row.heures_sup_50);
    variables.heures_sup_100 = amount(row.heures_sup_100);
    variables.jours_absence = amount(row.jours_absence);
    variables.heures_absence = amount(row.heures_absence);
    variables.montant_heures_sup = amount(row.montant_heures_sup);
    variables.montant_absence_deduit = amount(row.montant_absence_deduit);
  }

  for (const row of earningRows) {
    const variables = byEmployee.get(row.employee_id);
    if (!variables) continue;
    const value = amount(row.montant);
    if (isAllowanceType(row.prime_type)) variables.indemnites += value;
    else variables.primes += value;
    if (row.is_imposable === true) variables.elements_imposables += value;
    if (row.is_soumis_cnss === true) variables.elements_soumis_cnss += value;
  }


  if (period) {
    for (const row of leaveRows) {
      const variables = byEmployee.get(row.employee_id);
      if (!variables) continue;
      // A manual hours deduction and an approved leave can describe the same
      // absence. Manual time input is authoritative when present.
      if (variables.montant_absence_deduit === 0) {
        variables.montant_absence_deduit += monthlyLeaveImpact(row, period.mois, period.annee, period.holidayDates);
      }
    }
  }

  return byEmployee;
}

export function recalculatePayrollVariableAmounts(variables: PayrollVariables, monthlySalary: number): PayrollVariables {
  const theoretical = variables.heures_theoriques || 191.33;
  const hourlyRate = theoretical > 0 ? Math.max(0, monthlySalary) / theoretical : 0;
  return {
    ...variables,
    montant_heures_sup: Math.round((
      variables.heures_sup_25 * hourlyRate * 1.25
      + variables.heures_sup_50 * hourlyRate * 1.5
      + variables.heures_sup_100 * hourlyRate * 2
    ) * 100) / 100,
    montant_absence_deduit: variables.heures_absence > 0
      ? Math.round(variables.heures_absence * hourlyRate * 100) / 100
      : variables.montant_absence_deduit,
  };
}

export function monthlyLeaveImpact(row: PayrollLeaveRow, mois: number, annee: number, holidayDates: string[] = []): number {
  const start = new Date(`${row.date_debut}T00:00:00Z`);
  const end = new Date(`${row.date_fin}T00:00:00Z`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start > end) return 0;

  const periodStart = new Date(Date.UTC(annee, mois - 1, 1));
  const periodEnd = new Date(Date.UTC(annee, mois, 0));
  const overlapStart = start > periodStart ? start : periodStart;
  const overlapEnd = end < periodEnd ? end : periodEnd;
  if (overlapStart > overlapEnd) return 0;

  const storedDays = amount(row.nombre_jours);
  const holidays = new Set(holidayDates);
  const totalDays = storedDays || countWorkingDays(start, end, holidays);
  if (totalDays <= 0) return 0;
  const overlapDays = countWorkingDays(overlapStart, overlapEnd, holidays);
  return Math.round((amount(row.impact_salaire) * overlapDays / totalDays) * 100) / 100;
}

function countWorkingDays(start: Date, end: Date, holidays: Set<string>): number {
  let count = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    if (cursor.getUTCDay() !== 0 && !holidays.has(cursor.toISOString().slice(0, 10))) count += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

export function payrollBulletinDetailFields(
  variables: PayrollVariables,
  calculation: PayrollCalculationSummary,
  contractualMonthlySalary?: number,
) {
  const weighted25 = variables.heures_sup_25 * 1.25;
  const weighted50 = variables.heures_sup_50 * 1.5;
  const weighted100 = variables.heures_sup_100 * 2;
  const weightedTotal = weighted25 + weighted50 + weighted100;
  const overtimePart = (weighted: number) => weightedTotal > 0
    ? Math.round((variables.montant_heures_sup * weighted / weightedTotal) * 100) / 100
    : 0;
  const theoretical = variables.heures_theoriques || 191.33;

  return {
    salaire_base: calculation.salaire_base,
    heures_theoriques: theoretical,
    heures_travaillees: variables.heures_normales || Math.round(theoretical * (calculation.proration_factor ?? 1) * 100) / 100,
    taux_horaire: theoretical > 0
      ? Math.round(((contractualMonthlySalary ?? calculation.salaire_base) / theoretical) * 100) / 100
      : 0,
    heures_sup_25: variables.heures_sup_25,
    montant_sup_25: overtimePart(weighted25),
    heures_sup_50: variables.heures_sup_50,
    montant_sup_50: overtimePart(weighted50),
    heures_sup_100: variables.heures_sup_100,
    montant_sup_100: overtimePart(weighted100),
    jours_absence: variables.jours_absence,
    montant_absence_deduit: calculation.retenue_absence,
    total_primes: variables.primes,
    total_indemnites: variables.indemnites,
    base_cnss: calculation.base_cnss,
    net_imposable: calculation.salaire_net_imposable,
    deduction_familiale: calculation.deduction_charge_famille,
    net_a_payer: calculation.salaire_net_payer,
    cout_employeur: calculation.cout_total_employeur,
  };
}

export async function loadPayrollVariables(
  supabase: any,
  employeeIds: string[],
  mois: number,
  annee: number,
): Promise<Map<string, PayrollVariables>> {
  if (!employeeIds.length) return new Map();

  const periodStart = `${annee}-${String(mois).padStart(2, "0")}-01`;
  const periodEnd = new Date(Date.UTC(annee, mois, 0)).toISOString().slice(0, 10);
  const [hoursResult, earningsResult, leavesResult, holidaysResult] = await Promise.all([
    supabase
      .from("employee_heures")
      .select("employee_id, heures_normales, heures_theoriques, heures_sup_25, heures_sup_50, heures_sup_100, jours_absence, heures_absence, montant_heures_sup, montant_absence_deduit")
      .eq("mois", mois)
      .eq("annee", annee)
      .in("employee_id", employeeIds),
    supabase
      .from("employee_primes")
      .select("employee_id, prime_type, montant, is_imposable, is_soumis_cnss")
      .eq("mois", mois)
      .eq("annee", annee)
      .in("employee_id", employeeIds),
    supabase
      .from("employee_leaves")
      .select("employee_id, date_debut, date_fin, nombre_jours, impact_salaire")
      .eq("is_paid", false)
      .eq("statut", "approuvé")
      .lte("date_debut", periodEnd)
      .gte("date_fin", periodStart)
      .in("employee_id", employeeIds),
    supabase.from("jours_feries").select("date").gte("date", periodStart).lte("date", periodEnd),
  ]);

  if (hoursResult.error) throw new Error(hoursResult.error.message);
  if (earningsResult.error) throw new Error(earningsResult.error.message);
  if (leavesResult.error) throw new Error(leavesResult.error.message);
  if (holidaysResult.error) throw new Error(holidaysResult.error.message);

  return aggregatePayrollVariables(
    employeeIds,
    (hoursResult.data ?? []) as PayrollHoursRow[],
    (earningsResult.data ?? []) as PayrollEarningRow[],
    (leavesResult.data ?? []) as PayrollLeaveRow[],
    { mois, annee, holidayDates: (holidaysResult.data ?? []).map((holiday: any) => holiday.date) },
  );
}
