import { describe, expect, it } from "vitest";
import { normalizeMainResponse } from "./ocr-engine";

describe("normalizeMainResponse", () => {
  it("keeps supplier invoice defaults for the purchase workflow", () => {
    const result = normalizeMainResponse({
      vendor_name: { value: "Atlas Office", confidence: "high" },
      date: { value: "04/09/2026", confidence: "high" },
      amount_ttc: { value: 120, confidence: "high" },
    });

    expect(result.tva_rate).toBe(20);
    expect(result.due_date).toBe("2026-11-03");
    expect(result.is_supplier_invoice).toBe(true);
  });

  it("does not invent TVA or a due date for an expense note", () => {
    const result = normalizeMainResponse({
      vendor_name: { value: "Café Central", confidence: "high" },
      date: { value: "04/09/2026", confidence: "high" },
      amount_ttc: { value: 48, confidence: "high" },
      document_type: "receipt",
    }, "expense_note");

    expect(result.amount).toBe(-48);
    expect(result.tva_rate).toBeNull();
    expect(result.tva_amount).toBeNull();
    expect(result.due_date).toBeNull();
    expect(result.is_supplier_invoice).toBe(false);
    expect(result.description).toContain("Note de frais");
  });

  it("maps a loose AI category to an option supported by the category dropdown", () => {
    const result = normalizeMainResponse({
      amount_ttc: { value: 350, confidence: "high" },
      category: { value: "Carburant / station-service", confidence: "high" },
      document_type: "receipt",
    }, "expense_note");

    expect(result.category).toBe("Déplacements et missions");
  });
});
