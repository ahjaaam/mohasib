import { describe, expect, it } from "vitest";
import { computeInvoiceDiscount, purchaseCommercialDiscountAccount, salesCommercialDiscountAccount } from "./invoice-discounts";

describe("invoice discounts", () => {
  it("reduces the taxable base for a percentage discount", () => {
    expect(computeInvoiceDiscount({ grossSubtotal: 1_000, grossTax: 200, type: "remise_commerciale", mode: "percent", value: 10 })).toEqual({
      grossSubtotal: 1_000,
      discountAmount: 100,
      netSubtotal: 900,
      taxAmount: 180,
      total: 1_080,
    });
  });

  it("routes commercial reductions according to the underlying purchase or sale", () => {
    expect(salesCommercialDiscountAccount("7111")).toBe("7119");
    expect(salesCommercialDiscountAccount("7131")).toBe("7129");
    expect(purchaseCommercialDiscountAccount("6111")).toBe("6119");
    expect(purchaseCommercialDiscountAccount("61254")).toBe("6129");
    expect(purchaseCommercialDiscountAccount("6142")).toBe("6149");
  });
});

