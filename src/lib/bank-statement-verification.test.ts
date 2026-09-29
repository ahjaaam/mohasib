import { describe, expect, it } from "vitest";
import { isVerifiedBankStatement } from "./bank-statement-verification";
import { deterministicBankClassification, normalizeDocumentClassification } from "./ocr-engine";

describe("bank statement import verification", () => {
  it("accepts only an explicitly identified high-confidence bank statement", () => {
    expect(isVerifiedBankStatement(normalizeDocumentClassification({
      section: "bank_statements", document_type: "bank_statement", confidence: "high",
    }))).toBe(true);
  });

  it.each([
    { section: "purchases", document_type: "invoice", confidence: "high" },
    { section: "expense_notes", document_type: "receipt", confidence: "high" },
    { section: "bank_statements", document_type: "invoice", confidence: "high" },
    { section: "bank_statements", document_type: "bank_statement", confidence: "medium" },
    { section: "bank_statements", document_type: "bank_statement", confidence: "low" },
  ])("rejects a different or uncertain document: $section / $document_type / $confidence", raw => {
    expect(isVerifiedBankStatement(normalizeDocumentClassification(raw))).toBe(false);
  });

  it("recognizes statement columns while refusing an invoice payment table", () => {
    expect(deterministicBankClassification(
      "Relevé bancaire du compte 123 Date opération Libellé Débit Crédit Solde",
    )).toMatchObject({ section: "bank_statements", confidence: "high" });
    expect(deterministicBankClassification(
      "Facture N° 42 Total TTC Date opération Libellé Débit Crédit Solde",
    )).toBeNull();
  });
});
