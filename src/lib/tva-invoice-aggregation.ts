import { normalizeInvoiceVatTreatment, type InvoiceVatTreatment } from "./invoice-vat-treatment";

export type VatRateBucket = 7 | 10 | 14 | 20;

export interface VatInvoiceRecord {
  id?: unknown;
  invoice_number?: unknown;
  clients?: unknown;
  issue_date?: unknown;
  total?: unknown;
  subtotal?: unknown;
  tax_rate?: unknown;
  tax_amount?: unknown;
  discount_amount?: unknown;
  invoice_type?: unknown;
  items?: unknown;
  paiements?: unknown;
  vat_treatment?: unknown;
}

export type VatTaxPoint = "cash" | "debit";

export interface VatPaymentRecord {
  invoice_id?: unknown;
  montant?: unknown;
  date_paiement?: unknown;
  mode_paiement?: unknown;
  payment_type?: unknown;
  allocation_status?: unknown;
}

export interface PeriodVatInvoiceContribution {
  invoice: VatInvoiceRecord;
  ratio: number;
  aggregation: VatInvoiceAggregation;
}

export interface VatInvoiceAggregation {
  bases: Record<VatRateBucket, number>;
  taxes: Record<VatRateBucket, number>;
  zeroRatedBases: Record<InvoiceVatTreatment | "unclassified", number>;
  netSubtotal: number;
}

const SUPPORTED_RATES = new Set<VatRateBucket>([7, 10, 14, 20]);

function finiteNonNegative(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
}

function rateBucket(value: unknown): VatRateBucket | null {
  const rate = Number(value);
  return SUPPORTED_RATES.has(rate as VatRateBucket) ? rate as VatRateBucket : null;
}

function emptyBuckets(): Record<VatRateBucket, number> {
  return { 7: 0, 10: 0, 14: 0, 20: 0 };
}

function emptyZeroRatedBuckets(): Record<InvoiceVatTreatment | "unclassified", number> {
  return {
    out_of_scope: 0,
    exempt_without_deduction: 0,
    exempt_with_deduction: 0,
    suspension: 0,
    unclassified: 0,
  };
}

