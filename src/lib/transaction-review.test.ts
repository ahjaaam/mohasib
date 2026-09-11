import { describe, expect, it } from "vitest";
import { prorateVatEvidence, readExplicitVatEvidence, validateReviewChoice } from "./transaction-review";

describe("transaction review controls", () => {
  it("rejects VAT evidence with missing explicit fields instead of assuming 20%", () => {
    expect(readExplicitVatEvidence({ amount: 120, amount_ht: 100 })).toBeNull();
    expect(readExplicitVatEvidence({ amount: 120, tva_rate: 20 })).toBeNull();
  });

  it("accepts internally consistent explicit VAT evidence", () => {
    expect(readExplicitVatEvidence({ amount: 120, amount_ht: 100, tva_amount: 20, tva_rate: 20 }))
      .toEqual({ totalTtc: 120, totalHt: 100, taxAmount: 20, taxRate: 20 });
  });

  it("prorates VAT for a partial payment", () => {
    const evidence = readExplicitVatEvidence({ amount: 120, amount_ht: 100, tax_amount: 20, tax_rate: 20 });
    expect(prorateVatEvidence(evidence!, 60)).toEqual({ amountHt: 50, taxAmount: 10, taxRate: 20 });
  });

  it("requires a reason for an expense posted without deductible VAT", () => {
    expect(validateReviewChoice({ transactionType: "expense", vatStatus: "not_applicable" })).toBeTruthy();
    expect(validateReviewChoice({ transactionType: "expense", vatStatus: "not_applicable", reason: "Frais bancaire" })).toBeNull();
  });

  it("never permits posting while VAT evidence is pending", () => {
    expect(validateReviewChoice({ transactionType: "expense", vatStatus: "pending_evidence" })).toBeTruthy();
  });
});
