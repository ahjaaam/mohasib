import type { ReceiptDocumentArea } from "@/types";

export type DocumentWorkspace = "purchases" | "expenses";

export function visibleDocumentAreas(workspace: DocumentWorkspace): ReceiptDocumentArea[] {
  return workspace === "purchases"
    ? ["purchase"]
    : ["supporting_document"];
}
