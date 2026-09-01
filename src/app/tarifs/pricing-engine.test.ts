import { describe, expect, it } from "vitest";
import {
  calculatePricing,
  DEFAULT_CABINET_PRICING_CONFIGURATION,
  DEFAULT_PRICING_CONFIGURATION,
  normalizePricingConfiguration,
  pricingEntitlements,
} from "./pricing-engine";

describe("tarifs pricing simulator", () => {
  it("prices the default Entreprise offer", () => {
    const result = calculatePricing(DEFAULT_PRICING_CONFIGURATION);

    expect(result.monthlyTotal).toBe(299);
    expect(result.annualSavings).toBe(359);
    expect(result.annualTotal).toBe(3229);
  });

  it("rounds the ten-percent annual discount to the nearest dirham", () => {
    const result = calculatePricing({
      ...DEFAULT_PRICING_CONFIGURATION,
      accountingUsers: 3,
      ocrDocuments: 500,
      payrollEmployees: 200,
    });

    expect(result.monthlyTotal).toBe(2057);
    expect(result.annualSavings).toBe(2468);
    expect(result.annualTotal).toBe(22216);
  });

  it("uses the revised agriculture example", () => {
    const result = calculatePricing({
      ...DEFAULT_PRICING_CONFIGURATION,
      accountingUsers: 3,
      ocrDocuments: 500,
      payrollEmployees: 200,
      aiSpaces: 1,
    });

    expect(result.monthlyTotal).toBe(2057);
  });

  it("includes ten Cabinet dossiers and 100 OCR documents per dossier", () => {
    const included = calculatePricing({
      ...DEFAULT_PRICING_CONFIGURATION,
      audience: "cabinet",
      managedDossiers: 10,
      accountingUsers: 2,
      connectedClientUsers: 10,
      ocrDocuments: 1000,
    });
    const additional = calculatePricing({
      ...DEFAULT_PRICING_CONFIGURATION,
      audience: "cabinet",
      managedDossiers: 11,
      accountingUsers: 2,
      connectedClientUsers: 11,
      ocrDocuments: 1100,
    });

    expect(included.monthlyTotal).toBe(899);
    expect(additional.monthlyTotal).toBe(1089);
  });

  it("rounds OCR overage upward by blocks of 100", () => {
    expect(calculatePricing({ ...DEFAULT_PRICING_CONFIGURATION, ocrDocuments: 101 }).ocr).toBe(75);
    expect(calculatePricing({ ...DEFAULT_PRICING_CONFIGURATION, ocrDocuments: 201 }).ocr).toBe(150);
  });

  it("includes the first twenty payroll employees", () => {
    expect(calculatePricing({ ...DEFAULT_PRICING_CONFIGURATION, payrollEmployees: 20 }).payroll).toBe(0);
    expect(calculatePricing({ ...DEFAULT_PRICING_CONFIGURATION, payrollEmployees: 21 }).payroll).toBe(7);
  });

  it("caps free AI spaces at five without adding a charge", () => {
    const result = calculatePricing({ ...DEFAULT_PRICING_CONFIGURATION, aiSpaces: 12 });

    expect(result.aiSpaces).toBe(5);
    expect(result.monthlyTotal).toBe(299);
  });

  it("normalizes stored admin pricing values", () => {
    expect(normalizePricingConfiguration({
      ...DEFAULT_PRICING_CONFIGURATION,
      workspaces: "2",
      accountingUsers: 0,
      payrollEmployees: 21.9,
      aiSpaces: 12,
    })).toMatchObject({ workspaces: 2, accountingUsers: 1, payrollEmployees: 21, aiSpaces: 5 });
  });

  it("turns a Cabinet quote into account limits", () => {
    expect(pricingEntitlements({
      ...DEFAULT_CABINET_PRICING_CONFIGURATION,
      managedDossiers: 12,
      connectedClientUsers: 14,
      accountingUsers: 3,
      ocrDocuments: 1_250,
      payrollEmployees: 30,
    })).toEqual({
      ocrLimit: 1_250,
      dossiersLimit: 12,
      usersLimit: 17,
      employeeLimit: 30,
    });
  });
});
