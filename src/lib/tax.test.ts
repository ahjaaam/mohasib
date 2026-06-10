import { describe, expect, it } from "vitest";
import { taxIncludedInAmount } from "./tax";

describe("taxIncludedInAmount", () => {
  it("uses the stored tax amount when available", () => {
    expect(taxIncludedInAmount({ amount: 120, tax_rate: 20, tax_amount: 17 })).toBe(17);
  });

  it("extracts VAT from a tax-inclusive amount", () => {
    expect(taxIncludedInAmount({ amount: 120, tax_rate: 20 })).toBeCloseTo(20);
  });

  it("returns zero for a zero-rated transaction", () => {
    expect(taxIncludedInAmount({ amount: 120, tax_rate: 0 })).toBe(0);
  });
});
