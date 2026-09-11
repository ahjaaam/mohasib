export const INVOICE_VAT_TREATMENTS = [
  "out_of_scope",
  "exempt_without_deduction",
  "exempt_with_deduction",
  "suspension",
] as const;

export type InvoiceVatTreatment = typeof INVOICE_VAT_TREATMENTS[number];

export const INVOICE_VAT_TREATMENT_OPTIONS: Array<{ value: InvoiceVatTreatment; label: string }> = [
  { value: "out_of_scope", label: "Hors champ de la TVA" },
  { value: "exempt_without_deduction", label: "Exonérée sans droit à déduction (art. 91)" },
  { value: "exempt_with_deduction", label: "Exonérée avec droit à déduction / export (art. 92)" },
  { value: "suspension", label: "En suspension de TVA (art. 94)" },
];

export function normalizeInvoiceVatTreatment(value: unknown): InvoiceVatTreatment | null {
  const normalized = String(value ?? "");
  return INVOICE_VAT_TREATMENTS.includes(normalized as InvoiceVatTreatment)
    ? normalized as InvoiceVatTreatment
    : null;
}
