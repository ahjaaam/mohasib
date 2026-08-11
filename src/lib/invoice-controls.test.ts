import { describe, expect, it } from "vitest";
import { evaluateInvoiceControls, highestInvoiceControlSeverity } from "./invoice-controls";

describe("evaluateInvoiceControls", () => {
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

  it("flags changed supplier banking details", () => {
    const checks = evaluateInvoiceControls(
      { vendor_name: "Atlas", receipt_number: "2", date: "2026-08-02", amount: 100, supplier_iban: "MA64 NEW" },
      [{ id: "previous", created_at: "2026-08-01", ocr_data: { vendor_name: "Atlas", receipt_number: "1", amount: 100, supplier_iban: "MA64 OLD" } }],
    );
    expect(highestInvoiceControlSeverity(checks)).toBe("critical");
    expect(checks).toContainEqual(expect.objectContaining({ code: "supplier_bank_changed" }));
  });
});
