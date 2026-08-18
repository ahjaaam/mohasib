export interface DeadlinePayment {
  montant?: number | string | null;
  date_paiement?: string | null;
  date?: string | null;
  mode_paiement?: string | null;
  mode?: string | null;
  reference?: string | null;
  allocation_status?: string | null;
}

export interface DeadlineClientInvoice {
  invoice_number?: string | null;
  issue_date?: string | null;
  due_date?: string | null;
  total?: number | string | null;
  montant_recu?: number | string | null;
  status?: string | null;
  clients?: { name?: string | null; ice?: string | null } | null;
  invoice_payments?: DeadlinePayment[] | null;
  paiements?: DeadlinePayment[] | null;
}

export interface DeadlineSupplierInvoice {
  file_name?: string | null;
  created_at?: string | null;
  status?: string | null;
  ocr_data?: {
    vendor_name?: string | null;
    vendor?: string | null;
    receipt_number?: string | null;
    date?: string | null;
    due_date?: string | null;
    amount?: number | string | null;
    montant_paye?: number | string | null;
    payment_status?: string | null;
    supplier_ice?: string | null;
    ice_fournisseur?: string | null;
    supplier_if?: string | null;
    if_fournisseur?: string | null;
  } | null;
  invoice_payments?: DeadlinePayment[] | null;
}

export const PAYMENT_DEADLINE_HEADERS = [
  "Type de facture",
  "Tiers",
  "ICE / IF",
  "N° facture",
  "Date de facture",
  "Date d'échéance",
  "Montant TTC (MAD)",
  "Date de paiement",
  "Montant du paiement (MAD)",
  "Mode de paiement",
  "Référence paiement",
  "Jours de retard",
  "Échéance respectée",
  "Total réglé (MAD)",
  "Solde (MAD)",
  "Statut",
] as const;

function isoDay(value?: string | null) {
  return value?.slice(0, 10) ?? "";
}

function isInPeriod(date: string, start: string, end: string) {
  return Boolean(date && (!start || date >= start) && (!end || date <= end));
}

function dayDifference(from: string, to: string) {
  const fromTime = Date.parse(`${from}T00:00:00Z`);
  const toTime = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(fromTime) || !Number.isFinite(toTime)) return null;
  return Math.max(0, Math.round((toTime - fromTime) / 86_400_000));
}

function confirmedPayments(payments?: DeadlinePayment[] | null) {
  return (payments ?? [])
    .filter((payment) => payment.allocation_status !== "suggested" && payment.allocation_status !== "rejected")
    .filter((payment) => Boolean(payment.date_paiement || payment.date))
    .sort((a, b) => isoDay(a.date_paiement || a.date).localeCompare(isoDay(b.date_paiement || b.date)));
}

function compliance(dueDate: string, paymentDate: string) {
  if (!dueDate) return { delay: "", respected: "Échéance manquante" };
  if (!paymentDate) return { delay: "", respected: "Non réglée" };
  const delay = dayDifference(dueDate, paymentDate);
  return { delay: delay ?? "", respected: delay === null ? "À vérifier" : delay === 0 ? "Oui" : "Non" };
}

function statusLabel(status?: string | null) {
  if (status === "paid") return "Payée";
  if (status === "partiellement_payee" || status === "partial") return "Partiellement payée";
  if (status === "overdue") return "En retard";
  return "Non réglée";
}

function rowsForInvoice(params: {
  type: "Client" | "Fournisseur";
  thirdParty: string;
  fiscalId: string;
  number: string;
  invoiceDate: string;
  dueDate: string;
  total: number;
  totalPaid: number;
  status: string;
  payments: DeadlinePayment[];
}) {
  const balance = Math.max(params.total - params.totalPaid, 0);
  const payments = params.payments.length ? params.payments : [null];
  return payments.map((payment) => {
    const paymentDate = isoDay(payment?.date_paiement || payment?.date);
    const result = compliance(params.dueDate, paymentDate);
    return [
      params.type,
      params.thirdParty,
      params.fiscalId,
      params.number,
      params.invoiceDate,
      params.dueDate,
      params.total,
      paymentDate,
      payment ? Number(payment.montant ?? 0) : "",
      payment?.mode_paiement ?? payment?.mode ?? "",
      payment?.reference ?? "",
      result.delay,
      result.respected,
      params.totalPaid,
      balance,
      params.status,
    ];
  });
}

export function buildClientPaymentDeadlineRows(
  invoices: DeadlineClientInvoice[],
  period: { start: string; end: string },
) {
  return invoices.flatMap((invoice) => {
    const invoiceDate = isoDay(invoice.issue_date);
    if (!isInPeriod(invoiceDate, period.start, period.end)) return [];
    const allocationPayments = confirmedPayments(invoice.invoice_payments);
    const payments = allocationPayments.length ? allocationPayments : confirmedPayments(invoice.paiements);
    const total = Number(invoice.total ?? 0);
    const totalPaid = Number(invoice.montant_recu ?? payments.reduce((sum, payment) => sum + Number(payment.montant ?? 0), 0));
    return rowsForInvoice({
      type: "Client",
      thirdParty: invoice.clients?.name ?? "Client non renseigné",
      fiscalId: invoice.clients?.ice ?? "",
      number: invoice.invoice_number ?? "",
      invoiceDate,
      dueDate: isoDay(invoice.due_date),
      total,
      totalPaid,
      status: statusLabel(invoice.status),
      payments,
    });
  });
}

export function buildSupplierPaymentDeadlineRows(
  invoices: DeadlineSupplierInvoice[],
  period: { start: string; end: string },
) {
  return invoices.flatMap((invoice) => {
    const data = invoice.ocr_data ?? {};
    const invoiceDate = isoDay(data.date) || isoDay(invoice.created_at);
    if (!isInPeriod(invoiceDate, period.start, period.end)) return [];
    const payments = confirmedPayments(invoice.invoice_payments);
    const total = Math.abs(Number(data.amount ?? 0));
    const totalPaid = Number(data.montant_paye ?? payments.reduce((sum, payment) => sum + Number(payment.montant ?? 0), 0));
    const supplierStatus = data.payment_status === "paid" || invoice.status === "paid"
      ? "paid"
      : data.payment_status === "partial" ? "partial" : invoice.status;
    return rowsForInvoice({
      type: "Fournisseur",
      thirdParty: data.vendor_name ?? data.vendor ?? invoice.file_name ?? "Fournisseur non renseigné",
      fiscalId: data.supplier_ice ?? data.ice_fournisseur ?? data.supplier_if ?? data.if_fournisseur ?? "",
      number: data.receipt_number ?? invoice.file_name ?? "",
      invoiceDate,
      dueDate: isoDay(data.due_date),
      total,
      totalPaid,
      status: statusLabel(supplierStatus),
      payments,
    });
  });
}
