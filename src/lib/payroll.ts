// ── Moroccan payroll calculation engine ─────────────────────────────────────
// Moroccan private-sector payroll rules, effective-dated by payroll year.

export const SUPPORTED_PAYROLL_YEARS = [2025, 2026] as const;
export type SupportedPayrollYear = typeof SUPPORTED_PAYROLL_YEARS[number];
export type PayrollAmoRegime = "standard" | "solidarity_only";

export interface PayrollRules {
  year: SupportedPayrollYear;
  cnssCeiling: number;
  employeeSocial: number;
  employeeAmo: number;
  employerSocial: number;
  employerFamily: number;
  employerAmo: number;
  employerAmoSolidarity: number;
  employerTraining: number;
  professionalExpenseAnnualCap: number;
  professionalExpenseLowRate: number;
  professionalExpenseHighRate: number;
  professionalExpenseThreshold: number;
  familyDeductionPerDependant: number;
  incomeTaxBrackets: readonly { ceiling: number; rate: number }[];
}

const BASE_PAYROLL_RATES = {
  cnssCeiling: 6000,
  employeeSocial: 0.0448,
  employeeAmo: 0.0226,
  employerSocial: 0.0898,
  employerFamily: 0.064,
  employerAmo: 0.0411,
  employerAmoSolidarity: 0.0185,
  employerTraining: 0.016,
  professionalExpenseAnnualCap: 35000,
  professionalExpenseLowRate: 0.35,
  professionalExpenseHighRate: 0.25,
  professionalExpenseThreshold: 78000,
} as const;

const CURRENT_IR_BRACKETS = [
  { ceiling: 40_000, rate: 0 },
  { ceiling: 60_000, rate: 0.10 },
  { ceiling: 80_000, rate: 0.20 },
  { ceiling: 100_000, rate: 0.30 },
  { ceiling: 180_000, rate: 0.34 },
  { ceiling: Number.POSITIVE_INFINITY, rate: 0.37 },
] as const;

export const PAYROLL_RULES_BY_YEAR: Record<SupportedPayrollYear, PayrollRules> = {
  2025: {
    year: 2025,
    ...BASE_PAYROLL_RATES,
    familyDeductionPerDependant: 500,
    incomeTaxBrackets: CURRENT_IR_BRACKETS,
  },
  2026: {
    year: 2026,
    ...BASE_PAYROLL_RATES,
    familyDeductionPerDependant: 600,
    incomeTaxBrackets: CURRENT_IR_BRACKETS,
  },
};

/** @deprecated Read the effective-dated rules through getPayrollRules(). */
export const PAYROLL_RATES = PAYROLL_RULES_BY_YEAR[2026];

export class UnsupportedPayrollYearError extends Error {
  constructor(year: number) {
    super(`Règles de paie indisponibles pour ${year}. Années prises en charge : ${SUPPORTED_PAYROLL_YEARS.join(", ")}.`);
    this.name = "UnsupportedPayrollYearError";
  }
}

export function isSupportedPayrollYear(year: number): year is SupportedPayrollYear {
  return SUPPORTED_PAYROLL_YEARS.includes(year as SupportedPayrollYear);
}

export function getPayrollRules(year: number): PayrollRules {
  if (!isSupportedPayrollYear(year)) throw new UnsupportedPayrollYearError(year);
  return PAYROLL_RULES_BY_YEAR[year];
}

export interface EmployeeInput {
  salaire_brut: number;
  situation_familiale: string;  // 'Célibataire' | 'Marié(e)' | 'Divorcé(e)' | 'Veuf/Veuve'
  nombre_enfants: number;
  /** Monetary amount of overtime for the payroll period. */
  heures_sup?: number;
  /** Total premiums paid during the payroll period. */
  primes?: number;
  /** Total allowances paid during the payroll period. */
  indemnites?: number;
  /** Salary withheld for unpaid hours or absences. */
  retenue_absence?: number;
  /** Premiums and allowances included in taxable salary. Defaults to premiums. */
  elements_imposables?: number;
  /** Premiums and allowances included in the contribution base. Defaults to premiums. */
  elements_soumis_cnss?: number;
  mois?: number;
  annee?: number;
  date_embauche?: string | null;
  date_fin_contrat?: string | null;
  has_mutuelle?: boolean;
  mutuelle_taux_salarie?: number;
  mutuelle_taux_patronal?: number;
  has_cimr?: boolean;
  cimr_taux_salarie?: number;
  cimr_taux_patronal?: number;
  /** Standard AMO, or the statutory 1.85% solidarity-only employer regime. */
  amo_regime?: PayrollAmoRegime;
  /** Some employers are legally exempt from the vocational-training levy. */
  tfp_exempt?: boolean;
}

