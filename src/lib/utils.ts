export function formatCurrency(amount: number, currency = "MAD"): string {
  return new Intl.NumberFormat("fr-MA", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat("fr-MA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(dateStr));
}

export function generateInvoiceNumber(last: number): string {
  const year = new Date().getFullYear();
  return `FAC-${year}-${String(last + 1).padStart(4, "0")}`;
}

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  sent: "Envoyée",
  paid: "Payée",
  overdue: "En retard",
  cancelled: "Annulée",
};

export const INVOICE_STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700",
  overdue: "bg-red-100 text-red-700",
  cancelled: "bg-gray-200 text-gray-500",
};

export const TRANSACTION_CATEGORIES = {
  income: ["Ventes", "Services", "Remboursement", "Autre revenu"],
  expense: [
    "Achats",
    "Salaires",
    "Loyer",
    "Fournitures",
    "Transport",
    "Déplacements et missions",
    "Communication",
    "Fiscalité",
    "Autre dépense",
  ],
};

export function normalizeExpenseCategory(value: unknown): typeof TRANSACTION_CATEGORIES.expense[number] {
  const source = String(value ?? "").trim();
  const exact = TRANSACTION_CATEGORIES.expense.find(
    (category) => category.toLocaleLowerCase("fr") === source.toLocaleLowerCase("fr"),
  );
  if (exact) return exact;

  const normalized = source.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr");
  if (/salaire|paie|remuneration|personnel/.test(normalized)) return "Salaires";
  if (/loyer|bail|location.*(bureau|local|immeuble)/.test(normalized)) return "Loyer";
  if (/fourniture|papeterie|bureau|imprimante|informatique/.test(normalized)) return "Fournitures";
  if (/deplacement|mission|reception|repas|restaurant|hotel|hebergement|carburant|essence|gasoil|taxi|train|avion|parking|peage|location.*(voiture|vehicule)/.test(normalized)) return "Déplacements et missions";
  if (/transport|fret|livraison|messagerie/.test(normalized)) return "Transport";
  if (/communication|telephone|internet|telecom|mobile/.test(normalized)) return "Communication";
  if (/fiscal|impot|taxe|timbre/.test(normalized)) return "Fiscalité";
  if (/achat|marchandise|stock|matiere premiere|approvisionnement/.test(normalized)) return "Achats";
  return "Autre dépense";
}
