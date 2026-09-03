export const BANK_INCOME_CATEGORIES = [
  "Ventes",
  "Services",
  "Remboursement",
  "Autre revenu",
] as const;

export const BANK_EXPENSE_CATEGORIES = [
  "Achats",
  "Salaires",
  "Loyer",
  "Fournitures",
  "Transport",
  "Communication",
  "Fiscalité",
  "Banque",
  "Autre dépense",
] as const;

function searchable(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function containsAny(value: string, terms: string[]) {
  return terms.some(term => value.includes(term));
}

export function inferBankTransactionCategory(description: string, amount: number): string {
  const text = searchable(description);

  if (amount >= 0) {
    if (containsAny(text, ["remboursement", "refund", "restitution", "ristourne"])) return "Remboursement";
    if (containsAny(text, ["honoraire", "prestation", "service", "consulting", "consultation"])) return "Services";
    if (containsAny(text, ["vente", "reglement client", "paiement client", "encaissement", "recette", "tpe", "remise espece"])) return "Ventes";
    return "Autre revenu";
  }

  if (containsAny(text, ["commission", "frais bancaire", "frais tenue", "tenue de compte", "agio", "interet debiteur"])) return "Banque";
  if (containsAny(text, ["dgi", "impot", "taxe", "tva", "cnss", "tresorerie generale", "perception"])) return "Fiscalité";
  if (containsAny(text, ["salaire", "salaires", "paie", "payroll", "remuneration personnel"])) return "Salaires";
  if (containsAny(text, ["loyer", "bail", "location bureau", "rent office"])) return "Loyer";
  if (containsAny(text, ["maroc telecom", "iam", "orange maroc", "inwi", "internet", "telecom", "telephone", "mobile"])) return "Communication";
  if (containsAny(text, ["carburant", "gasoil", "essence", "station service", "autoroute", "peage", "taxi", "oncf", "transport"])) return "Transport";
  if (containsAny(text, ["fourniture", "papeterie", "materiel bureau", "office depot", "consommable"])) return "Fournitures";
  if (containsAny(text, ["achat", "fournisseur", "facture", "marchandise", "stock", "approvisionnement"])) return "Achats";
  return "Autre dépense";
}

export function resolveBankTransactionCategory(
  extractedCategory: string | null | undefined,
  amount: number,
  description: string,
): string {
  const allowed = amount >= 0 ? BANK_INCOME_CATEGORIES : BANK_EXPENSE_CATEGORIES;
  if (extractedCategory && (allowed as readonly string[]).includes(extractedCategory)) {
    return extractedCategory;
  }
  return inferBankTransactionCategory(description, amount);
}
