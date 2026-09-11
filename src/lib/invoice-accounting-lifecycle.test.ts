import { describe, expect, it } from "vitest";
import { canPermanentlyDeleteInvoice, isInvoiceBookableStatus } from "./invoice-accounting-lifecycle";

describe("invoice accounting lifecycle", () => {
  it("never treats a draft as bookable", () => {
    expect(isInvoiceBookableStatus("draft")).toBe(false);
    expect(isInvoiceBookableStatus("sent")).toBe(true);
    expect(isInvoiceBookableStatus("paid")).toBe(true);
    expect(isInvoiceBookableStatus("partiellement_payee")).toBe(true);
  });

  it("only permanently deletes draft invoices or quotes", () => {
    expect(canPermanentlyDeleteInvoice("draft", "facture")).toBe(true);
    expect(canPermanentlyDeleteInvoice("sent", "facture")).toBe(false);
    expect(canPermanentlyDeleteInvoice("paid", "facture")).toBe(false);
    expect(canPermanentlyDeleteInvoice("envoyé", "devis")).toBe(true);
  });
});
