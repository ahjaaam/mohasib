import { describe, expect, it } from "vitest";
import { visibleDocumentAreas } from "./document-area";

describe("visibleDocumentAreas", () => {
  it("keeps legacy rows visible to the purchase workspace", () => {
    expect(visibleDocumentAreas("purchases")).toEqual(["purchase", "legacy"]);
  });

  it("keeps legacy rows visible to the expense workspace", () => {
    expect(visibleDocumentAreas("expenses")).toEqual(["supporting_document", "legacy"]);
  });

  it("does not leak newly classified rows across workspaces", () => {
    expect(visibleDocumentAreas("purchases")).not.toContain("supporting_document");
    expect(visibleDocumentAreas("expenses")).not.toContain("purchase");
  });
});
