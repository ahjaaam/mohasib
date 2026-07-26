import { describe, expect, it } from "vitest";
import { parseCatalogImportRows } from "./invoice-items-import";

describe("parseCatalogImportRows", () => {
  it("maps French headers and applies defaults", () => {
    const [row] = parseCatalogImportRows([
      ["Nom *", "Description", "Catégorie", "Prix unitaire HT", "Unité", "TVA (%)"],
      ["Audit annuel", "Mission complète", "Conseil", "1 250,50", "service", ""],
    ]);

    expect(row).toMatchObject({
      sourceRow: 2,
      name: "Audit annuel",
      description: "Mission complète",
      category: "Conseil",
      unit: "service",
      unit_price: 1250.5,
      tva_rate: 20,
      errors: [],
    });
  });

  it("flags existing items, file duplicates, and invalid values", () => {
    const rows = parseCatalogImportRows(
      [
        ["Article", "Prix HT", "Unité", "TVA"],
        ["Conseil", -10, "heure", 20],
        ["conseil", 100, "carton", 19],
      ],
      ["CONSEIL"],
    );

    expect(rows[0].errors).toContain("Déjà présent dans le catalogue");
    expect(rows[0].errors).toContain("Prix HT invalide");
    expect(rows[1].errors).toContain("Doublon dans le fichier");
    expect(rows[1].errors).toContain("Unité invalide");
    expect(rows[1].errors).toContain("TVA autorisée : 0, 7, 10, 14 ou 20");
  });

  it("requires a name column", () => {
    expect(() => parseCatalogImportRows([["Description"], ["Test"]])).toThrow(
      'La colonne obligatoire "Nom *" est introuvable.',
    );
  });
});
