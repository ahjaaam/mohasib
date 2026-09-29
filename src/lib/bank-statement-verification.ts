import type { OcrDocumentClassification } from "./ocr-engine";

export function isVerifiedBankStatement(classification: OcrDocumentClassification): boolean {
  return classification.section === "bank_statements"
    && classification.documentType === "bank_statement"
    && classification.confidence === "high";
}
