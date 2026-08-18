export type TreasuryTransaction = {
  id?: string;
  date: string;
  type: "income" | "expense" | string;
  amount: number | string;
  description?: string | null;
  category?: string | null;
};

export type TreasuryInvoice = {
  id: string;
  client_id?: string | null;
  invoice_number: string;
  due_date: string | null;
  issue_date: string;
  total: number | string;
  montant_recu?: number | string | null;
  status: string;
  updated_at?: string | null;
  paiements?: Array<{ date?: string; date_paiement?: string; montant?: number }> | null;
  clients?: { name?: string | null } | { name?: string | null }[] | null;
};

export type TreasurySupplierItem = {
  id: string;
  ocr_data?: {
    due_date?: string | null;
    date?: string | null;
    amount?: number | string | null;
    amount_ttc?: number | string | null;
    montant_paye?: number | string | null;
    payment_status?: string | null;
    vendor?: string | null;
    vendor_name?: string | null;
    invoice_number?: string | null;
  } | null;
};

export type TreasuryPayrollItem = {
  id: string;
  mois: number;
  annee: number;
  salaire_net_payer: number | string;
  statut: string | null;
};

export type TreasuryFlow = {
  id: string;
  date: string;
  direction: "in" | "out";
  source: "client" | "supplier" | "payroll" | "recurring";
  label: string;
  counterparty: string;
  amount: number;
  baseAmount: number;
  overdue: boolean;
  confidence: "high" | "medium" | "low";
  assumption?: string;
};

export type TreasuryChartPoint = {
  date: string;
  label: string;
  balance: number;
  inflows: number;
  outflows: number;
};

export type TreasurySnapshot = ReturnType<typeof buildTreasurySnapshot>;
export type CustomerPaymentBehavior = {
  clientId: string;
  name: string;
  paidInvoices: number;
  averageDelayDays: number;
  onTimeRate: number;
  risk: "low" | "medium" | "high";
};

export type RecurringExpense = {
  key: string;
  label: string;
  category: string;
  averageAmount: number;
  intervalDays: number;
  nextDate: string;
  occurrences: number;
  confidence: "high" | "medium";
};

export type ReceivableRecommendation = {
  invoiceId: string;
  invoiceNumber: string;
  client: string;
  amount: number;
  score: number;
  priority: "critical" | "high" | "normal";
  reason: string;
};

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return isoDate(date);
}

function differenceInDays(later: string, earlier: string) {
  return Math.round((new Date(`${later}T12:00:00`).getTime() - new Date(`${earlier}T12:00:00`).getTime()) / 86400000);
}

function endOfMonth(year: number, month: number) {
  return isoDate(new Date(year, month, 0, 12));
}

function clientName(value: TreasuryInvoice["clients"]) {
  if (Array.isArray(value)) return value[0]?.name?.trim() || "Client";
  return value?.name?.trim() || "Client";
}

function paymentDate(invoice: TreasuryInvoice) {
  const payments = invoice.paiements ?? [];
  const dates = payments.map((payment) => payment.date_paiement || payment.date).filter((value): value is string => Boolean(value)).sort();
  return dates.at(-1) || invoice.updated_at?.slice(0, 10) || null;
}

export function analyzeCustomerPaymentBehavior(invoices: TreasuryInvoice[]): CustomerPaymentBehavior[] {
  const groups = new Map<string, { name: string; delays: number[] }>();
  for (const invoice of invoices) {
    if (invoice.status !== "paid" || !invoice.client_id) continue;
    const paidAt = paymentDate(invoice);
    const dueDate = invoice.due_date || addDays(invoice.issue_date, 30);
    if (!paidAt) continue;
    const group = groups.get(invoice.client_id) ?? { name: clientName(invoice.clients), delays: [] };
    group.delays.push(differenceInDays(paidAt, dueDate));
    groups.set(invoice.client_id, group);
  }
  return Array.from(groups.entries()).map(([clientId, group]) => {
    const averageDelayDays = Math.round(group.delays.reduce((sum, delay) => sum + delay, 0) / group.delays.length);
    const onTimeRate = Math.round((group.delays.filter((delay) => delay <= 0).length / group.delays.length) * 100);
    const risk: CustomerPaymentBehavior["risk"] = averageDelayDays > 20 || onTimeRate < 35 ? "high" : averageDelayDays > 7 || onTimeRate < 70 ? "medium" : "low";
    return { clientId, name: group.name, paidInvoices: group.delays.length, averageDelayDays, onTimeRate, risk };
  }).sort((a, b) => b.averageDelayDays - a.averageDelayDays);
}

function normalizedRecurringKey(transaction: TreasuryTransaction) {
  const label = (transaction.description || transaction.category || "Dépense").toLocaleLowerCase("fr")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\d+/g, "").replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
  return `${transaction.category || "autre"}:${label.slice(0, 48)}`;
}

