export interface CgncAccount {
  code: string;
  label: string;
}

export const cgncAccounts: CgncAccount[] = [
  // Classe 6 — Charges
  { code: "6111", label: "Achats de marchandises" },
  { code: "6119", label: "RRR obtenus sur achats de marchandises" },
  { code: "6121", label: "Achats de matières premières" },
  { code: "6123", label: "Achats d'emballages" },
  { code: "6125", label: "Achats non stockés de matières et fournitures" },
  { code: "61254", label: "Fournitures de bureau" },
  { code: "6131", label: "Locations et charges locatives" },
  { code: "6132", label: "Redevances de crédit-bail" },
  { code: "6133", label: "Entretien et réparations" },
  { code: "6134", label: "Primes d'assurances" },
  { code: "6141", label: "Études, recherches et documentation" },
  { code: "6142", label: "Transports" },
  { code: "6143", label: "Déplacements, missions et réceptions" },
  { code: "6144", label: "Publicité et relations publiques" },
  { code: "6145", label: "Frais postaux et télécommunications" },
  { code: "6146", label: "Cotisations et dons" },
  { code: "6147", label: "Services bancaires" },
  { code: "6182", label: "Pertes sur créances irrécouvrables" },
  { code: "6161", label: "Impôts et taxes" },
  { code: "6171", label: "Rémunérations du personnel" },
  { code: "6174", label: "Charges sociales (CNSS, AMO)" },
  { code: "6311", label: "Intérêts et charges financières" },
  { code: "6321", label: "Pertes de change" },

  // Classe 7 — Produits
  { code: "7111", label: "Ventes de marchandises" },
  { code: "7121", label: "Ventes de biens produits" },
  { code: "7131", label: "Ventes de services" },
  { code: "7141", label: "Travaux facturés" },
  { code: "7161", label: "Produits des titres de participation" },
  { code: "7311", label: "Intérêts et produits financiers" },

  // Classe 3 — Actif circulant
  { code: "3421", label: "Clients" },
  { code: "3455", label: "État TVA récupérable" },
  { code: "3491", label: "Créances diverses" },

  // Classe 4 — Passif circulant
  { code: "4411", label: "Fournisseurs" },
  { code: "4455", label: "État TVA facturée" },
  { code: "4456", label: "État TVA déductible" },
  { code: "4481", label: "Dettes sociales (CNSS)" },
  { code: "4491", label: "Dettes diverses" },

  // Classe 5 — Trésorerie
  { code: "5141", label: "Banques" },
  { code: "5161", label: "Caisse" },

  // Classe 2 — Immobilisations
  { code: "2340", label: "Matériel de bureau" },
  { code: "2350", label: "Matériel informatique" },
  { code: "2410", label: "Mobilier de bureau" },
];

// Auto-mapping: Mohasib category → CGNC code
export const categoryToCompte: Record<string, string> = {
  "Ventes":           "7111",
  "Services":         "7131",
  "Remboursement":    "7311",
  "Autre revenu":     "7131",
  "Achats":           "6111",
  "Salaires":         "6171",
  "Loyer":            "6131",
  "Fournitures":      "61254",
  "Transport":        "6142",
  "Communication":    "6145",
  "Fiscalité":        "6161",
  "Banque":           "6311",
  "Autre dépense":    "6143",
};

// A note de frais is classified by the nature of the employee-paid expense.
// It must never fall back to 6111 (merchandise purchased for resale).
export const expenseNoteCategoryToCompte: Record<string, string> = {
  "Achats":           "6125",
  "Salaires":         "6171",
  "Loyer":            "6131",
  "Fournitures":      "61254",
  "Transport":        "6142",
  "Déplacements et missions": "6143",
  "Communication":    "6145",
  "Fiscalité":        "6161",
  "Autre dépense":    "",
};

export function compteLabel(code: string): string {
  return cgncAccounts.find((a) => a.code === code)?.label ?? code;
}