export interface BulletinCalculation {
  proration_factor: number;
  salaire_base: number;
  salaire_brut: number;
  heures_sup: number;
  primes: number;
  indemnites: number;
  retenue_absence: number;
  base_cnss: number;
  // Employee deductions
  cnss_salarie: number;
  amo_salarie: number;
  mutuelle_salarie: number;
  cimr_salarie: number;
  frais_pro: number;
  salaire_net_imposable: number;
  // IR
  ir_annuel: number;
  ir_mensuel_brut: number;
  deduction_charge_famille: number;
  ir_net: number;
  // Net pay
  salaire_net_payer: number;
  // Employer charges
  cnss_patronal: number;
  amo_patronal: number;
  mutuelle_patronal: number;
  cimr_patronal: number;
  taxe_formation_pro: number;
  cout_total_employeur: number;
}

export function calculateAnnualIncomeTax(annualTaxableIncome: number, year = 2026): number {
  const rules = getPayrollRules(year);
  const annual = Math.max(0, annualTaxableIncome);
  let lower = 0;
  let tax = 0;
  for (const bracket of rules.incomeTaxBrackets) {
    const taxableSlice = Math.max(0, Math.min(annual, bracket.ceiling) - lower);
    tax += taxableSlice * bracket.rate;
    if (annual <= bracket.ceiling) break;
    lower = bracket.ceiling;
  }
  return round2(tax);
}

export function calculateAnnualFamilyDeduction(situationFamiliale: string, numberOfChildren: number, year = 2026): number {
  const rules = getPayrollRules(year);
  const children = Math.max(0, Math.floor(numberOfChildren));
  const spouse = situationFamiliale === "Marié(e)" ? 1 : 0;
  const dependants = Math.min(children + spouse, 6);
  return dependants * rules.familyDeductionPerDependant;
}

function parseIsoDate(value?: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}/.test(value)) return null;
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function employmentProration(input: Pick<EmployeeInput, "mois" | "annee" | "date_embauche" | "date_fin_contrat">): number {
  if (!input.mois || !input.annee) return 1;
  const start = new Date(Date.UTC(input.annee, input.mois - 1, 1));
  const end = new Date(Date.UTC(input.annee, input.mois, 0));
  const hire = parseIsoDate(input.date_embauche);
  const termination = parseIsoDate(input.date_fin_contrat);
  const activeStart = hire && hire > start ? hire : start;
  const activeEnd = termination && termination < end ? termination : end;
  if (activeStart > activeEnd) return 0;
  const countNonSunday = (from: Date, to: Date) => {
    let count = 0;
    for (const cursor = new Date(from); cursor <= to; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      if (cursor.getUTCDay() !== 0) count += 1;
    }
    return count;
  };
  return Math.min(1, countNonSunday(activeStart, activeEnd) / countNonSunday(start, end));
}

