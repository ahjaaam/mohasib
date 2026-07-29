import { describe, expect, it } from "vitest";
import { shouldImportEmailDocument } from "./email-document-filter";

describe("shouldImportEmailDocument", () => {
  it.each(["receipt", "ticket", "bon_de_commande", "delivery_note", "voucher"])(
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

  it("uses an explicit receipt filename when OCR cannot classify the document", () => {
    expect(shouldImportEmailDocument({}, "receipts_only", { fileName: "ticket-caisse.pdf" })).toBe(true);
  });

  it("rejects invoice metadata even if it also mentions a bon", () => {
    expect(shouldImportEmailDocument({}, "receipts_only", {
      fileName: "bon-livraison.pdf",
      subject: "Facture et bon de livraison",
    })).toBe(false);
  });

  it("preserves the existing invoice sync mode", () => {
    expect(shouldImportEmailDocument({ document_type: "invoice" }, "accounting_documents")).toBe(true);
    expect(shouldImportEmailDocument({ document_type: "receipt" }, "accounting_documents")).toBe(false);
  });
});
