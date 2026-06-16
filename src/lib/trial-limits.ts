export const TRIAL_LIMITS = {
  invoices: 10,
  ocr_scans: 10,
  bank_statements: 1,
  employees: 1,
  tva_declarations: 1,
  dossiers: 1,
} as const;

export type TrialFeature = keyof typeof TRIAL_LIMITS;

export const TRIAL_USAGE_COLUMNS: Record<TrialFeature, string> = {
  invoices: "trial_invoices_used",
  ocr_scans: "trial_ocr_used",
  bank_statements: "trial_bank_statements_used",
  employees: "trial_employees_used",
  tva_declarations: "trial_tva_declarations_used",
  dossiers: "trial_dossiers_used",
};

export const TRIAL_FEATURE_LABELS: Record<TrialFeature, string> = {
  invoices: "factures/devis/avoirs",
  ocr_scans: "documents scannés",
  bank_statements: "relevés bancaires",
  employees: "employés",
  tva_declarations: "déclarations TVA",
  dossiers: "dossiers clients",
};