export function detectRecurringExpenses(transactions: TreasuryTransaction[], today = isoDate(new Date())): RecurringExpense[] {
  const groups = new Map<string, TreasuryTransaction[]>();
  for (const transaction of transactions.filter((item) => item.type === "expense" && item.date <= today)) {
    const key = normalizedRecurringKey(transaction);
    if (key.endsWith(":")) continue;
    groups.set(key, [...(groups.get(key) ?? []), transaction]);
  }
  const results: RecurringExpense[] = [];
  for (const [key, items] of groups) {
    if (items.length < 2) continue;
    items.sort((a, b) => a.date.localeCompare(b.date));
    const intervals = items.slice(1).map((item, index) => differenceInDays(item.date, items[index].date)).filter((days) => days >= 5 && days <= 120);
    if (!intervals.length) continue;
    const intervalDays = Math.round(intervals.reduce((sum, value) => sum + value, 0) / intervals.length);
    const deviation = intervals.reduce((sum, value) => sum + Math.abs(value - intervalDays), 0) / intervals.length;
    if (deviation > Math.max(12, intervalDays * 0.45)) continue;
    const latest = items.at(-1)!;
    let nextDate = addDays(latest.date, intervalDays);
    while (nextDate < today) nextDate = addDays(nextDate, intervalDays);
    results.push({
      key,
      label: latest.description || latest.category || "Dépense récurrente",
      category: latest.category || "Autre",
      averageAmount: items.reduce((sum, item) => sum + Math.abs(Number(item.amount) || 0), 0) / items.length,
      intervalDays,
      nextDate,
      occurrences: items.length,
      confidence: items.length >= 4 && deviation <= 7 ? "high" : "medium",
    });
  }
  return results.sort((a, b) => a.nextDate.localeCompare(b.nextDate)).slice(0, 12);
}

export function prioritizeReceivables(invoices: TreasuryInvoice[], behaviors: CustomerPaymentBehavior[], today = isoDate(new Date())): ReceivableRecommendation[] {
  const behaviorMap = new Map(behaviors.map((item) => [item.clientId, item]));
  return invoices.filter((invoice) => !["paid", "cancelled", "draft"].includes(invoice.status)).map((invoice) => {
    const amount = Math.max(Number(invoice.total) - Number(invoice.montant_recu ?? 0), 0);
    const dueDate = invoice.due_date || addDays(invoice.issue_date, 30);
    const overdueDays = Math.max(differenceInDays(today, dueDate), 0);
    const behavior = invoice.client_id ? behaviorMap.get(invoice.client_id) : undefined;
    const riskPoints = behavior?.risk === "high" ? 35 : behavior?.risk === "medium" ? 18 : 5;
    const amountPoints = Math.min(35, Math.round(amount / 3000));
    const score = Math.min(100, 15 + Math.min(35, overdueDays) + riskPoints + amountPoints);
    const priority: ReceivableRecommendation["priority"] = score >= 75 ? "critical" : score >= 50 ? "high" : "normal";
    const reason = overdueDays > 0
      ? `${overdueDays} j de retard${behavior ? ` · retard client moyen ${Math.max(behavior.averageDelayDays, 0)} j` : ""}`
      : behavior?.risk === "high" ? "Historique de paiement à risque" : "Montant et échéance à surveiller";
    return { invoiceId: invoice.id, invoiceNumber: invoice.invoice_number, client: clientName(invoice.clients), amount, score, priority, reason };
  }).filter((item) => item.amount > 0).sort((a, b) => b.score - a.score || b.amount - a.amount).slice(0, 8);
}

