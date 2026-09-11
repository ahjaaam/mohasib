export interface RecordInvoicePaymentInput {
  invoiceId: string;
  amount: number;
  paymentDate: string;
  paymentMethod?: string | null;
  reference?: string | null;
  notes?: string | null;
}

export interface RecordSupplierPaymentInput {
  receiptId: string;
  amount: number;
  paymentDate: string;
  paymentMethod?: string | null;
  reference?: string | null;
  notes?: string | null;
  requestId: string;
}

export async function recordInvoicePayment(input: RecordInvoicePaymentInput) {
  const response = await fetch("/api/invoice-payments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      invoice_id: input.invoiceId,
      montant: input.amount,
      date_paiement: input.paymentDate,
      mode_paiement: input.paymentMethod ?? null,
      reference: input.reference ?? null,
      notes: input.notes ?? null,
      payment_type: "encaissement",
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error || "Impossible d’enregistrer le paiement");
  }
  return result;
}

export async function recordSupplierPayment(input: RecordSupplierPaymentInput) {
  const response = await fetch("/api/invoice-payments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      inbox_item_id: input.receiptId,
      montant: input.amount,
      date_paiement: input.paymentDate,
      mode_paiement: input.paymentMethod ?? null,
      reference: input.reference ?? null,
      notes: input.notes ?? null,
      payment_type: "decaissement",
      request_id: input.requestId,
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error || "Impossible d’enregistrer le paiement fournisseur");
  }
  return result;
}
