export async function finalizeSupplierCreditNote(
  creditNoteId: string,
  dossierId?: string | null,
) {
  const response = await fetch("/api/accounting/book", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "supplier_credit_note",
      creditNoteId,
      dossierId: dossierId || undefined,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || payload.error || "Échec de la comptabilisation de l’avoir fournisseur");
  }
}
