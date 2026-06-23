export const TRIAL_LIMITS = {
  invoices: 10,
  ocr_scans: 10,
  documents: 10,
  bank_statements: 1,
  employees: 1,
  tva_declarations: 1,
  dossiers: 1,
  clients: 5,
  transactions: 20,
  accounting_entries: 20,
  rapprochement_sessions: 1,
  rapprochement_matches: 20,
} as const;

export type TrialFeature = keyof typeof TRIAL_LIMITS;

export const TRIAL_USAGE_COLUMNS: Record<TrialFeature, string> = {
  invoices: "trial_invoices_used",
  ocr_scans: "trial_ocr_used",
  documents: "trial_documents_used",
  bank_statements: "trial_bank_statements_used",
  employees: "trial_employees_used",
  tva_declarations: "trial_tva_declarations_used",
  dossiers: "trial_dossiers_used",
  clients: "trial_clients_used",
  transactions: "trial_transactions_used",
  accounting_entries: "trial_accounting_entries_used",
  rapprochement_sessions: "trial_rapprochement_sessions_used",
  rapprochement_matches: "trial_rapprochement_matches_used",
};

export const TRIAL_FEATURE_LABELS: Record<TrialFeature, string> = {
  invoices: "factures/devis/avoirs",
  ocr_scans: "documents scannés",
  documents: "documents archivés",
  bank_statements: "relevés bancaires",
  employees: "employés",
  tva_declarations: "déclarations TVA",
  dossiers: "dossiers clients",
  clients: "clients",
  transactions: "transactions",
  accounting_entries: "écritures comptables",
  rapprochement_sessions: "rapprochements bancaires",
  rapprochement_matches: "lignes rapprochées",
};
