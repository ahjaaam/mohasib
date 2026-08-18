import { describe, expect, it } from "vitest";
import { normalizeClientInvoiceExtraction } from "./client-invoice-import";

describe("normalizeClientInvoiceExtraction", () => {
  it("normalizes imported invoice fields", () => {
    expect(normalizeClientInvoiceExtraction({
      invoice_number: " FC-104 ", client_name: "Atlas SARL", issue_date: "18/08/2026",
      subtotal: "1 000,00", tax_amount: 200, total: 1200, currency: "mad",
    })).toMatchObject({
      invoiceNumber: "FC-104", clientName: "Atlas SARL", issueDate: "2026-08-18",
      subtotal: 1000, taxRate: 20, taxAmount: 200, total: 1200, currency: "MAD",
    });
  });

  it("derives missing totals safely", () => {
    expect(normalizeClientInvoiceExtraction({ subtotal: 500, tax_amount: 100 })).toMatchObject({
      subtotal: 500, taxAmount: 100, total: 600, taxRate: 20,
    });
  });
});
