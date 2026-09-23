import { describe, expect, it } from "vitest";
import { computePurchaseAmounts, computePurchaseAmountsFromHt, shouldBookConfirmedPurchase } from "./purchase-booking";

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
      grossHt: 1000,
      taxableBaseHt: 1000,
      totalTtc: 1200,
      tvaAmount: 200,
      discountAmount: 0,
      commercialDiscountAmount: 0,
      settlementDiscountAmount: 0,
    });
  });

  it("derives TVA from the rate when OCR has no TVA amount", () => {
    expect(computePurchaseAmounts({ amount: -1200, tva_rate: 20 })).toEqual({
      totalHt: 1000,
      grossHt: 1000,
      taxableBaseHt: 1000,
      totalTtc: 1200,
      tvaAmount: 200,
      discountAmount: 0,
      commercialDiscountAmount: 0,
      settlementDiscountAmount: 0,
    });
  });

  it("supports the legacy tax_amount alias", () => {
    expect(computePurchaseAmounts({ amount: 110, tax_amount: 10 })).toEqual({
      totalHt: 100,
      grossHt: 100,
      taxableBaseHt: 100,
      totalTtc: 110,
      tvaAmount: 10,
      discountAmount: 0,
      commercialDiscountAmount: 0,
      settlementDiscountAmount: 0,
    });
  });

  it("never allows TVA to exceed TTC", () => {
    expect(computePurchaseAmounts({ amount: 100, tva_amount: 150 })).toEqual({
      totalHt: 0,
      grossHt: 0,
      taxableBaseHt: 0,
      totalTtc: 100,
      tvaAmount: 100,
      discountAmount: 0,
      commercialDiscountAmount: 0,
      settlementDiscountAmount: 0,
    });
  });

  it("turns malformed OCR numbers into safe zero values", () => {
    expect(computePurchaseAmounts({
      amount: "not-a-number",
      tva_amount: Number.NaN,
      tva_rate: Number.POSITIVE_INFINITY,
    })).toEqual({
      totalHt: 0,
      grossHt: 0,
      taxableBaseHt: 0,
      totalTtc: 0,
      tvaAmount: 0,
      discountAmount: 0,
      commercialDiscountAmount: 0,
      settlementDiscountAmount: 0,
    });
  });

  it("books an on-invoice commercial reduction at net commercial HT", () => {
    expect(computePurchaseAmounts({
      amount: -10800,
      amount_ht: 10000,
      tva_amount: 1800,
      discount_amount: 1000,
      tva_rate: 20,
    })).toEqual({
      totalHt: 9000,
      grossHt: 10000,
      taxableBaseHt: 9000,
      totalTtc: 10800,
      tvaAmount: 1800,
      discountAmount: 1000,
      commercialDiscountAmount: 1000,
      settlementDiscountAmount: 0,
    });
  });

  it("keeps commercial reductions and escompte separate", () => {
    expect(computePurchaseAmounts({
      amount: 108,
      amount_ht: 100,
      tva_amount: 18,
      commercial_discount_amount: 6,
      settlement_discount_amount: 4,
    })).toEqual({
      totalHt: 94,
      grossHt: 100,
      taxableBaseHt: 90,
      totalTtc: 108,
      tvaAmount: 18,
      discountAmount: 10,
      commercialDiscountAmount: 6,
      settlementDiscountAmount: 4,
    });
  });
});

describe("computePurchaseAmountsFromHt", () => {
  it("uses net commercial HT as the purchase debit and derives TVA on the reduced base", () => {
    expect(computePurchaseAmountsFromHt({
      amountHt: 10000,
      tvaRate: 20,
      commercialDiscountAmount: 1000,
      settlementDiscountAmount: 0,
    })).toEqual({
      totalHt: 9000,
      grossHt: 10000,
      taxableBaseHt: 9000,
      totalTtc: 10800,
      tvaAmount: 1800,
      discountAmount: 1000,
      commercialDiscountAmount: 1000,
      settlementDiscountAmount: 0,
    });
  });

  it("keeps an escompte separate from the net-commercial purchase debit", () => {
    expect(computePurchaseAmountsFromHt({
      amountHt: 10000,
      tvaRate: 20,
      commercialDiscountAmount: 1000,
      settlementDiscountAmount: 100,
    })).toEqual({
      totalHt: 9000,
      grossHt: 10000,
      taxableBaseHt: 8900,
      totalTtc: 10680,
      tvaAmount: 1780,
      discountAmount: 1100,
      commercialDiscountAmount: 1000,
      settlementDiscountAmount: 100,
    });
  });

  it("round-trips the persisted gross HT without applying the commercial reduction twice", () => {
    const confirmed = computePurchaseAmountsFromHt({
      amountHt: 10000,
      tvaRate: 20,
      commercialDiscountAmount: 1000,
      settlementDiscountAmount: 0,
    });

    expect(computePurchaseAmounts({
      amount: confirmed.totalTtc,
      amount_ht: confirmed.grossHt,
      tva_amount: confirmed.tvaAmount,
      tva_rate: 20,
      commercial_discount_amount: confirmed.commercialDiscountAmount,
      settlement_discount_amount: confirmed.settlementDiscountAmount,
    })).toEqual(confirmed);
  });
});
