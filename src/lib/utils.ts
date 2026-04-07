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
    "Communication",
    "Fiscalité",
    "Autre dépense",
  ],
};