export function calculateSalary(employee: EmployeeInput): BulletinCalculation {
  const payrollYear = employee.annee ?? 2026;
  const rates = getPayrollRules(payrollYear);
  const proration = employmentProration(employee);
  const salaire_base = round2(Math.max(0, employee.salaire_brut) * proration);
  const heures_sup   = Math.max(0, employee.heures_sup  ?? 0);
  const primes       = Math.max(0, employee.primes      ?? 0);
  const indemnites   = Math.max(0, employee.indemnites  ?? 0);
  const retenue_absence = Math.min(
    salaire_base,
    Math.max(0, employee.retenue_absence ?? 0),
  );
  const salaire_apres_absence = salaire_base - retenue_absence;
  const elements_imposables = Math.max(
    0,
    employee.elements_imposables ?? primes,
  );
  const elements_soumis_cnss = Math.max(
    0,
    employee.elements_soumis_cnss ?? primes,
  );

  // Gross cash paid for the period. Tax and contribution bases are kept
  // separate because some allowances can be exempt from one or both.
  const salaire_brut = round2(
    salaire_apres_absence + heures_sup + primes + indemnites,
  );
  const brut_imposable = round2(
    salaire_apres_absence + heures_sup + elements_imposables,
  );
  const base_cnss = round2(
    salaire_apres_absence + heures_sup + elements_soumis_cnss,
  );

  // Only the social-benefit branch is capped. AMO is a separate uncapped branch.
  const cnss_salarie = round2(Math.min(base_cnss, rates.cnssCeiling) * rates.employeeSocial);

  // Step 2 — AMO Salarié 2.26%
  const solidarityOnly = employee.amo_regime === "solidarity_only";
  const amo_salarie = solidarityOnly ? 0 : round2(base_cnss * rates.employeeAmo);
  const mutuelle_salarie = employee.has_mutuelle
    ? round2(base_cnss * Math.max(0, employee.mutuelle_taux_salarie ?? 0) / 100)
    : 0;
  const cimr_salarie = employee.has_cimr
    ? round2(base_cnss * Math.max(0, employee.cimr_taux_salarie ?? 0) / 100)
    : 0;

  const annualGrossTaxable = brut_imposable * 12;
  const professionalExpenseRate = annualGrossTaxable <= rates.professionalExpenseThreshold
    ? rates.professionalExpenseLowRate
    : rates.professionalExpenseHighRate;
  const frais_pro = round2(Math.min(
    brut_imposable * professionalExpenseRate,
    rates.professionalExpenseAnnualCap / 12,
  ));

  // Step 4 — Salaire net imposable
  const salaire_net_imposable = round2(
    brut_imposable - cnss_salarie - amo_salarie - mutuelle_salarie - cimr_salarie - frais_pro
  );

  // Step 5 — IR annuel (barème progressif effective since 2025)
  const annuel = salaire_net_imposable * 12;
  const ir_annuel = calculateAnnualIncomeTax(annuel, payrollYear);
  const ir_mensuel_brut = round2(ir_annuel / 12);

  // Step 6 — Déduction charge de famille
  // Effective-dated family reduction, spouse included (maximum 6 dependants).
  const deduction_annuelle = calculateAnnualFamilyDeduction(
    employee.situation_familiale,
    employee.nombre_enfants,
    payrollYear,
  );
  const deduction_charge_famille = round2(deduction_annuelle / 12);

  // Step 7 — IR Net
  const ir_net = round2(Math.max(0, ir_mensuel_brut - deduction_charge_famille));

  // Step 8 — Salaire Net à Payer
  const salaire_net_payer = round2(
    salaire_brut - cnss_salarie - amo_salarie - mutuelle_salarie - cimr_salarie - ir_net,
  );

  // Step 9 — Charges patronales
  const cnss_patronal = round2(
    Math.min(base_cnss, rates.cnssCeiling) * rates.employerSocial
    + base_cnss * rates.employerFamily,
  );
  const amo_patronal = round2(base_cnss * (solidarityOnly ? rates.employerAmoSolidarity : rates.employerAmo));
  const taxe_formation_pro = employee.tfp_exempt ? 0 : round2(base_cnss * rates.employerTraining);
  const mutuelle_patronal = employee.has_mutuelle
    ? round2(base_cnss * Math.max(0, employee.mutuelle_taux_patronal ?? 0) / 100)
    : 0;
  const cimr_patronal = employee.has_cimr
    ? round2(base_cnss * Math.max(0, employee.cimr_taux_patronal ?? 0) / 100)
    : 0;
  const cout_total_employeur = round2(
    salaire_brut + cnss_patronal + amo_patronal + taxe_formation_pro + mutuelle_patronal + cimr_patronal,
  );

  return {
    proration_factor: proration, salaire_base, salaire_brut, heures_sup, primes, indemnites,
    retenue_absence, base_cnss,
    cnss_salarie, amo_salarie, mutuelle_salarie, cimr_salarie, frais_pro, salaire_net_imposable,
    ir_annuel, ir_mensuel_brut, deduction_charge_famille, ir_net,
    salaire_net_payer,
    cnss_patronal, amo_patronal, mutuelle_patronal, cimr_patronal,
    taxe_formation_pro, cout_total_employeur,
  };
}

export function formatMAD(amount: number): string {
  return new Intl.NumberFormat("fr-MA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount) + " MAD";
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
