import { describe, expect, it } from "vitest";
import { evaluateInvoiceControls, highestInvoiceControlSeverity } from "./invoice-controls";

describe("evaluateInvoiceControls", () => {
  it("flags a non-invoice document uploaded to purchases as an anomaly", () => {
    const checks = evaluateInvoiceControls({
      document_type: "delivery_note",
      vendor_name: "Atlas SARL",
      date: "2026-08-01",
      amount: 1200,
    });
    expect(checks).toContainEqual(expect.objectContaining({
      code: "not_supplier_invoice",
      severity: "critical",
      title: "Document non-facture",
    }));
    expect(highestInvoiceControlSeverity(checks)).toBe("critical");
  });

  it("flags an outgoing invoice uploaded to purchases as an anomaly", () => {
    const checks = evaluateInvoiceControls({
      document_type: "invoice",
      is_supplier_invoice: false,
      vendor_name: "ACME SARL",
      receipt_number: "FAC-1",
      date: "2026-08-01",
      amount: 1200,
    });
    expect(checks).toContainEqual(expect.objectContaining({ code: "not_supplier_invoice", severity: "critical" }));
  });

  it("accepts receipts used as expense evidence", () => {
    const checks = evaluateInvoiceControls({
      document_type: "receipt",
      is_supplier_invoice: false,
      vendor_name: "Café Atlas",
      receipt_number: "T-42",
      date: "2026-08-01",
      amount: 80,
    });
    expect(checks).not.toContainEqual(expect.objectContaining({ code: "not_supplier_invoice" }));
  });

  it("detects a duplicate supplier invoice number", () => {
    const checks = evaluateInvoiceControls(
      { vendor_name: "Atlas SARL", receipt_number: "FA-2026-18", date: "2026-08-01", amount: -1200, tva_rate: 20 },
      [{ id: "previous", ocr_data: { vendor_name: "Atlas S.A.R.L.", receipt_number: "FA 2026/18", date: "2026-07-01", amount: -1200 } }],
    );
    expect(checks).toContainEqual(expect.objectContaining({ code: "duplicate_reference", severity: "critical", relatedReceiptId: "previous" }));
  });

  it("checks Moroccan TVA totals", () => {
    const checks = evaluateInvoiceControls({
      vendor_name: "Fournisseur",
      receipt_number: "42",
      date: "2026-08-01",
      amount_ttc: 1200,
      amount_ht: 1000,
      tva_amount: 100,
      tva_rate: 20,
    });
    expect(checks).toContainEqual(expect.objectContaining({ code: "tva_total_mismatch", severity: "critical" }));
  });

  it("accepts a balanced invoice with a TTC discount", () => {
    const checks = evaluateInvoiceControls({
      vendor_name: "Géant Import et Export",
      receipt_number: "2026/15",
      date: "2026-01-19",
      amount_ttc: 56079.54,
      amount_ht: 47205,
      tva_amount: 9441,
      discount_amount: 566.46,
      tva_rate: 20,
    });
    expect(checks).not.toContainEqual(expect.objectContaining({ code: "tva_total_mismatch" }));
    expect(highestInvoiceControlSeverity(checks)).toBe("info");
  });

  it("flags changed supplier banking details", () => {
    const checks = evaluateInvoiceControls(
      { vendor_name: "Atlas", receipt_number: "2", date: "2026-08-02", amount: 100, supplier_iban: "MA64 NEW" },
      [{ id: "previous", created_at: "2026-08-01", ocr_data: { vendor_name: "Atlas", receipt_number: "1", amount: 100, supplier_iban: "MA64 OLD" } }],
    );
    expect(highestInvoiceControlSeverity(checks)).toBe("critical");
    expect(checks).toContainEqual(expect.objectContaining({ code: "supplier_bank_changed" }));
  });
});
