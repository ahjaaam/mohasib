// ── Moroccan payroll calculation engine ─────────────────────────────────────
// Rates 2024 — barème IR DGI Maroc

export interface EmployeeInput {
  salaire_brut: number;
  situation_familiale: string;  // 'Célibataire' | 'Marié(e)' | 'Divorcé(e)' | 'Veuf/Veuve'
  nombre_enfants: number;
  heures_sup?: number;
  primes?: number;
  indemnites?: number;
}

export interface BulletinCalculation {
  salaire_brut: number;
  heures_sup: number;
  primes: number;
  indemnites: number;
  // Employee deductions
  cnss_salarie: number;
  amo_salarie: number;
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
  taxe_formation_pro: number;
  cout_total_employeur: number;
}

export function calculateSalary(employee: EmployeeInput): BulletinCalculation {
  const salaire_brut = Math.max(0, employee.salaire_brut);
  const heures_sup   = Math.max(0, employee.heures_sup  ?? 0);
  const primes       = Math.max(0, employee.primes      ?? 0);
  const indemnites   = Math.max(0, employee.indemnites  ?? 0);

  // Step 1 — CNSS Salarié 6.74% (plafond 6000 MAD)
  const cnss_salarie = round2(Math.min(salaire_brut, 6000) * 0.0674);

  // Step 2 — AMO Salarié 2.26%
  const amo_salarie = round2(salaire_brut * 0.0226);

  // Step 3 — Frais professionnels 20% (plafond 2500 MAD/mois)
  const frais_pro = round2(Math.min(salaire_brut * 0.20, 2500));

  // Step 4 — Salaire net imposable
  const salaire_net_imposable = round2(
    salaire_brut - cnss_salarie - amo_salarie - frais_pro
  );

  // Step 5 — IR annuel (barème progressif 2024)
  const annuel = salaire_net_imposable * 12;
  let ir_annuel: number;
  if (annuel <= 30000) {
    ir_annuel = 0;
  } else if (annuel <= 50000) {
    ir_annuel = (annuel - 30000) * 0.10;
  } else if (annuel <= 60000) {
    ir_annuel = (annuel - 50000) * 0.20 + 2000;
  } else if (annuel <= 80000) {
    ir_annuel = (annuel - 60000) * 0.30 + 4000;
  } else if (annuel <= 180000) {
    ir_annuel = (annuel - 80000) * 0.34 + 10000;
  } else {
    ir_annuel = (annuel - 180000) * 0.37 + 44000;
  }
  ir_annuel = round2(ir_annuel);
  const ir_mensuel_brut = round2(ir_annuel / 12);

  // Step 6 — Déduction charge de famille
  // 360 MAD/an par enfant (max 6), 360 MAD/an si marié(e)
  const enfants = Math.min(Math.max(0, employee.nombre_enfants), 6);
  let deduction_annuelle = enfants * 360;
  if (employee.situation_familiale === 'Marié(e)') deduction_annuelle += 360;
  const deduction_charge_famille = round2(deduction_annuelle / 12);

  // Step 7 — IR Net
  const ir_net = round2(Math.max(0, ir_mensuel_brut - deduction_charge_famille));

  // Step 8 — Salaire Net à Payer
  const salaire_net_payer = round2(salaire_brut - cnss_salarie - amo_salarie - ir_net);

  // Step 9 — Charges patronales
  const cnss_patronal      = round2(Math.min(salaire_brut, 6000) * 0.2109);
  const amo_patronal       = round2(salaire_brut * 0.0226);
  const taxe_formation_pro = round2(salaire_brut * 0.016);
  const cout_total_employeur = round2(
    salaire_brut + cnss_patronal + amo_patronal + taxe_formation_pro
  );

  return {
    salaire_brut, heures_sup, primes, indemnites,
    cnss_salarie, amo_salarie, frais_pro, salaire_net_imposable,
    ir_annuel, ir_mensuel_brut, deduction_charge_famille, ir_net,
    salaire_net_payer,
    cnss_patronal, amo_patronal, taxe_formation_pro, cout_total_employeur,
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
