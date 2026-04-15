// ── Moroccan payroll calculation engine ─────────────────────────────────────
// Rates 2024 — barème IR DGI Maroc / CNSS

export interface EmployeeInput {
  salaire_brut: number;
  situation_familiale: string;  // 'Célibataire' | 'Marié(e)' | 'Divorcé(e)' | 'Veuf/Veuve'
  nombre_enfants: number;
  heures_sup?: number;
  primes?: number;
  indemnites?: number;
  date_embauche?: string;       // ISO date string for ancienneté calculation
  has_mutuelle?: boolean;
  mutuelle_taux_salarie?: number;   // default 2.59
  mutuelle_taux_patronal?: number;  // default 2.59
  has_cimr?: boolean;
  cimr_taux_salarie?: number;       // default 3.00
  cimr_taux_patronal?: number;      // default 3.90
}

export interface BulletinCalculation {
  salaire_brut: number;
  heures_sup: number;
  primes: number;
  indemnites: number;

  // Ancienneté
  anciennete_years: number;
  anciennete_label: string;
  prime_anciennete_taux: number;   // 0 / 0.05 / 0.10 / 0.15 / 0.20 / 0.25
  prime_anciennete_montant: number;

  // Salaire brut total (after ancienneté + primes + indemnités)
  salaire_brut_total: number;

  // ── Employee deductions ──────────────────────────────────────────────
  cotisation_css: number;          // 4.29% of brut (capped at 6000)
  indemnite_perte_emploi: number;  // 0.19% of brut (capped at 6000)
  amo_salarie: number;             // 2.26% of brut
  mutuelle_salarie: number;        // 2.59% if has_mutuelle
  cimr_salarie: number;            // 3.00% if has_cimr
  frais_pro: number;               // 25% of brut (capped at 2500)
  solidarite_sociale: number;      // 0.5% of min(brut, 6000)

  // ── IR ───────────────────────────────────────────────────────────────
  salaire_net_imposable: number;
  ir_annuel: number;
  ir_mensuel_brut: number;
  deduction_charge_famille: number;
  ir_net: number;

  // ── Net ──────────────────────────────────────────────────────────────
  salaire_net_payer: number;

  // ── Employer charges ─────────────────────────────────────────────────
  allocation_familiale: number;    // 6.40% of brut
  prestations_sociales: number;    // 8.98% of brut
  taxe_formation_pro: number;      // 1.60% of brut
  amo_patronal: number;            // 4.11% of brut
  mutuelle_patronal: number;       // 2.59% if has_mutuelle
  cimr_patronal: number;           // 3.90% if has_cimr
  cout_total_employeur: number;

  // ── Legacy aliases (kept for DB column compatibility) ────────────────
  cnss_salarie: number;            // = cotisation_css + indemnite_perte_emploi
  cnss_patronal: number;           // = allocation_familiale + prestations_sociales
}

// ─────────────────────────────────────────────────────────────────────────────

export function calcAnciennete(dateEmbauche?: string): {
  years: number;
  label: string;
  taux: number;
} {
  if (!dateEmbauche) return { years: 0, label: "Entre 0 à 2 ans", taux: 0 };
  const start = new Date(dateEmbauche);
  const now   = new Date();
  const years = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25);

  let label: string;
  let taux: number;

  if (years < 2)       { label = "Entre 0 à 2 ans";    taux = 0.00; }
  else if (years < 5)  { label = "Entre 2 à 5 ans";    taux = 0.05; }
  else if (years < 10) { label = "Entre 5 à 10 ans";   taux = 0.10; }
  else if (years < 15) { label = "Entre 10 à 15 ans";  taux = 0.15; }
  else if (years < 20) { label = "Entre 15 à 20 ans";  taux = 0.20; }
  else                 { label = "Plus de 20 ans";      taux = 0.25; }

  return { years: Math.floor(years), label, taux };
}

