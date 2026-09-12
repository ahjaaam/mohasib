import { describe, expect, it } from "vitest";
import { archiveExtension, archiveName } from "./archive-filenames";

describe("archive filenames", () => {
  it("adds the requested extension to dotted invoice numbers", () => {
    expect(archiveName("F.2026.001", "Facture", "pdf")).toBe("F.2026.001.pdf");
  });

  it("preserves a real file extension", () => {
    expect(archiveName("Facture finale.PDF", "Facture", "pdf")).toBe("Facture finale.PDF");
    expect(archiveName("photo.jpeg", "Document", "jpg")).toBe("photo.jpeg");
  });

  it("maps supported MIME types to archive extensions", () => {
    expect(archiveExtension("application/pdf")).toBe("pdf");
    expect(archiveExtension("application/octet-stream")).toBeUndefined();
  });
});
