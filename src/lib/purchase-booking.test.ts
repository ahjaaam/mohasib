import { describe, expect, it } from "vitest";
import { computePurchaseAmounts, shouldBookConfirmedPurchase } from "./purchase-booking";

describe("shouldBookConfirmedPurchase", () => {
  it("books a confirmed expense report even when it is not classified as an invoice", () => {
    expect(shouldBookConfirmedPurchase({
      document_type: "receipt",
      is_supplier_invoice: false,
    })).toBe(true);
  });

  it("books a confirmed supplier invoice", () => {
    expect(shouldBookConfirmedPurchase({
      document_type: "invoice",
      is_supplier_invoice: true,
    })).toBe(true);
  });

  it("does not book an outgoing invoice as a purchase", () => {
    expect(shouldBookConfirmedPurchase({
      document_type: "invoice",
      is_supplier_invoice: false,
    })).toBe(false);
  });
});

describe("computePurchaseAmounts", () => {
  it("uses an explicit TVA amount", () => {
    expect(computePurchaseAmounts({ amount: -1200, tva_amount: 200, tva_rate: 20 })).toEqual({
      totalHt: 1000,
      totalTtc: 1200,
      tvaAmount: 200,
      discountAmount: 0,
      grossTtc: 1200,
    });
  });

  it("derives TVA from the rate when OCR has no TVA amount", () => {
    expect(computePurchaseAmounts({ amount: -1200, tva_rate: 20 })).toEqual({
      totalHt: 1000,
      totalTtc: 1200,
      tvaAmount: 200,
      discountAmount: 0,
      grossTtc: 1200,
    });
  });

  it("supports the legacy tax_amount alias", () => {
    expect(computePurchaseAmounts({ amount: 110, tax_amount: 10 })).toEqual({
      totalHt: 100,
      totalTtc: 110,
      tvaAmount: 10,
      discountAmount: 0,
      grossTtc: 110,
    });
  });

  it("never allows TVA to exceed TTC", () => {
    expect(computePurchaseAmounts({ amount: 100, tva_amount: 150 })).toEqual({
      totalHt: 0,
      totalTtc: 100,
      tvaAmount: 100,
      discountAmount: 0,
      grossTtc: 100,
    });
  });

  it("turns malformed OCR numbers into safe zero values", () => {
    expect(computePurchaseAmounts({
      amount: "not-a-number",
      tva_amount: Number.NaN,
      tva_rate: Number.POSITIVE_INFINITY,
    })).toEqual({
      totalHt: 0,
      totalTtc: 0,
      tvaAmount: 0,
      discountAmount: 0,
      grossTtc: 0,
    });
  });

  it("keeps a TTC discount separate from the gross purchase and TVA", () => {
    expect(computePurchaseAmounts({
      amount: -56079.54,
      discount_amount: 566.46,
      tva_rate: 20,
    })).toEqual({
      totalHt: 47205,
      totalTtc: 56079.54,
      tvaAmount: 9441,
      discountAmount: 566.46,
      grossTtc: 56646,
    });
  });
});
