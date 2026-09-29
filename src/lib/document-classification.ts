export const DOCUMENT_TYPES = [
  "invoice",
  "receipt",
  "purchase_order",
  "delivery_note",
  "avoir",
  "bank_statement",
  "other",
  "unknown",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export function normalizeClassificationToken(value: unknown): string {
  return typeof value === "string"
    ? value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, "_")
      .replace(/^_+|_+$/g, "")
    : "";
}

const DOCUMENT_TYPE_ALIASES: Readonly<Record<string, DocumentType>> = {
  invoice: "invoice",
  invoices: "invoice",
  facture: "invoice",
  factures: "invoice",
  supplier_invoice: "invoice",
  supplier_invoices: "invoice",
  vendor_invoice: "invoice",
  receipt: "receipt",
  receipts: "receipt",
  recu: "receipt",
  recus: "receipt",
  ticket: "receipt",
  tickets: "receipt",
  till_receipt: "receipt",
  cash_receipt: "receipt",
  purchase_receipt: "receipt",
  expense_receipt: "receipt",
  purchase_order: "purchase_order",
  purchase_orders: "purchase_order",
  bon_de_commande: "purchase_order",
  bons_de_commande: "purchase_order",
  delivery_note: "delivery_note",
  delivery_notes: "delivery_note",
  bon_de_livraison: "delivery_note",
  bons_de_livraison: "delivery_note",
  avoir: "avoir",
  avoirs: "avoir",
  credit_note: "avoir",
  credit_notes: "avoir",
  note_de_credit: "avoir",
  notes_de_credit: "avoir",
  bank_statement: "bank_statement",
  bank_statements: "bank_statement",
  bank_account_statement: "bank_statement",
  account_statement: "bank_statement",
  statement: "bank_statement",
  releve_bancaire: "bank_statement",
  releve_de_compte: "bank_statement",
  other: "other",
  autre: "other",
  unknown: "unknown",
  unclassified: "unknown",
  non_classe: "unknown",
};

/** Converts untrusted classifier output into the application's closed document-type union. */
export function normalizeDocumentType(value: unknown): DocumentType {
  return DOCUMENT_TYPE_ALIASES[normalizeClassificationToken(value)] ?? "unknown";
}
