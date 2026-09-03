import { describe, expect, it } from "vitest";
import {
  inferBankTransactionCategory,
  resolveBankTransactionCategory,
} from "./bank-transaction-category";

describe("bank transaction categorization", () => {
  it.each([
    ["COMMISSION TENUE DE COMPTE", -120, "Banque"],
    ["PAIEMENT TVA DGI", -4_500, "Fiscalité"],
    ["VIREMENT SALAIRES AOUT", -28_000, "Salaires"],
    ["PRELEVEMENT MAROC TELECOM", -599, "Communication"],
    ["CARBURANT STATION SERVICE", -700, "Transport"],
    ["REGLEMENT CLIENT FACTURE 42", 8_000, "Ventes"],
    ["REMBOURSEMENT FOURNISSEUR", 350, "Remboursement"],
  ])("classifies %s", (description, amount, expected) => {
    expect(inferBankTransactionCategory(description, amount)).toBe(expected);
  });

  it("keeps a valid AI category for the correct transaction direction", () => {
    expect(resolveBankTransactionCategory("Loyer", -5_000, "VIREMENT")).toBe("Loyer");
  });

  it("rejects an income category on an expense and uses the local fallback", () => {
    expect(resolveBankTransactionCategory("Ventes", -250, "FRAIS BANCAIRE")).toBe("Banque");
  });
});
