import { describe, expect, it } from "vitest";
import { categoryToCompte, expenseNoteCategoryToCompte } from "./cgnc-accounts";

describe("CGNC category mappings", () => {
  it("keeps merchandise purchases in account 6111", () => {
    expect(categoryToCompte.Achats).toBe("6111");
  });

  it("never defaults an expense-note category to merchandise purchases", () => {
    expect(Object.values(expenseNoteCategoryToCompte)).not.toContain("6111");
    expect(expenseNoteCategoryToCompte.Transport).toBe("6142");
    expect(expenseNoteCategoryToCompte["Déplacements et missions"]).toBe("6143");
    expect(expenseNoteCategoryToCompte.Fournitures).toBe("61254");
    expect(expenseNoteCategoryToCompte.Communication).toBe("6145");
    expect(expenseNoteCategoryToCompte["Autre dépense"]).toBe("");
  });
});
