export type AgentClient = {
  id: string;
  name: string;
  email?: string | null;
};

export type ClientMatch =
  | { status: "matched"; client: AgentClient }
  | { status: "ambiguous"; clients: AgentClient[] }
  | { status: "not_found"; clients: AgentClient[] };

export function normalizeClientName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function matchAgentClient(requestedName: string, clients: AgentClient[]): ClientMatch {
  const requested = normalizeClientName(requestedName);
  if (!requested) return { status: "not_found", clients: [] };

  const exact = clients.filter((client) => normalizeClientName(client.name) === requested);
  if (exact.length === 1) return { status: "matched", client: exact[0] };
  if (exact.length > 1) return { status: "ambiguous", clients: exact.slice(0, 5) };

  const partial = clients.filter((client) => {
    const candidate = normalizeClientName(client.name);
    return candidate.includes(requested) || requested.includes(candidate);
  });
  if (partial.length === 1) return { status: "matched", client: partial[0] };
  if (partial.length > 1) return { status: "ambiguous", clients: partial.slice(0, 5) };

  return { status: "not_found", clients: clients.slice(0, 10) };
}

export function calculateAgentInvoiceAmounts(
  amount: number,
  taxRate: number,
  amountBasis: "HT" | "TTC",
) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Le montant doit être supérieur à 0.");
  }
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
    throw new Error("Le taux de TVA est invalide.");
  }

  const subtotal = amountBasis === "TTC" ? amount / (1 + taxRate / 100) : amount;
  const taxAmount = subtotal * taxRate / 100;
  const total = subtotal + taxAmount;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}

const PAYMENT_DELAY_DAYS: Record<string, number> = {
  "immédiat": 0,
  "immediat": 0,
  "15 jours": 15,
  "30 jours": 30,
  "45 jours": 45,
  "60 jours": 60,
};

export function calculateAgentDueDate(issueDate: string, paymentDelay?: string | null) {
  const days = PAYMENT_DELAY_DAYS[String(paymentDelay ?? "").toLocaleLowerCase("fr")] ?? 30;
  const date = new Date(`${issueDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
