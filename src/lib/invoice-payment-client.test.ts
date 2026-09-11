import { afterEach, describe, expect, it, vi } from "vitest";
import { recordInvoicePayment, recordSupplierPayment } from "./invoice-payment-client";

describe("recordInvoicePayment", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("records dated payment evidence through the server endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, payment: { id: "payment-1" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await recordInvoicePayment({
      invoiceId: "invoice-1",
      amount: 1_200,
      paymentDate: "2026-09-10",
      paymentMethod: "Virement",
      notes: "Solde",
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/invoice-payments", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        invoice_id: "invoice-1",
        montant: 1_200,
        date_paiement: "2026-09-10",
        mode_paiement: "Virement",
        reference: null,
        notes: "Solde",
        payment_type: "encaissement",
      }),
    }));
  });

  it("surfaces server-side accounting validation errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Période comptable verrouillée" }),
    }));

    await expect(recordInvoicePayment({
      invoiceId: "invoice-1",
      amount: 100,
      paymentDate: "2026-09-10",
    })).rejects.toThrow("Période comptable verrouillée");
  });

  it("records supplier payment evidence with a stable request id", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, payment: { id: "payment-2" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await recordSupplierPayment({
      receiptId: "receipt-1",
      amount: 800,
      paymentDate: "2026-09-11",
      paymentMethod: "Virement bancaire",
      reference: "VIR-42",
      requestId: "00000000-0000-4000-8000-000000000108",
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/invoice-payments", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        inbox_item_id: "receipt-1",
        montant: 800,
        date_paiement: "2026-09-11",
        mode_paiement: "Virement bancaire",
        reference: "VIR-42",
        notes: null,
        payment_type: "decaissement",
        request_id: "00000000-0000-4000-8000-000000000108",
      }),
    }));
  });
});
