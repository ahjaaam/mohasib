import type { ReceiptDocumentArea } from "@/types";

export type DocumentWorkspace = "purchases" | "expenses";

/** Legacy rows stay visible in both workspaces because their original source is unknowable. */
export function visibleDocumentAreas(workspace: DocumentWorkspace): ReceiptDocumentArea[] {
  return workspace === "purchases"
    ? ["purchase", "legacy"]
    : ["supporting_document", "legacy"];
}