function normalizedText(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function dateInPeriod(value: unknown, periodStart: string, periodEnd: string) {
  const date = String(value ?? "").slice(0, 10);
  return date >= periodStart && date <= periodEnd;
}

function paymentKey(invoiceId: unknown, date: unknown, amount: unknown, mode: unknown) {
  return `${String(invoiceId ?? "")}|${String(date ?? "").slice(0, 10)}|${finiteNonNegative(amount).toFixed(2)}|${normalizedText(mode)}`;
}

function periodCollectionsByInvoice(
  invoices: VatInvoiceRecord[],
  payments: VatPaymentRecord[],
  periodStart: string,
  periodEnd: string,
) {
  const totals = new Map<string, number>();
  const mirrored = new Map<string, number>();
  for (const payment of payments) {
    if (normalizedText(payment.allocation_status) !== "confirmed") continue;
    if (normalizedText(payment.payment_type) !== "encaissement") continue;
    if (!dateInPeriod(payment.date_paiement, periodStart, periodEnd)) continue;
    const invoiceId = String(payment.invoice_id ?? "");
    if (!invoiceId) continue;
    const amount = finiteNonNegative(payment.montant);
    totals.set(invoiceId, (totals.get(invoiceId) ?? 0) + amount);
    const key = paymentKey(invoiceId, payment.date_paiement, payment.montant, payment.mode_paiement);
    mirrored.set(key, (mirrored.get(key) ?? 0) + 1);
  }

  for (const invoice of invoices) {
    const invoiceId = String(invoice.id ?? "");
    if (!invoiceId || !Array.isArray(invoice.paiements)) continue;
    for (const payment of invoice.paiements as Array<Record<string, unknown>>) {
      if (!dateInPeriod(payment.date, periodStart, periodEnd)) continue;
      const key = paymentKey(invoiceId, payment.date, payment.montant, payment.mode);
      const mirroredCount = mirrored.get(key) ?? 0;
      if (mirroredCount > 0) {
        mirrored.set(key, mirroredCount - 1);
        continue;
      }
      totals.set(invoiceId, (totals.get(invoiceId) ?? 0) + finiteNonNegative(payment.montant));
    }
  }
  return totals;
}

export function netInvoiceSubtotal(invoice: VatInvoiceRecord) {
  const grossSubtotal = finiteNonNegative(invoice.subtotal);
  const discountAmount = Math.min(grossSubtotal, finiteNonNegative(invoice.discount_amount));
  return grossSubtotal - discountAmount;
}

export function aggregateInvoiceVat(invoice: VatInvoiceRecord): VatInvoiceAggregation {
  const bases = emptyBuckets();
  const taxes = emptyBuckets();
  const zeroRatedBases = emptyZeroRatedBuckets();
  const netSubtotal = netInvoiceSubtotal(invoice);
  const items = Array.isArray(invoice.items) ? invoice.items as Array<Record<string, unknown>> : [];
  const itemTotal = items.reduce((sum, item) => sum + finiteNonNegative(item.amount), 0);

  if (items.length > 0 && itemTotal > 0) {
    const netRatio = netSubtotal / itemTotal;
    for (const item of items) {
      const rawRate = Number(item.tva_rate ?? invoice.tax_rate);
      const amount = finiteNonNegative(item.amount) * netRatio;
      const bucket = rateBucket(rawRate);
      if (bucket) bases[bucket] += amount;
      else if (rawRate === 0) {
        const treatment = normalizeInvoiceVatTreatment(item.vat_treatment ?? invoice.vat_treatment);
        zeroRatedBases[treatment ?? "unclassified"] += amount;
      }
    }
  } else {
    const rawRate = Number(invoice.tax_rate);
    const bucket = rateBucket(rawRate);
    if (bucket) bases[bucket] = netSubtotal;
    else if (rawRate === 0) {
      const treatment = normalizeInvoiceVatTreatment(invoice.vat_treatment);
      zeroRatedBases[treatment ?? "unclassified"] = netSubtotal;
    }
  }

  let calculatedTax = 0;
  for (const rate of SUPPORTED_RATES) {
    taxes[rate] = bases[rate] * rate / 100;
    calculatedTax += taxes[rate];
  }

  const storedTax = Number(invoice.tax_amount);
  if (Number.isFinite(storedTax) && storedTax >= 0 && calculatedTax > 0) {
    const taxRatio = storedTax / calculatedTax;
    for (const rate of SUPPORTED_RATES) taxes[rate] *= taxRatio;
  }

  return { bases, taxes, zeroRatedBases, netSubtotal };
}

export function annualInvoiceTurnover(invoice: VatInvoiceRecord) {
  const amount = netInvoiceSubtotal(invoice);
  if (invoice.invoice_type === "avoir_client") return -amount;
  if (invoice.invoice_type === "proforma") return 0;
  return amount;
}

/**
 * Returns the invoice VAT that becomes exigible in a declaration period.
 * Morocco's default cash basis recognizes regular invoices proportionally to
 * confirmed collections; an explicit debit election recognizes them at issue.
 * Customer credit notes are recognized on issue as tax-base corrections.
 */
export function invoiceVatContributionsForPeriod(
  invoices: VatInvoiceRecord[],
  payments: VatPaymentRecord[],
  taxPoint: VatTaxPoint,
  periodStart: string,
  periodEnd: string,
): PeriodVatInvoiceContribution[] {
  const collections = taxPoint === "cash"
    ? periodCollectionsByInvoice(invoices, payments, periodStart, periodEnd)
    : new Map<string, number>();

  const contributions: PeriodVatInvoiceContribution[] = [];
  for (const invoice of invoices) {
    const isCreditNote = invoice.invoice_type === "avoir_client";
    const inIssuePeriod = dateInPeriod(invoice.issue_date, periodStart, periodEnd);
    let ratio = 0;
    if (isCreditNote) ratio = inIssuePeriod ? -1 : 0;
    else if (invoice.invoice_type === "facture") {
      if (taxPoint === "debit") ratio = inIssuePeriod ? 1 : 0;
      else {
        const total = finiteNonNegative(invoice.total);
        const collected = collections.get(String(invoice.id ?? "")) ?? 0;
        ratio = total > 0 ? Math.min(1, collected / total) : 0;
      }
    }
    if (ratio === 0) continue;
    contributions.push({ invoice, ratio, aggregation: aggregateInvoiceVat(invoice) });
  }
  return contributions;
}
