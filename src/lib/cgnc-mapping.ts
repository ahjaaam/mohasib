// CGNC (Cadre Général de Normalisation Comptable) account mapping
// Extends src/lib/cgnc-accounts.ts with booking-specific helpers

export function getRevenueAccount(category: string, _tvaRate?: number): string {
  const map: Record<string, string> = {
    "Ventes":        "7111",
    "Marchandises":  "7111",
    "Services":      "7131",
    "Honoraires":    "7121",
    "Travaux":       "7141",
    "Loyer reçu":    "7382",
    "Remboursement": "7311",
    "Autre revenu":  "7131",
  };
  return map[category] || "7131";
}

export function getExpenseAccount(category: string): string {
  const map: Record<string, string> = {
    "Achats":              "6111",
    "Matières premières":  "6121",
    "Fournitures":         "6123",
    "Loyer":               "6132",
    "Entretien":           "6133",
    "Consulting":          "6141",
    "Transport":           "6142",
    "Déplacements":        "6143",
    "Marketing":           "6144",
    "Publicité":           "6144",
    "Assurance":           "6146",
    "Communication":       "6147",
    "Télécom":             "6147",
    "Fiscalité":           "6161",
    "Salaires":            "6171",
    "CNSS patronal":       "6174",
    "Eau/Électricité":     "6125",
    "Maintenance":         "6133",
    "Formation":           "6153",
    "Charges bancaires":   "6311",
    "Banque":              "6311",
    "Équipement":          "2340",
    "Informatique":        "2350",
    "Charges diverses":    "6182",
    "Autre dépense":       "6111",
  };
  return map[category] || "6182";
}

export function getTVACollectedAccount(_rate: number): string {
  return "4455"; // État TVA facturée (all rates use same account in Morocco)
}

export function getTVARecoverableAccount(): string {
  return "3455"; // État TVA récupérable
}

export function getAccountLabel(compte: string): string {
  const labels: Record<string, string> = {
    "1111": "Capital social",
    "1411": "Emprunts auprès des établissements de crédit",
    "2340": "Matériel de bureau",
    "2350": "Matériel informatique",
    "2410": "Mobilier de bureau",
    "3421": "Clients",
    "3455": "État TVA récupérable",
    "3491": "Créances diverses",
    "4411": "Fournisseurs",
    "4455": "État TVA facturée",
    "4456": "État TVA déductible",
    "4481": "Dettes sociales (CNSS)",
    "4491": "Dettes diverses",
    "5141": "Banques",
    "5161": "Caisse",
    "6111": "Achats de marchandises",
    "6121": "Achats de matières premières",
    "6123": "Fournitures de bureau",
    "6125": "Eau et électricité",
    "6132": "Locations et charges locatives",
    "6133": "Entretien et réparations",
    "6141": "Études et recherches",
    "6142": "Transports",
    "6143": "Déplacements et missions",
    "6144": "Publicité et relations publiques",
    "6146": "Assurances",
    "6147": "Télécommunications",
    "6153": "Formation du personnel",
    "6161": "Impôts et taxes",
    "6171": "Rémunérations du personnel",
    "6174": "Charges sociales",
    "6182": "Charges diverses",
    "6311": "Intérêts et charges financières",
    "7111": "Ventes de marchandises",
    "7121": "Ventes de biens produits",
    "7131": "Ventes de services",
    "7141": "Travaux facturés",
    "7311": "Produits financiers",
    "7382": "Produits des immeubles",
  };
  return labels[compte] || compte;
}

export function getAccountClass(compte: string): number {
  return parseInt(compte.charAt(0), 10) || 0;
}

export function getAccountClassName(cls: number): string {
  const names: Record<number, string> = {
    1: "Classe 1 — Financement permanent",
    2: "Classe 2 — Actif immobilisé",
    3: "Classe 3 — Actif circulant",
    4: "Classe 4 — Passif circulant",
    5: "Classe 5 — Trésorerie",
    6: "Classe 6 — Charges",
    7: "Classe 7 — Produits",
  };
  return names[cls] || `Classe ${cls}`;
}

// Whether an account normally has a debit balance (assets, expenses)
export function isDebitNormal(compte: string): boolean {
  const cls = getAccountClass(compte);
  return [1, 2, 3, 5, 6].includes(cls) ? (cls !== 1) : false;
  // Classes 2,3,5,6 = debit normal; Classes 1,4,7 = credit normal
}
