export async function finalizeDraftInvoice(invoiceId: string, dossierId?: string | null) {
  const response = await fetch("/api/accounting/book", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "invoice",
      invoiceId,
      dossierId: dossierId || undefined,
      finalizeDraft: true,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || payload.error || "Échec de la comptabilisation de la facture");
  }
}
