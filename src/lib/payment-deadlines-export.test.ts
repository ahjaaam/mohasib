import { describe, expect, it } from "vitest";
import {
  buildClientPaymentDeadlineRows,
  buildSupplierPaymentDeadlineRows,
} from "./payment-deadlines-export";

const period = { start: "2026-04-01", end: "2026-06-30" };

describe("payment deadline export", () => {
  it("creates one row per partial payment and calculates each delay", () => {
    const rows = buildClientPaymentDeadlineRows([{
      invoice_number: "F-42",
      issue_date: "2026-04-10",
      due_date: "2026-05-10",
      total: 1_200,
      montant_recu: 1_200,
      status: "paid",
      clients: { name: "Atlas", ice: "001122" },
      invoice_payments: [
        { montant: 500, date_paiement: "2026-05-09", allocation_status: "confirmed" },
        { montant: 700, date_paiement: "2026-05-15", allocation_status: "confirmed" },
      ],
    }], period);

    expect(rows).toHaveLength(2);
    expect(rows[0][11]).toBe(0);
    expect(rows[0][12]).toBe("Oui");
    expect(rows[1][11]).toBe(5);
    expect(rows[1][12]).toBe("Non");
  });

  it("keeps unpaid supplier invoices and excludes invoices outside the period", () => {
    const rows = buildSupplierPaymentDeadlineRows([
      { created_at: "2026-04-03T10:00:00Z", ocr_data: { vendor_name: "Acme", receipt_number: "A-1", amount: 800, due_date: "2026-05-03" } },
      { created_at: "2026-03-31T10:00:00Z", ocr_data: { vendor_name: "Old", amount: 100 } },
    ], period);

    expect(rows).toHaveLength(1);
    expect(rows[0][1]).toBe("Acme");
    expect(rows[0][7]).toBe("");
    expect(rows[0][12]).toBe("Non réglée");
  });

  it("does not duplicate legacy JSON payments when allocations exist", () => {
    const rows = buildClientPaymentDeadlineRows([{
      invoice_number: "F-43", issue_date: "2026-04-10", total: 100, montant_recu: 100, status: "paid",
      invoice_payments: [{ montant: 100, date_paiement: "2026-04-20" }],
      paiements: [{ montant: 100, date: "2026-04-20" }],
    }], period);
    expect(rows).toHaveLength(1);
  });
});
