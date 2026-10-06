export function getInvoiceDocumentLabel(invoiceType?: string | null): string {
  if (invoiceType === "devis") return "Devis";
  if (invoiceType === "avoir" || invoiceType === "avoir_client") return "Avoir";
  return "Facture";
}

export function getInvoiceDocumentFilename(
  invoiceType: string | null | undefined,
  invoiceNumber: string,
  clientName?: string | null,
): string {
  const label = getInvoiceDocumentLabel(invoiceType);
  const safeNumber = invoiceNumber.replace(/[^a-zA-Z0-9À-ɏ._-]/g, "-");
  const safeClient = clientName
    ?.replace(/[^a-zA-Z0-9À-ɏ\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");

  return `${label}-${safeNumber}${safeClient ? `-${safeClient}` : ""}.pdf`;
}
