export const FINALIZED_INVOICE_STATUSES = new Set([
  "sent",
  "paid",
  "overdue",
  "partiellement_payee",
]);

export function isInvoiceBookableStatus(status: unknown) {
  return typeof status === "string" && FINALIZED_INVOICE_STATUSES.has(status);
}

export function canPermanentlyDeleteInvoice(status: unknown, invoiceType: unknown) {
  return invoiceType === "devis" || status === "draft";
}
