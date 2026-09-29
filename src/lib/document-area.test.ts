import { describe, expect, it } from "vitest";
import { visibleDocumentAreas } from "./document-area";

describe("visibleDocumentAreas", () => {
  it("only exposes purchase rows to the purchase workspace", () => {
    expect(visibleDocumentAreas("purchases")).toEqual(["purchase"]);
  });

  it("only exposes supporting documents to the expense workspace", () => {
    expect(visibleDocumentAreas("expenses")).toEqual(["supporting_document"]);
  });

  it("does not leak newly classified rows across workspaces", () => {
    expect(visibleDocumentAreas("purchases")).not.toContain("supporting_document");
    expect(visibleDocumentAreas("expenses")).not.toContain("purchase");
    expect(visibleDocumentAreas("purchases")).not.toContain("unclassified");
    expect(visibleDocumentAreas("expenses")).not.toContain("unclassified");
  });
});
