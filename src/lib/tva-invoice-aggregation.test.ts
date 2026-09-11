import { describe, expect, it } from "vitest";
import { aggregateInvoiceVat, annualInvoiceTurnover, invoiceVatContributionsForPeriod } from "./tva-invoice-aggregation";

describe("VAT invoice aggregation", () => {
  it("uses the net taxable base and stored VAT for a discounted invoice", () => {
    const result = aggregateInvoiceVat({
      subtotal: 1_000,
      discount_amount: 100,
      tax_rate: 20,
      tax_amount: 180,
      items: [{ amount: 1_000, tva_rate: 20 }],
    });

    expect(result.netSubtotal).toBe(900);
    expect(result.bases[20]).toBe(900);
    expect(result.taxes[20]).toBe(180);
  });

  it("applies an invoice-level discount proportionally across mixed VAT rates", () => {
    const result = aggregateInvoiceVat({
      subtotal: 1_500,
      discount_amount: 150,
      tax_amount: 225,
      items: [
        { amount: 1_000, tva_rate: 20 },
        { amount: 500, tva_rate: 10 },
      ],
    });

    expect(result.bases[20]).toBe(900);
    expect(result.bases[10]).toBe(450);
    expect(result.taxes[20]).toBe(180);
    expect(result.taxes[10]).toBe(45);
  });

  it.each([
    ["out_of_scope", "out_of_scope"],
    ["exempt_without_deduction", "exempt_without_deduction"],
    ["exempt_with_deduction", "exempt_with_deduction"],
    ["suspension", "suspension"],
  ] as const)("classifies a 0%% invoice as %s", (vatTreatment, bucket) => {
    const result = aggregateInvoiceVat({
      subtotal: 1_000,
      discount_amount: 100,
      tax_rate: 0,
      tax_amount: 0,
      vat_treatment: vatTreatment,
      items: [{ amount: 1_000, tva_rate: 0 }],
    });

    expect(result.zeroRatedBases[bucket]).toBe(900);
    expect(Object.values(result.bases).reduce((sum, amount) => sum + amount, 0)).toBe(0);
  });

  it("keeps an unclassified legacy 0% invoice visible for remediation", () => {
    const result = aggregateInvoiceVat({ subtotal: 1_000, tax_rate: 0, tax_amount: 0, items: [] });
    expect(result.zeroRatedBases.unclassified).toBe(1_000);
  });

  it("uses net invoices and subtracts credit notes from annual turnover", () => {
    expect(annualInvoiceTurnover({ subtotal: 1_000, discount_amount: 100, invoice_type: "facture" })).toBe(900);
    expect(annualInvoiceTurnover({ subtotal: 300, discount_amount: 30, invoice_type: "avoir_client" })).toBe(-270);
    expect(annualInvoiceTurnover({ subtotal: 500, invoice_type: "proforma" })).toBe(0);
  });
});

describe("VAT taxable event", () => {
  const invoice = {
    id: "inv-1",
    invoice_type: "facture",
    issue_date: "2026-01-10",
    subtotal: 1_000,
    discount_amount: 100,
    tax_rate: 20,
    tax_amount: 180,
    total: 1_080,
  };

  it("recognizes only the collected proportion on the default cash basis", () => {
    const [result] = invoiceVatContributionsForPeriod([invoice], [{
      invoice_id: "inv-1",
      montant: 540,
      date_paiement: "2026-02-12",
      payment_type: "encaissement",
      allocation_status: "confirmed",
    }], "cash", "2026-02-01", "2026-02-28");
    expect(result.ratio).toBe(0.5);
    expect(result.aggregation.bases[20] * result.ratio).toBe(450);
    expect(result.aggregation.taxes[20] * result.ratio).toBe(90);
  });

  it("recognizes a classified 0% base only in proportion to confirmed collections", () => {
    const [result] = invoiceVatContributionsForPeriod([{
      ...invoice,
      tax_rate: 0,
      tax_amount: 0,
      total: 900,
      vat_treatment: "exempt_with_deduction",
      items: [{ amount: 1_000, tva_rate: 0 }],
    }], [{
      invoice_id: "inv-1",
      montant: 450,
      date_paiement: "2026-02-12",
      payment_type: "encaissement",
      allocation_status: "confirmed",
    }], "cash", "2026-02-01", "2026-02-28");

    expect(result.ratio).toBe(0.5);
    expect(result.aggregation.zeroRatedBases.exempt_with_deduction * result.ratio).toBe(450);
  });

  it("does not recognize unconfirmed collections", () => {
    expect(invoiceVatContributionsForPeriod([invoice], [{
      invoice_id: "inv-1", montant: 1_080, date_paiement: "2026-02-12",
      payment_type: "encaissement", allocation_status: "suggested",
    }], "cash", "2026-02-01", "2026-02-28")).toEqual([]);
  });

  it("recognizes the full invoice at issue only after a debit election", () => {
    expect(invoiceVatContributionsForPeriod([invoice], [], "debit", "2026-01-01", "2026-01-31")[0].ratio).toBe(1);
    expect(invoiceVatContributionsForPeriod([invoice], [], "debit", "2026-02-01", "2026-02-28")).toEqual([]);
  });

  it("recognizes customer credit notes as negative period corrections", () => {
    const [credit] = invoiceVatContributionsForPeriod([{
      ...invoice,
      id: "credit-1",
      invoice_type: "avoir_client",
      issue_date: "2026-02-15",
      subtotal: 200,
      discount_amount: 0,
      tax_amount: 40,
      total: 240,
    }], [], "cash", "2026-02-01", "2026-02-28");
    expect(credit.ratio).toBe(-1);
    expect(credit.aggregation.taxes[20] * credit.ratio).toBe(-40);
  });

  it("deduplicates a payment mirrored in allocations and invoice history", () => {
    const withHistory = { ...invoice, paiements: [{ montant: 540, date: "2026-02-12", mode: "virement" }] };
    const [result] = invoiceVatContributionsForPeriod([withHistory], [{
      invoice_id: "inv-1", montant: 540, date_paiement: "2026-02-12", mode_paiement: "virement",
      payment_type: "encaissement", allocation_status: "confirmed",
    }], "cash", "2026-02-01", "2026-02-28");
    expect(result.ratio).toBe(0.5);
  });
});
