// ── Mohasib — Bank Reconciliation Engine ─────────────────────────────────────

import stringSimilarity from "string-similarity";

export interface BankLine {
  id: string;
  date: string;           // ISO date
  description: string;
  reference?: string;
  amount: number;         // positive = credit, negative = debit
  balance_after?: number;
}

export interface TxCandidate {
  id: string;
  date: string;
  description: string;
  amount: number;
  category?: string;
  client_name?: string;
}

export interface MatchResult {
  transaction_id: string;
  confidence: number;       // 0.0–1.0
  reason: string;
  rule: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysDiff(a: string, b: string): number {
  const msPerDay = 86_400_000;
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / msPerDay;
}

function amtClose(a: number, b: number, pct = 0.01): boolean {
  if (a === 0 && b === 0) return true;
  return Math.abs(a - b) / (Math.abs(a) || 1) <= pct;
}

function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

// ── Matching Rules ────────────────────────────────────────────────────────────

function scoreMatch(line: BankLine, tx: TxCandidate, clients: string[]): MatchResult | null {
  const days = daysDiff(line.date, tx.date);
  const amtExact = line.amount === tx.amount;
  const amtFuzzy = amtClose(line.amount, tx.amount);
  const lineDesc = normalise(line.description ?? "");
  const txDesc   = normalise(tx.description ?? "");

  // RULE 1 — Exact match: exact amount + ≤3 days
  if (amtExact && days <= 3) {
    const nameBump = clients.some(c => lineDesc.includes(normalise(c))) ? 0.05 : 0;
    return {
      transaction_id: tx.id,
      confidence: Math.min(0.95 + nameBump, 1.0),
      reason: `Montant exact (${line.amount} MAD) + date proche (${Math.round(days)}j)`,
      rule: "exact",
    };
  }

  // RULE 2 — Amount match: exact amount + ≤7 days
  if (amtExact && days <= 7) {
    const weekBump = days <= 7 ? 0.10 : 0;
    return {
      transaction_id: tx.id,
      confidence: 0.80 + weekBump,
      reason: `Montant exact + même semaine (${Math.round(days)}j d'écart)`,
      rule: "amount_week",
    };
  }

  // RULE 4 — Description similarity (checked before rule 3 for better UX)
  if (lineDesc && txDesc) {
    const sim = stringSimilarity.compareTwoStrings(lineDesc, txDesc);
    if (sim >= 0.6 && days <= 14) {
      return {
        transaction_id: tx.id,
        confidence: Math.min(0.70 + sim * 0.15, 0.85),
        reason: `Description similaire (${Math.round(sim * 100)}%) + ${Math.round(days)}j d'écart`,
        rule: "description",
      };
    }
  }

  // RULE 3 — Fuzzy amount: ≤1% diff + ≤5 days
  if (amtFuzzy && days <= 5) {
    return {
      transaction_id: tx.id,
      confidence: 0.60,
      reason: `Montant approché (±1%) + date proche (${Math.round(days)}j)`,
      rule: "fuzzy_amount",
    };
  }

  // RULE 5 — Client name in bank description
  const matchedClient = clients.find(c => c.length > 2 && lineDesc.includes(normalise(c)));
  if (matchedClient && days <= 14) {
    const amtBonus = amtFuzzy ? 0.15 : 0;
    return {
      transaction_id: tx.id,
      confidence: 0.65 + amtBonus,
      reason: `Nom client "${matchedClient}" trouvé dans la description bancaire`,
      rule: "client_name",
    };
  }

  return null;
}

// ── Main matching function ────────────────────────────────────────────────────

export function findMatches(
  line: BankLine,
  candidates: TxCandidate[],
  clients: string[] = []
): MatchResult[] {
  const results: MatchResult[] = [];

  for (const tx of candidates) {
    // Skip opposite-sign transactions
    if (Math.sign(line.amount) !== Math.sign(tx.amount)) continue;

    const match = scoreMatch(line, tx, clients);
    if (match) results.push(match);
  }

  return results.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
}

// ── Confidence label ──────────────────────────────────────────────────────────

export function confidenceLabel(c: number): { label: string; color: string } {
  if (c >= 0.90) return { label: "FORT",     color: "#059669" };
  if (c >= 0.70) return { label: "PROBABLE", color: "#D97706" };
  if (c >= 0.50) return { label: "POSSIBLE", color: "#EA580C" };
  return              { label: "FAIBLE",    color: "#DC2626" };
}
