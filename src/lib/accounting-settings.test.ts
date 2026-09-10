import { describe, expect, it } from "vitest";
import { DEFAULT_ACCOUNTING_SETTINGS, normalizeAccountingSettings } from "./accounting-settings";

describe("normalizeAccountingSettings", () => {
  it("uses CGNC defaults when no settings were saved", () => {
    expect(normalizeAccountingSettings(null)).toEqual(DEFAULT_ACCOUNTING_SETTINGS);
  });

  it("keeps valid custom accounts and rejects unknown codes", () => {
    expect(normalizeAccountingSettings({
      clientAccount: "34210001",
      salesAccount: "9999",
      bankAccount: "5161",
    })).toEqual({
      ...DEFAULT_ACCOUNTING_SETTINGS,
      clientAccount: "34210001",
      bankAccount: "5161",
    });
  });

  it("normalizes customizable category mappings", () => {
    const settings = normalizeAccountingSettings({
      revenueCategoryAccounts: { Services: "7111", Ventes: "6111" },
      expenseCategoryAccounts: { Consulting: "6144", Transport: "9999", "Publicité digitale": "61441" },
    });

    expect(settings.revenueCategoryAccounts.Services).toBe("7111");
    expect(settings.revenueCategoryAccounts.Ventes).toBe(DEFAULT_ACCOUNTING_SETTINGS.revenueCategoryAccounts.Ventes);
    expect(settings.expenseCategoryAccounts.Consulting).toBe("6144");
    expect(settings.expenseCategoryAccounts.Transport).toBe(DEFAULT_ACCOUNTING_SETTINGS.expenseCategoryAccounts.Transport);
    expect(settings.expenseCategoryAccounts["Publicité digitale"]).toBe("61441");
  });
});
