import { describe, expect, it } from "vitest";
import { bookBankTransaction, bookPurchaseInvoice, bookSalesInvoice } from "./accounting-engine";

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

  it("applies workspace account overrides to future entries", async () => {
    let insertedRows: Array<Record<string, unknown>> = [];
    const supabase = {
      from: () => ({
        select: () => ({ eq: () => ({ limit: async () => ({ data: [] }) }) }),
        insert: async (rows: Array<Record<string, unknown>>) => {
          insertedRows = rows;
          return { error: null };
        },
      }),
    };

    await bookPurchaseInvoice(supabase, {
      id: "custom-accounts",
      date: "2026-09-09",
      description: "Achat avec schéma personnalisé",
      total_ht: 100,
      total_ttc: 114,
      tva_amount: 20,
      discount_amount: 6,
      category: "Achats",
    }, null, null, {
      recoverableTvaAccount: "4456",
      purchaseDiscountAccount: "6146",
      supplierAccount: "4491",
    });

    expect(insertedRows.map(row => row.compte)).toEqual(["6111", "4456", "6146", "4491"]);
  });

  it("books commercial reductions and escompte to distinct accounts", async () => {
    let insertedRows: Array<Record<string, unknown>> = [];
    const supabase = {
      from: () => ({
        select: () => ({ eq: () => ({ limit: async () => ({ data: [] }) }) }),
        insert: async (rows: Array<Record<string, unknown>>) => {
          insertedRows = rows;
          return { error: null };
        },
      }),
    };

    await bookPurchaseInvoice(supabase, {
      id: "typed-discounts",
      date: "2026-09-09",
      description: "Achat avec réductions",
      total_ht: 100,
      total_ttc: 108,
      tva_amount: 18,
      commercial_discount_amount: 6,
      settlement_discount_amount: 4,
      category: "Achats",
    });

    expect(insertedRows.map(row => row.compte)).toEqual(["6111", "3455", "6119", "7386", "4411"]);
  });

  it("uses customized RRR subaccounts for each purchase family", async () => {
    let insertedRows: Array<Record<string, unknown>> = [];
    const supabase = {
      from: () => ({
        select: () => ({ eq: () => ({ limit: async () => ({ data: [] }) }) }),
        insert: async (rows: Array<Record<string, unknown>>) => {
          insertedRows = rows;
          return { error: null };
        },
      }),
    };

    await bookPurchaseInvoice(supabase, {
      id: "custom-purchase-rrr",
      date: "2026-09-09",
      description: "Fournitures avec remise",
      total_ht: 100,
      total_ttc: 114,
      tva_amount: 20,
      commercial_discount_amount: 6,
      category: "Fournitures",
    }, null, null, {
      purchaseConsumedDiscountAccount: "61290001",
    });

    expect(insertedRows.map(row => row.compte)).toEqual(["61254", "3455", "61290001", "4411"]);
  });

  it("uses a customized expense category mapping when no account was confirmed", async () => {
    let insertedRows: Array<Record<string, unknown>> = [];
    const supabase = {
      from: () => ({
        select: () => ({ eq: () => ({ limit: async () => ({ data: [] }) }) }),
        insert: async (rows: Array<Record<string, unknown>>) => {
          insertedRows = rows;
          return { error: null };
        },
      }),
    };

    await bookPurchaseInvoice(supabase, {
      id: "custom-expense-mapping",
      date: "2026-09-09",
      description: "Conseil marketing",
      total_ht: 100,
      total_ttc: 120,
      tva_amount: 20,
      category: "Consulting",
    }, null, null, {
      expenseCategoryAccounts: { Consulting: "6144" },
    });

    expect(insertedRows.map(row => row.compte)).toEqual(["6144", "3455", "4411"]);
  });
});

describe("bookSalesInvoice", () => {
  it("books an escompte as a financial charge", async () => {
    let insertedRows: Array<Record<string, unknown>> = [];
    const supabase = {
      from: () => ({
        select: () => ({ eq: () => ({ limit: async () => ({ data: [] }) }) }),
        insert: async (rows: Array<Record<string, unknown>>) => {
          insertedRows = rows;
          return { error: null };
        },
      }),
    };

    await bookSalesInvoice(supabase, {
      id: "sale-with-escompte",
      invoice_number: "F-100",
      issue_date: "2026-09-09",
      subtotal: 1_000,
      discount_type: "escompte",
      discount_amount: 100,
      tax_amount: 180,
      total: 1_080,
      items: [{ description: "Prestation", amount: 1_000, tva_rate: 20 }],
    });

    expect(insertedRows.map(row => row.compte)).toEqual(["3421", "7131", "6386", "4455"]);
  });

  it("uses a customized sales RRR subaccount", async () => {
    let insertedRows: Array<Record<string, unknown>> = [];
    const supabase = {
      from: () => ({
        select: () => ({ eq: () => ({ limit: async () => ({ data: [] }) }) }),
        insert: async (rows: Array<Record<string, unknown>>) => {
          insertedRows = rows;
          return { error: null };
        },
      }),
    };

    await bookSalesInvoice(supabase, {
      id: "sale-with-custom-rrr",
      invoice_number: "F-101",
      issue_date: "2026-09-09",
      subtotal: 1_000,
      discount_type: "remise_commerciale",
      discount_amount: 100,
      tax_amount: 180,
      total: 1_080,
      items: [{ description: "Prestation", amount: 1_000, tva_rate: 20 }],
    }, null, null, { salesCommercialDiscountAccount: "71290001" });

    expect(insertedRows.map(row => row.compte)).toEqual(["3421", "7131", "71290001", "4455"]);
  });
});

describe("bookBankTransaction", () => {
  it("uses customized revenue and expense category mappings", async () => {
    const insertedBatches: Array<Array<Record<string, unknown>>> = [];
    const supabase = {
      from: () => ({
        select: () => ({ eq: () => ({ limit: async () => ({ data: [] }) }) }),
        insert: async (rows: Array<Record<string, unknown>>) => {
          insertedBatches.push(rows);
          return { error: null };
        },
      }),
    };

    await bookBankTransaction(supabase, {
      id: "bank-income-mapping",
      date: "2026-09-09",
      description: "Loyer reçu",
      amount: 500,
      category: "Loyer reçu",
    }, null, null, { revenueCategoryAccounts: { "Loyer reçu": "7311" } });
    await bookBankTransaction(supabase, {
      id: "bank-expense-mapping",
      date: "2026-09-09",
      description: "Publicité",
      amount: -200,
      category: "Publicité",
    }, null, null, { expenseCategoryAccounts: { Publicité: "6141" } });

    expect(insertedBatches[0].map(row => row.compte)).toEqual(["5141", "7311"]);
    expect(insertedBatches[1].map(row => row.compte)).toEqual(["6141", "5141"]);
  });
});
