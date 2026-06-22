export type PlanFeature =
  | "bank_import"
  | "saisie"
  | "paie"
  | "export_fiduciaire"
  | "avoirs"
  | "bilan"
  | "tva_edi"
  | "inbox_global"
  | "mass_declarations"
  | "multi_users";

export type PlanEntitlements = {
  plan: string;
  features: Record<PlanFeature, boolean>;
  limits: {
    ocr: number;
    storageGb: number;
    dossiers: number;
    users: number;
    employees: number;
  };
};

export const FEATURE_COLUMNS: Record<Exclude<PlanFeature, "multi_users">, string> = {
  bank_import: "has_bank_import",
  saisie: "has_saisie",
  paie: "has_paie",
  export_fiduciaire: "has_export_fiduciaire",
  avoirs: "has_avoirs",
  bilan: "has_bilan",
  tva_edi: "has_tva_edi",
  inbox_global: "has_inbox_global",
  mass_declarations: "has_mass_declarations",
};

export const DEFAULT_PLAN_LIMITS: Record<string, Record<string, number | boolean>> = {
  trial:         { ocr_limit: -1,  storage_gb: 1,   dossiers_limit: -1, users_limit: 2, employee_limit: -1, has_bank_import: true,  has_saisie: true,  has_paie: true,  has_export_fiduciaire: true,  has_avoirs: true,  has_bilan: true,  has_tva_edi: true,  has_inbox_global: true,  has_mass_declarations: true },
  starter:       { ocr_limit: 50,  storage_gb: 5,   dossiers_limit: 0,  users_limit: 1, employee_limit: 0,  has_bank_import: false, has_saisie: false, has_paie: false, has_export_fiduciaire: false, has_avoirs: false, has_bilan: false, has_tva_edi: false, has_inbox_global: false, has_mass_declarations: false },
  business:      { ocr_limit: 250, storage_gb: 25,  dossiers_limit: 0,  users_limit: 1, employee_limit: 10, has_bank_import: true,  has_saisie: true,  has_paie: true,  has_export_fiduciaire: true,  has_avoirs: true,  has_bilan: false, has_tva_edi: true,  has_inbox_global: false, has_mass_declarations: false },
  business_pro:  { ocr_limit: -1,  storage_gb: -1,  dossiers_limit: 0,  users_limit: 3, employee_limit: -1, has_bank_import: true,  has_saisie: true,  has_paie: true,  has_export_fiduciaire: true,  has_avoirs: true,  has_bilan: true,  has_tva_edi: true,  has_inbox_global: false, has_mass_declarations: false },
  comptable_s:   { ocr_limit: 100, storage_gb: 25,  dossiers_limit: 5,  users_limit: 1, employee_limit: 5,  has_bank_import: true,  has_saisie: true,  has_paie: true,  has_export_fiduciaire: true,  has_avoirs: true,  has_bilan: true,  has_tva_edi: true,  has_inbox_global: false, has_mass_declarations: false },
  comptable_pro: { ocr_limit: 500, storage_gb: 100, dossiers_limit: 20, users_limit: 2, employee_limit: 10, has_bank_import: true,  has_saisie: true,  has_paie: true,  has_export_fiduciaire: true,  has_avoirs: true,  has_bilan: true,  has_tva_edi: true,  has_inbox_global: true,  has_mass_declarations: true },
  comptable_inf: { ocr_limit: -1,  storage_gb: -1,  dossiers_limit: -1, users_limit: 5, employee_limit: -1, has_bank_import: true,  has_saisie: true,  has_paie: true,  has_export_fiduciaire: true,  has_avoirs: true,  has_bilan: true,  has_tva_edi: true,  has_inbox_global: true,  has_mass_declarations: true },
};

export const MAIN_ROUTE_FEATURES: Record<string, PlanFeature> = {
  "/rapprochement": "bank_import",
  "/saisie": "saisie",
  "/paie": "paie",
  "/export": "export_fiduciaire",
  "/export-fiduciaire": "export_fiduciaire",
  "/invoices/avoir": "avoirs",
  "/transactions/avoirs-fournisseurs": "avoirs",
};

export function featureForPath(pathname: string, routes = MAIN_ROUTE_FEATURES) {
  const route = Object.keys(routes)
    .sort((a, b) => b.length - a.length)
    .find(path => pathname === path || pathname.startsWith(`${path}/`));
  return route ? routes[route] : undefined;
}
