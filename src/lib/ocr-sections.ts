import type { OcrDocumentKind } from "./ocr-engine";
import type { ReceiptDocumentArea } from "@/types";
import { normalizeDocumentType } from "./document-classification";

export type OcrSection = "purchases" | "expense_notes";

export interface OcrSectionConfig {
  documentArea: ReceiptDocumentArea;
  documentKind: OcrDocumentKind;
  storageFolder: string;
}

export const OCR_SECTION_CONFIG: Record<OcrSection, OcrSectionConfig> = {
  purchases: {
    documentArea: "purchase",
    documentKind: "supplier_invoice",
    storageFolder: "purchases",
  },
  expense_notes: {
    documentArea: "supporting_document",
    documentKind: "expense_note",
    storageFolder: "expense-notes",
  },
};

export interface OcrSectionMismatch {
  code: "wrong_document_section";
  correctSection: "bank_statements" | "purchases" | "expense_notes" | "unclassified";
  message: string;
}

export function validateOcrSection(
  section: OcrSection,
  ocrData: Record<string, unknown>,
): OcrSectionMismatch | null {
  const documentType = normalizeDocumentType(ocrData.document_type);

  if (documentType === "unknown" || documentType === "other") {
    return {
      code: "wrong_document_section",
      correctSection: "unclassified",
      message: "Ce document n’a pas pu être classé avec fiabilité. Il doit rester dans Documents à classer.",
    };
  }

  if (documentType === "bank_statement") {
    return {
      code: "wrong_document_section",
      correctSection: "bank_statements",
      message: "Ce document est un relevé bancaire. Importez-le depuis Transactions → Importer un relevé bancaire.",
    };
  }

  if (section === "expense_notes" && documentType !== "receipt") {
    const belongsToPurchases = ["invoice", "purchase_order", "delivery_note", "avoir"].includes(documentType);
    return {
      code: "wrong_document_section",
      correctSection: belongsToPurchases ? "purchases" : "expense_notes",
      message: belongsToPurchases
        ? "Ce document est une pièce d’achat. Importez-le depuis Achats."
        : "Ce document n’est pas une note de frais ou un justificatif de dépense reconnu.",
    };
  }

  return null;
}