export function buildTreasurySnapshot({
  transactions,
  invoices,
  suppliers,
  payroll = [],
  recurringExpenses = [],
  paymentBehaviors = [],
  accountPosition,
  today = isoDate(new Date()),
  horizonDays = 90,
}: {
  transactions: TreasuryTransaction[];
  invoices: TreasuryInvoice[];
  suppliers: TreasurySupplierItem[];
  payroll?: TreasuryPayrollItem[];
  recurringExpenses?: RecurringExpense[];
  paymentBehaviors?: CustomerPaymentBehavior[];
  accountPosition?: number;
  today?: string;
  horizonDays?: number;
}) {
  const recordedPosition = transactions.reduce((sum, transaction) => {
    if (transaction.date.slice(0, 10) > today) return sum;
    const amount = Math.abs(Number(transaction.amount) || 0);
    return sum + (transaction.type === "income" ? amount : -amount);
  }, 0);
  const position = accountPosition ?? recordedPosition;
  const behaviorMap = new Map(paymentBehaviors.map((behavior) => [behavior.clientId, behavior]));

  const flows: TreasuryFlow[] = [];

  for (const invoice of invoices) {
    if (["paid", "cancelled", "draft"].includes(invoice.status)) continue;
    const outstanding = Math.max(Number(invoice.total) - Number(invoice.montant_recu ?? 0), 0);
    if (!outstanding) continue;
    const contractualDate = invoice.due_date || addDays(invoice.issue_date, 30);
    const behavior = invoice.client_id ? behaviorMap.get(invoice.client_id) : undefined;
    const delay = Math.max(behavior?.averageDelayDays ?? 0, 0);
    const collectionRate = !behavior ? 1 : behavior.risk === "high" ? 0.82 : behavior.risk === "medium" ? 0.92 : 0.98;
    const expectedDate = addDays(contractualDate < today ? today : contractualDate, delay);
    flows.push({
      id: `client-${invoice.id}`,
      date: expectedDate,
      direction: "in",
      source: "client",
      label: invoice.invoice_number,
      counterparty: clientName(invoice.clients),
      amount: outstanding * collectionRate,
      baseAmount: outstanding,
      overdue: contractualDate < today,
      confidence: behavior?.paidInvoices && behavior.paidInvoices >= 3 ? (behavior.risk === "high" ? "low" : "high") : "medium",
      assumption: delay ? `Encaissement décalé de ${delay} j selon l’historique` : "Encaissement à l’échéance",
    });
  }

  for (const item of suppliers) {
    const data = item.ocr_data ?? {};
    if (data.payment_status === "paid") continue;
    const total = Math.abs(Number(data.amount_ttc ?? data.amount ?? 0));
    const outstanding = Math.max(total - Number(data.montant_paye ?? 0), 0);
    if (!outstanding) continue;
    const sourceDate = data.due_date || data.date || today;
    flows.push({
      id: `supplier-${item.id}`,
      date: sourceDate < today ? today : sourceDate,
      direction: "out",
      source: "supplier",
      label: data.invoice_number || "Facture fournisseur",
      counterparty: data.vendor_name || data.vendor || "Fournisseur",
      amount: outstanding,
      baseAmount: outstanding,
      overdue: sourceDate < today,
      confidence: data.due_date ? "high" : "medium",
      assumption: data.due_date ? "Date fournisseur" : "Date estimée depuis le document",
    });
  }

  for (const item of payroll) {
    if (item.statut === "payé") continue;
    const amount = Math.max(Number(item.salaire_net_payer) || 0, 0);
    if (!amount) continue;
    const contractualDate = endOfMonth(item.annee, item.mois);
    flows.push({
      id: `payroll-${item.id}`,
      date: contractualDate < today ? today : contractualDate,
      direction: "out",
      source: "payroll",
      label: `Paie ${String(item.mois).padStart(2, "0")}/${item.annee}`,
      counterparty: "Salaires",
      amount,
      baseAmount: amount,
      overdue: contractualDate < today,
      confidence: "high",
      assumption: "Bulletin de paie non soldé",
    });
  }

  const recurrenceEnd = addDays(today, horizonDays);
  for (const expense of recurringExpenses) {
    const baseAmount = expense.averageAmount;
    let occurrenceDate = expense.nextDate;
    let occurrence = 1;
    while (occurrenceDate <= recurrenceEnd) {
      flows.push({
        id: `recurring-${expense.key}-${occurrence}`,
        date: occurrenceDate,
        direction: "out",
        source: "recurring",
        label: expense.category,
        counterparty: expense.label,
        amount: baseAmount,
        baseAmount,
        overdue: false,
        confidence: expense.confidence,
        assumption: `${expense.occurrences} occurrences · tous les ${expense.intervalDays} j environ`,
      });
      occurrenceDate = addDays(occurrenceDate, expense.intervalDays);
      occurrence += 1;
    }
  }

  flows.sort((a, b) => a.date.localeCompare(b.date) || Number(b.overdue) - Number(a.overdue));
  const horizonEnd = addDays(today, horizonDays);
  const horizonFlows = flows.filter((flow) => flow.date <= horizonEnd);
  const expectedInflows = horizonFlows.filter((flow) => flow.direction === "in").reduce((sum, flow) => sum + flow.amount, 0);
  const expectedOutflows = horizonFlows.filter((flow) => flow.direction === "out").reduce((sum, flow) => sum + flow.amount, 0);

  const chart: TreasuryChartPoint[] = [];
  let balance = position;
  for (let offset = 0; offset <= horizonDays; offset += 7) {
    const bucketStart = addDays(today, offset);
    const bucketEnd = addDays(today, Math.min(offset + 6, horizonDays));
    const bucketFlows = horizonFlows.filter((flow) => flow.date >= bucketStart && flow.date <= bucketEnd);
    const inflows = bucketFlows.filter((flow) => flow.direction === "in").reduce((sum, flow) => sum + flow.amount, 0);
    const outflows = bucketFlows.filter((flow) => flow.direction === "out").reduce((sum, flow) => sum + flow.amount, 0);
    balance += inflows - outflows;
    chart.push({
      date: bucketEnd,
      label: new Date(`${bucketEnd}T12:00:00`).toLocaleDateString("fr-MA", { day: "2-digit", month: "short" }).replace(".", ""),
      balance,
      inflows,
      outflows,
    });
  }

  const lowPoint = chart.reduce((lowest, point) => point.balance < lowest.balance ? point : lowest, chart[0] ?? { date: today, label: "", balance: position, inflows: 0, outflows: 0 });

  return {
    position,
    recordedPosition,
    projectedPosition: position + expectedInflows - expectedOutflows,
    expectedInflows,
    expectedOutflows,
    lowPoint,
    flows,
    chart,
    overdueCount: flows.filter((flow) => flow.overdue).length,
  };
}
