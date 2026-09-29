import { describe, expect, it } from "vitest";
import { shouldImportEmailDocument } from "./email-document-filter";

describe("shouldImportEmailDocument", () => {
  it.each(["receipt", "Receipt", "ticket", "till-receipt", " reçu "])(
    "accepts %s in receipts-only mode",
    (documentType) => {
      expect(shouldImportEmailDocument({ document_type: documentType }, "receipts_only")).toBe(true);
    },
  );

  it.each(["invoice", "facture", "avoir", "credit_note", "note_de_credit"])(
    "rejects %s in receipts-only mode",
    (documentType) => {
      expect(shouldImportEmailDocument({ document_type: documentType }, "receipts_only")).toBe(false);
    },
  );

  it("does not use filenames or subjects as classification evidence", () => {
    expect(shouldImportEmailDocument({}, "receipts_only")).toBe(false);
    expect(shouldImportEmailDocument({ document_type: "made_up" }, "accounting_documents")).toBe(false);
  });

  it("preserves the existing invoice sync mode", () => {
    expect(shouldImportEmailDocument({ document_type: "invoice" }, "accounting_documents")).toBe(true);
    expect(shouldImportEmailDocument({ document_type: "receipt" }, "accounting_documents")).toBe(false);
  });
});
