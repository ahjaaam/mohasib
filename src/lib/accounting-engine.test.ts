import { describe, expect, it } from "vitest";
import { bookPurchaseInvoice } from "./accounting-engine";

describe("bookPurchaseInvoice", () => {
  it("books a TTC discount separately and keeps the supplier entry balanced", async () => {
    let insertedRows: Array<Record<string, unknown>> = [];
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            limit: async () => ({ data: [] }),
          }),
        }),
        insert: async (rows: Array<Record<string, unknown>>) => {
          insertedRows = rows;
          return { error: null };
        },
      }),
    };

    await bookPurchaseInvoice(supabase, {
      id: "purchase-with-discount",
      date: "2026-01-19",
      description: "Achat réfrigérateurs",
      total_ht: 47205,
      total_ttc: 56079.54,
      tva_amount: 9441,
      discount_amount: 566.46,
      category: "Achats",
      supplier_name: "Géant Import et Export",
      reference: "2026/15",
    });

    expect(insertedRows.map((row) => ({
      compte: row.compte,
      debit: row.debit,
      credit: row.credit,
    }))).toEqual([
      { compte: "6111", debit: 47205, credit: 0 },
      { compte: "3455", debit: 9441, credit: 0 },
      { compte: "6119", debit: 0, credit: 566.46 },
      { compte: "4411", debit: 0, credit: 56079.54 },
    ]);
  });
});
