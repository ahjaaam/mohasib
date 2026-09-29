import { normalizeDocumentType } from "./document-classification";

export type EmailImportMode = "accounting_documents" | "receipts_only";

export function shouldImportEmailDocument(
  ocrData: Record<string, unknown>,
  mode: EmailImportMode,
) {
  const documentType = normalizeDocumentType(ocrData.document_type);
  if (mode === "accounting_documents") {
    return documentType === "invoice" || documentType === "avoir";
  }
  return documentType === "receipt";
}
