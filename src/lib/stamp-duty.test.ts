import { describe, expect, it } from "vitest";
import {
  calculateCashReceiptStampDuty,
  calculatePeriodCashReceiptStampDuty,
  isCashPaymentMode,
} from "./stamp-duty";

describe("cash receipt stamp duty", () => {
  it("applies 0.25% to confirmed cash collections", () => {
    expect(calculateCashReceiptStampDuty([
      {
        montant: 1_000,
        mode_paiement: "Espèces",
        payment_type: "encaissement",
        allocation_status: "confirmed",
      },
    ])).toBe(2.5);
  });

  it("recognizes the cash modes stored by current and legacy flows", () => {
    expect(["Espèces", "especes", "Espèce", "cash", "en espèces"].every(isCashPaymentMode)).toBe(true);
  });

  it("excludes non-cash, outgoing, and unconfirmed payments", () => {
    expect(calculateCashReceiptStampDuty([
      { montant: 1_000, mode_paiement: "Virement", payment_type: "encaissement", allocation_status: "confirmed" },
      { montant: 1_000, mode_paiement: "Chèque", payment_type: "encaissement", allocation_status: "confirmed" },
      { montant: 1_000, mode_paiement: "Carte bancaire", payment_type: "encaissement", allocation_status: "confirmed" },
      { montant: 1_000, mode_paiement: "Espèces", payment_type: "decaissement", allocation_status: "confirmed" },
      { montant: 1_000, mode_paiement: "Espèces", payment_type: "encaissement", allocation_status: "suggested" },
      { montant: 1_000, mode_paiement: "Espèces", payment_type: "encaissement", allocation_status: "rejected" },
    ])).toBe(0);
  });

  it("rounds the period duty to centimes and ignores invalid amounts", () => {
    expect(calculateCashReceiptStampDuty([
      { montant: "333.33", mode_paiement: "cash", payment_type: "encaissement", allocation_status: "confirmed" },
      { montant: -10, mode_paiement: "cash", payment_type: "encaissement", allocation_status: "confirmed" },
      { montant: "not-a-number", mode_paiement: "cash", payment_type: "encaissement", allocation_status: "confirmed" },
    ])).toBe(0.83);
  });

  it("includes payments recorded directly on legacy invoices", () => {
    expect(calculatePeriodCashReceiptStampDuty([], [
      {
        id: "invoice-1",
        paiements: [
          { date: "2026-09-05", montant: 2_000, mode: "Espèces" },
          { date: "2026-08-31", montant: 1_000, mode: "Espèces" },
        ],
      },
    ], "2026-09-01", "2026-09-30")).toBe(5);
  });

  it("does not double count payments mirrored into allocations and invoice history", () => {
    expect(calculatePeriodCashReceiptStampDuty([
      {
        invoice_id: "invoice-1",
        montant: 1_000,
        date_paiement: "2026-09-05",
        mode_paiement: "cash",
        payment_type: "encaissement",
        allocation_status: "confirmed",
      },
    ], [
      {
        id: "invoice-1",
        paiements: [{ date: "2026-09-05", montant: 1_000, mode: "cash" }],
      },
    ], "2026-09-01", "2026-09-30")).toBe(2.5);
  });
});
