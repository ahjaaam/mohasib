import { describe, expect, it } from "vitest";
import { OCR_SECTION_CONFIG, validateOcrSection } from "./ocr-sections";
import { isAmbiguousReceiptType, normalizeDocumentClassification } from "./ocr-engine";

describe("OCR section isolation", () => {
  it("uses fixed, different destinations and OCR profiles", () => {
    expect(OCR_SECTION_CONFIG.purchases).toMatchObject({
      documentArea: "purchase",
      documentKind: "supplier_invoice",
      storageFolder: "purchases",
    });
    expect(OCR_SECTION_CONFIG.expense_notes).toMatchObject({
      documentArea: "supporting_document",
      documentKind: "expense_note",
      storageFolder: "expense-notes",
    });
  });

  it.each(["purchases", "expense_notes"] as const)(
    "rejects bank statements from %s",
    section => {
      expect(validateOcrSection(section, { document_type: "bank_statement" })).toMatchObject({
        code: "wrong_document_section",
        correctSection: "bank_statements",
      });
    },
  );

  it("rejects purchase documents from expense notes", () => {
    expect(validateOcrSection("expense_notes", { document_type: "invoice" })).toMatchObject({
      correctSection: "purchases",
    });
  });

  it("accepts only an expense receipt in the expense-note flow", () => {
    expect(validateOcrSection("expense_notes", { document_type: "receipt" })).toBeNull();
    expect(validateOcrSection("expense_notes", { document_type: "other" })).not.toBeNull();
  });

  it("quarantines missing and unrecognized document types", () => {
    expect(validateOcrSection("purchases", {})).toMatchObject({ correctSection: "unclassified" });
    expect(validateOcrSection("expense_notes", { document_type: "totally_new_type" }))
      .toMatchObject({ correctSection: "unclassified" });
  });

  it("normalizes common bank-statement spelling variants", () => {
    expect(normalizeDocumentClassification({
      section: "Bank Statement",
      document_type: "bank-statement ",
      confidence: "HIGH",
    })).toMatchObject({
      section: "bank_statements",
      documentType: "bank_statement",
      confidence: "high",
    });
  });

  it("quarantines low-confidence classifications", () => {
    expect(normalizeDocumentClassification({
      section: "purchases",
      document_type: "invoice",
      confidence: "low",
    })).toMatchObject({ section: "unclassified", confidence: "low" });
  });

  it.each(["purchases", "expense_notes"])(
    "keeps a receipt submitted to %s unclassified even when the model is confident",
    section => {
      expect(normalizeDocumentClassification({
        section,
        document_type: "receipt",
        confidence: "high",
      })).toMatchObject({
        section: "unclassified",
        documentType: "receipt",
        confidence: "low",
      });
    },
  );

  it("recognizes receipt aliases in later OCR output", () => {
    expect(isAmbiguousReceiptType("Ticket")).toBe(true);
    expect(isAmbiguousReceiptType("reçu")).toBe(true);
    expect(isAmbiguousReceiptType("invoice")).toBe(false);
  });

  it("quarantines inconsistent section and document-type pairs", () => {
    expect(normalizeDocumentClassification({
      section: "purchases",
      document_type: "bank_statement",
      confidence: "high",
    })).toMatchObject({ section: "unclassified", documentType: "bank_statement" });
  });

  it("maps an arbitrary classifier type to unknown and quarantines it", () => {
    expect(normalizeDocumentClassification({
      section: "purchases",
      document_type: "financial_report",
      confidence: "high",
    })).toMatchObject({ section: "unclassified", documentType: "unknown" });
  });
});
