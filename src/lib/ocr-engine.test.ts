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

  it("keeps commercial discounts separate from settlement discounts", () => {
    const result = normalizeMainResponse({
      amount_ttc: { value: 1_080, confidence: "high" },
      amount_ht: { value: 1_000, confidence: "high" },
      tva_amount: { value: 180, confidence: "high" },
      discount_type: { value: "remise commerciale", confidence: "high" },
      commercial_discount_amount: { value: 80, confidence: "high" },
      settlement_discount_amount: { value: 20, confidence: "high" },
    });

    expect(result.discount_type).toBe("remise_commerciale");
    expect(result.commercial_discount_amount).toBe(80);
    expect(result.settlement_discount_amount).toBe(20);
    expect(result.discount_amount).toBe(100);
  });
});
