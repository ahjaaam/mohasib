import { describe, expect, it } from "vitest";
import {
  bookAvoirClient,
  bookBankTransaction,
  bookPurchaseInvoice,
  bookSalesInvoice,
  bookSupplierCreditNote,
  supplierCreditNoteCounterpartAccount,
} from "./accounting-engine";

describe("bookPurchaseInvoice", () => {
  it("sends confirmed OCR and the balanced purchase lines to the atomic receipt finalizer", async () => {
    let rpcName = "";
    let rpcArgs: Record<string, unknown> = {};
    const supabase = {
      from: () => { throw new Error("Atomic confirmation must not pre-check or write separately"); },
      rpc: async (name: string, args: Record<string, unknown>) => {
        rpcName = name;
        rpcArgs = args;
        return { data: true, error: null };
      },
    };
    const confirmedOcr = {
      document_type: "invoice", amount_ht: 100, amount_ttc: 120,
      tva_amount: 20, tva_rate: 20, compte: "6111",
    };

    await bookPurchaseInvoice(supabase, {
      id: "receipt-atomic", date: "2026-09-23", description: "Achat",
      total_ht: 100, total_ttc: 120, tva_amount: 20, category: "Achats",
    }, "company-1", null, null, { finalizeReceiptPurchase: true, confirmedOcr });

    expect(rpcName).toBe("finalize_receipt_purchase_accounting_entries");
    expect(rpcArgs).toMatchObject({
      p_source_type: "purchase", p_source_id: "receipt-atomic", p_ocr_data: confirmedOcr,
    });
    expect(rpcArgs.p_entries).toHaveLength(3);
  });

  it("books an on-invoice commercial reduction at net commercial HT without an RRR line", async () => {
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
      description: "Achat de marchandises",
      total_ht: 9000,
      total_ttc: 10800,
      tva_amount: 1800,
      discount_amount: 1000,
      commercial_discount_amount: 1000,
      category: "Achats",
      supplier_name: "Géant Import et Export",
      reference: "2026/15",
    });

    expect(insertedRows.map((row) => ({
      compte: row.compte,
      debit: row.debit,
      credit: row.credit,
    }))).toEqual([
      { compte: "6111", debit: 9000, credit: 0 },
      { compte: "3455", debit: 1800, credit: 0 },
      { compte: "4411", debit: 0, credit: 10800 },
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
      total_ttc: 120,
      tva_amount: 20,
      discount_amount: 6,
      category: "Achats",
    }, null, null, {
      recoverableTvaAccount: "4456",
      purchaseDiscountAccount: "6146",
      supplierAccount: "4491",
    });

    expect(insertedRows.map(row => row.compte)).toEqual(["6111", "4456", "4491"]);
  });

  it("includes commercial reductions in net HT and books only escompte separately", async () => {
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
      total_ht: 94,
      total_ttc: 108,
      tva_amount: 18,
      commercial_discount_amount: 6,
      settlement_discount_amount: 4,
      category: "Achats",
    });

    expect(insertedRows.map(row => row.compte)).toEqual(["6111", "3455", "7386", "4411"]);
  });

  it("does not use an RRR subaccount for a reduction printed on the invoice", async () => {
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
      total_ttc: 120,
      tva_amount: 20,
      commercial_discount_amount: 6,
      category: "Fournitures",
    }, null, null, {
      purchaseConsumedDiscountAccount: "61290001",
    });

    expect(insertedRows.map(row => row.compte)).toEqual(["61254", "3455", "4411"]);
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

describe("bookSupplierCreditNote", () => {
  it("books a post-invoice commercial reduction to the matching RRR account", async () => {
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

    await bookSupplierCreditNote(supabase, {
      id: "supplier-credit-1",
      number: "AV-FOURN-2026-0001",
      date: "2026-09-23",
      supplier_name: "Géant Import et Export",
      total_ht: 1_000,
      tva_amount: 200,
      total_ttc: 1_200,
      original_purchase_account: "6111",
      adjustment_type: "commercial_reduction",
    });

    expect(insertedRows.map(row => ({ compte: row.compte, debit: row.debit, credit: row.credit }))).toEqual([
      { compte: "4411", debit: 1200, credit: 0 },
      { compte: "6119", debit: 0, credit: 1000 },
      { compte: "3455", debit: 0, credit: 200 },
    ]);
  });

  it("selects the RRR family from the original purchase account", () => {
    expect(supplierCreditNoteCounterpartAccount("commercial_reduction", "6111")).toBe("6119");
    expect(supplierCreditNoteCounterpartAccount("commercial_reduction", "61254")).toBe("6129");
    expect(supplierCreditNoteCounterpartAccount("commercial_reduction", "6144")).toBe("6149");
    expect(supplierCreditNoteCounterpartAccount("commercial_reduction", "2350")).toBe("2350");
  });

  it("reverses the original account for returns and uses 7386 for settlement discounts", () => {
    expect(supplierCreditNoteCounterpartAccount("purchase_return", "6111")).toBe("6111");
    expect(supplierCreditNoteCounterpartAccount("invoice_correction", "2350")).toBe("2350");
    expect(supplierCreditNoteCounterpartAccount("settlement_discount", "6111")).toBe("7386");
  });

  it("uses the atomic supplier-credit-note finalizer", async () => {
    let rpcName = "";
    const supabase = {
      from: () => {
        throw new Error("Atomic finalization must not use the non-atomic pre-check");
      },
      rpc: async (name: string) => {
        rpcName = name;
        return { data: true, error: null };
      },
    };

    await bookSupplierCreditNote(supabase, {
      id: "supplier-credit-atomic",
      number: "AV-FOURN-2026-0002",
      date: "2026-09-23",
      supplier_name: "Fournisseur",
      total_ht: 100,
      tva_amount: 20,
      total_ttc: 120,
      original_purchase_account: "6111",
      adjustment_type: "commercial_reduction",
    }, "company-1", null, null, { finalizeSupplierCreditNote: true });

    expect(rpcName).toBe("finalize_supplier_credit_note_accounting_entries");
  });
});