export function calculateSalary(employee: EmployeeInput): BulletinCalculation {
  const salaire_brut = Math.max(0, employee.salaire_brut);
  const heures_sup   = Math.max(0, employee.heures_sup  ?? 0);
  const primes       = Math.max(0, employee.primes      ?? 0);
  const indemnites   = Math.max(0, employee.indemnites  ?? 0);

  // ── Ancienneté ─────────────────────────────────────────────────────────
  const anc = calcAnciennete(employee.date_embauche);
  const prime_anciennete_montant = round2(salaire_brut * anc.taux);
  const salaire_brut_total = round2(salaire_brut + prime_anciennete_montant + primes + indemnites);

  // ── Employee deductions ──────────────────────────────────────────────
  const cnss_base = Math.min(salaire_brut, 6000);

  const cotisation_css         = round2(cnss_base * 0.0429);
  const indemnite_perte_emploi = round2(cnss_base * 0.0019);
  const amo_salarie            = round2(salaire_brut * 0.0226);

  const has_mutuelle             = employee.has_mutuelle ?? false;
  const mutuelle_taux_salarie    = employee.mutuelle_taux_salarie   ?? 2.59;
  const mutuelle_taux_patronal   = employee.mutuelle_taux_patronal  ?? 2.59;
  const has_cimr                 = employee.has_cimr ?? false;
  const cimr_taux_salarie        = employee.cimr_taux_salarie   ?? 3.00;
  const cimr_taux_patronal       = employee.cimr_taux_patronal  ?? 3.90;

  const mutuelle_salarie = has_mutuelle ? round2(salaire_brut * mutuelle_taux_salarie  / 100) : 0;
  const cimr_salarie     = has_cimr     ? round2(salaire_brut * cimr_taux_salarie      / 100) : 0;

  // Frais professionnels: 25% capped at 2500 MAD
  const frais_pro = round2(Math.min(salaire_brut * 0.25, 2500));

  // Solidarité sociale: 0.5% of min(brut, 6000)
  const solidarite_sociale = round2(Math.min(salaire_brut, 6000) * 0.005);

  // ── Salaire net imposable ──────────────────────────────────────────
  const salaire_net_imposable = round2(
    salaire_brut_total
    - cotisation_css
    - indemnite_perte_emploi
    - amo_salarie
    - mutuelle_salarie
    - cimr_salarie
    - frais_pro
  );

  // ── IR annuel (barème progressif 2024) ─────────────────────────────
  const annuel = salaire_net_imposable * 12;
  let ir_annuel: number;
  if      (annuel <= 30000)  ir_annuel = 0;
  else if (annuel <= 50000)  ir_annuel = (annuel - 30000) * 0.10;
  else if (annuel <= 60000)  ir_annuel = (annuel - 50000) * 0.20 + 2000;
  else if (annuel <= 80000)  ir_annuel = (annuel - 60000) * 0.30 + 4000;
  else if (annuel <= 180000) ir_annuel = (annuel - 80000) * 0.34 + 10000;
  else                       ir_annuel = (annuel - 180000) * 0.37 + 44000;
  ir_annuel = round2(ir_annuel);
  const ir_mensuel_brut = round2(ir_annuel / 12);

  // ── Déduction charge de famille ────────────────────────────────────
  const enfants = Math.min(Math.max(0, employee.nombre_enfants), 6);
  let deduction_annuelle = enfants * 360;
  if (employee.situation_familiale === "Marié(e)") deduction_annuelle += 360;
  const deduction_charge_famille = round2(deduction_annuelle / 12);

  // ── IR Net ─────────────────────────────────────────────────────────
  const ir_net = round2(Math.max(0, ir_mensuel_brut - deduction_charge_famille));

  // ── Salaire net à payer ────────────────────────────────────────────
  const salaire_net_payer = round2(
    salaire_brut_total
    - cotisation_css
    - indemnite_perte_emploi
    - amo_salarie
    - mutuelle_salarie
    - cimr_salarie
    - solidarite_sociale
    - ir_net
  );

  // ── Charges patronales ─────────────────────────────────────────────
  const allocation_familiale  = round2(salaire_brut * 0.0640);
  const prestations_sociales  = round2(salaire_brut * 0.0898);
  const taxe_formation_pro    = round2(salaire_brut * 0.0160);
  const amo_patronal          = round2(salaire_brut * 0.0411);
  const mutuelle_patronal     = has_mutuelle ? round2(salaire_brut * mutuelle_taux_patronal / 100) : 0;
  const cimr_patronal         = has_cimr     ? round2(salaire_brut * cimr_taux_patronal    / 100) : 0;

  const cout_total_employeur = round2(
    salaire_brut_total
    + allocation_familiale
    + prestations_sociales
    + taxe_formation_pro
    + amo_patronal
    + mutuelle_patronal
    + cimr_patronal
  );

  return {
    salaire_brut, heures_sup, primes, indemnites,
    anciennete_years: anc.years,
    anciennete_label: anc.label,
    prime_anciennete_taux: anc.taux,
    prime_anciennete_montant,
    salaire_brut_total,
    cotisation_css, indemnite_perte_emploi, amo_salarie,
    mutuelle_salarie, cimr_salarie,
    frais_pro, solidarite_sociale,
    salaire_net_imposable,
    ir_annuel, ir_mensuel_brut, deduction_charge_famille, ir_net,
    salaire_net_payer,
    allocation_familiale, prestations_sociales, taxe_formation_pro,
    amo_patronal, mutuelle_patronal, cimr_patronal,
    cout_total_employeur,
    // Legacy aliases
    cnss_salarie: round2(cotisation_css + indemnite_perte_emploi),
    cnss_patronal: round2(allocation_familiale + prestations_sociales),
  };
}

export function formatMAD(amount: number): string {
  return new Intl.NumberFormat("fr-MA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount) + " MAD";
}

export function fmtNum(n: number): string {
  return new Intl.NumberFormat("fr-MA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function fmtPct(n: number): string {
  return new Intl.NumberFormat("fr-MA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n * 100) + "%";
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
