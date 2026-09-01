export type EmailImportMode = "accounting_documents" | "receipts_only";

function normalize(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .trim();
}

const ACCOUNTING_DOCUMENT_TYPES = new Set([
  "invoice",
  "facture",
  "avoir",
  "credit_note",
  "note_de_credit",
]);

const RECEIPT_DOCUMENT_TYPES = new Set([
  "receipt",
  "recu",
  "ticket",
  "cash_receipt",
  "till_receipt",
  "purchase_order",
  "bon",
  "bon_de_commande",
  "delivery_note",
  "bon_de_livraison",
  "goods_receipt",
  "voucher",
]);

const EXCLUDED_RECEIPTS_ONLY_WORDS =
  /\b(facture|invoice|avoir|credit[\s_-]*note|note[\s_-]*de[\s_-]*credit)\b/i;
const RECEIPT_WORDS =
  /\b(re[cç]u|receipt|ticket|bon(?:[\s_-]+de)?[\s_-]*(?:commande|livraison|caisse)?|purchase[\s_-]*order|delivery[\s_-]*note|goods[\s_-]*receipt|voucher)\b/i;

export function shouldImportEmailDocument(
  ocrData: Record<string, unknown>,
  mode: EmailImportMode,
  metadata?: { fileName?: string; subject?: string },
) {
  const documentType = normalize(ocrData.document_type);
  if (mode === "accounting_documents") {
    return ACCOUNTING_DOCUMENT_TYPES.has(documentType);
  }

  // In Notes de frais mode, invoices and credit notes are always rejected,
  // even when the filename or email subject also contains an accepted word.
  if (ACCOUNTING_DOCUMENT_TYPES.has(documentType)) return false;
  if (RECEIPT_DOCUMENT_TYPES.has(documentType)) return true;

  const context = `${metadata?.fileName ?? ""} ${metadata?.subject ?? ""}`;
  if (EXCLUDED_RECEIPTS_ONLY_WORDS.test(context)) return false;
  return RECEIPT_WORDS.test(context);
}