describe("bookSalesInvoice", () => {
  it("uses the atomic database booking function when available", async () => {
    let rpcName = "";
    let rpcArgs: Record<string, unknown> = {};
    const supabase = {
      from: () => ({
        select: () => ({ eq: () => ({ limit: async () => ({ data: [] }) }) }),
      }),
      rpc: async (name: string, args: Record<string, unknown>) => {
        rpcName = name;
        rpcArgs = args;
        return { data: true, error: null };
      },
    };

    await bookSalesInvoice(supabase, {
      id: "00000000-0000-4000-8000-000000000001",
      invoice_number: "F-ATOMIC",
      issue_date: "2026-09-10",
      subtotal: 100,
      tax_amount: 20,
      total: 120,
      items: [{ description: "Prestation", amount: 100, tva_rate: 20 }],
    }, "00000000-0000-4000-8000-000000000002");

    expect(rpcName).toBe("book_accounting_entries");
    expect(rpcArgs).toMatchObject({
      p_company_id: "00000000-0000-4000-8000-000000000002",
      p_dossier_id: null,
      p_source_type: "invoice",
      p_source_id: "00000000-0000-4000-8000-000000000001",
    });
    expect(rpcArgs.p_entries).toHaveLength(3);
  });

  it("uses the finalize transaction when booking an editable draft", async () => {
    let rpcName = "";
    const supabase = {
      from: () => {
        throw new Error("Draft finalization must not use the non-atomic pre-check");
      },
      rpc: async (name: string) => {
        rpcName = name;
        return { data: true, error: null };
      },
    };

    await bookSalesInvoice(supabase, {
      id: "00000000-0000-4000-8000-000000000003",
      invoice_number: "F-DRAFT",
      issue_date: "2026-09-10",
      subtotal: 100,
      tax_amount: 20,
      total: 120,
      items: [{ description: "Prestation", amount: 100, tva_rate: 20 }],
    }, "00000000-0000-4000-8000-000000000002", null, null, {
      finalizeDraftInvoice: true,
    });

    expect(rpcName).toBe("finalize_invoice_accounting_entries");
  });

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

  it("splits only reviewed eligible VAT into the recoverable VAT account", async () => {
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

    await bookBankTransaction(supabase, {
      id: "bank-expense-with-evidence",
      date: "2026-09-10",
      description: "Fournitures justifiées",
      amount: -120,
      category: "Fournitures",
      counterpart_account: "6125",
      vat_status: "eligible",
      tax_amount: 20,
    });

    expect(insertedRows.map(row => ({ compte: row.compte, debit: row.debit, credit: row.credit }))).toEqual([
      { compte: "6125", debit: 100, credit: 0 },
      { compte: "3455", debit: 20, credit: 0 },
      { compte: "5141", debit: 0, credit: 120 },
    ]);
  });

  it("does not deduct a supplied tax amount unless VAT is eligible", async () => {
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

    await bookBankTransaction(supabase, {
      id: "bank-expense-without-evidence",
      date: "2026-09-10",
      description: "Frais sans TVA",
      amount: -120,
      category: "Autre dépense",
      vat_status: "not_applicable",
      tax_amount: 20,
    });

    expect(insertedRows.map(row => row.compte)).toEqual(["6143", "5141"]);
    expect(insertedRows[0].debit).toBe(120);
  });
});

describe("bookAvoirClient", () => {
  it("uses the atomic credit-note finalization transaction for a draft", async () => {
    let rpcName = "";
    let rpcArgs: Record<string, unknown> = {};
    const supabase = {
      from: () => {
        throw new Error("Credit-note finalization must not use the non-atomic pre-check");
      },
      rpc: async (name: string, args: Record<string, unknown>) => {
        rpcName = name;
        rpcArgs = args;
        return { data: true, error: null };
      },
    };

    await bookAvoirClient(supabase, {
      id: "00000000-0000-4000-8000-000000000004",
      invoice_number: "AV-DRAFT",
      issue_date: "2026-09-11",
      subtotal: 100,
      tax_amount: 20,
      total: 120,
      items: [{ description: "Correction", amount: 100, tva_rate: 20 }],
    }, "00000000-0000-4000-8000-000000000002", null, null, {
      finalizeDraftCreditNote: true,
    });

    expect(rpcName).toBe("finalize_credit_note_accounting_entries");
    expect(rpcArgs).toMatchObject({
      p_source_type: "avoir_client",
      p_source_id: "00000000-0000-4000-8000-000000000004",
    });
  });
});
