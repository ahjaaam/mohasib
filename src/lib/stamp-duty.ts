export const CASH_RECEIPT_STAMP_DUTY_RATE = 0.0025;

export interface StampDutyPayment {
  invoice_id?: string | null;
  montant?: number | string | null;
  date_paiement?: string | null;
  mode_paiement?: string | null;
  payment_type?: string | null;
  allocation_status?: string | null;
}

export interface InvoiceWithRecordedPayments {
  id: string;
  paiements?: unknown;
}

interface RecordedInvoicePayment {
  date?: string | null;
  montant?: number | string | null;
  mode?: string | null;
}

function normalize(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

export function isCashPaymentMode(mode: string | null | undefined): boolean {
  return ["cash", "espece", "especes", "en espece", "en especes"].includes(normalize(mode));
}

function roundMAD(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Moroccan receipt stamp duty: 0.25% of confirmed cash collections.
 * Non-cash payments, outgoing payments, and unconfirmed allocations do not qualify.
 */
export function calculateCashReceiptStampDuty(payments: StampDutyPayment[]): number {
  const qualifyingCashReceipts = payments.reduce((total, payment) => {
    if (normalize(payment.allocation_status) !== "confirmed") return total;
    if (normalize(payment.payment_type) !== "encaissement") return total;
    if (!isCashPaymentMode(payment.mode_paiement)) return total;

    const amount = Number(payment.montant ?? 0);
    return Number.isFinite(amount) && amount > 0 ? total + amount : total;
  }, 0);

  return roundMAD(qualifyingCashReceipts * CASH_RECEIPT_STAMP_DUTY_RATE);
}

function isInPeriod(date: string | null | undefined, periodStart: string, periodEnd: string): boolean {
  return Boolean(date && date >= periodStart && date <= periodEnd);
}

function paymentKey(
  invoiceId: string | null | undefined,
  date: string | null | undefined,
  amount: number | string | null | undefined,
  mode: string | null | undefined,
): string {
  return `${invoiceId ?? ""}|${date ?? ""}|${Number(amount ?? 0).toFixed(2)}|${normalize(mode)}`;
}

/**
 * Combines normalized allocations with the legacy invoice payment history.
 * Allocation workflows may mirror the same payment into both stores, so exact
 * mirrored entries are consumed once rather than charging stamp duty twice.
 */
export function calculatePeriodCashReceiptStampDuty(
  allocations: StampDutyPayment[],
  invoices: InvoiceWithRecordedPayments[],
  periodStart: string,
  periodEnd: string,
): number {
  const periodAllocations = allocations.filter((payment) =>
    isInPeriod(payment.date_paiement, periodStart, periodEnd)
  );
  const mirroredAllocationCounts = new Map<string, number>();

  for (const payment of periodAllocations) {
    const key = paymentKey(payment.invoice_id, payment.date_paiement, payment.montant, payment.mode_paiement);
    mirroredAllocationCounts.set(key, (mirroredAllocationCounts.get(key) ?? 0) + 1);
  }

  const unmatchedRecordedPayments: StampDutyPayment[] = [];
  for (const invoice of invoices) {
    if (!Array.isArray(invoice.paiements)) continue;

    for (const recorded of invoice.paiements as RecordedInvoicePayment[]) {
      if (!isInPeriod(recorded.date, periodStart, periodEnd)) continue;

      const key = paymentKey(invoice.id, recorded.date, recorded.montant, recorded.mode);
      const mirroredCount = mirroredAllocationCounts.get(key) ?? 0;
      if (mirroredCount > 0) {
        mirroredAllocationCounts.set(key, mirroredCount - 1);
        continue;
      }

      unmatchedRecordedPayments.push({
        invoice_id: invoice.id,
        montant: recorded.montant,
        date_paiement: recorded.date,
        mode_paiement: recorded.mode,
        payment_type: "encaissement",
        allocation_status: "confirmed",
      });
    }
  }

  return calculateCashReceiptStampDuty([...periodAllocations, ...unmatchedRecordedPayments]);
}
