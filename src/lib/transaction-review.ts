export type TransactionWorkflowStatus = "imported" | "matched" | "reviewed" | "posted";
export type TransactionVatStatus = "not_applicable" | "pending_evidence" | "eligible" | "rejected";

export interface ExplicitVatEvidence {
  totalTtc: number;
  totalHt: number;
  taxAmount: number;
  taxRate: number;
}

function finitePositive(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function money(value: number) {
  return Math.round(value * 100) / 100;
}

export function readExplicitVatEvidence(ocr: Record<string, unknown>): ExplicitVatEvidence | null {
  const totalTtc = finitePositive(ocr.amount);
  const totalHt = finitePositive(ocr.amount_ht);
  const taxAmount = finitePositive(ocr.tva_amount ?? ocr.tax_amount);
  const taxRate = finitePositive(ocr.tva_rate ?? ocr.tax_rate);
  if (totalTtc == null || totalHt == null || taxAmount == null || taxRate == null) return null;
  if (taxAmount > totalTtc || Math.abs(totalHt + taxAmount - totalTtc) > 0.05) return null;
  return { totalTtc, totalHt, taxAmount, taxRate };
}

export function prorateVatEvidence(evidence: ExplicitVatEvidence, allocatedAmount: number) {
  if (!Number.isFinite(allocatedAmount) || allocatedAmount <= 0 || allocatedAmount > evidence.totalTtc + 0.01) {
    return null;
  }
  const ratio = Math.min(allocatedAmount / evidence.totalTtc, 1);
  return {
    amountHt: money(evidence.totalHt * ratio),
    taxAmount: money(evidence.taxAmount * ratio),
    taxRate: evidence.taxRate,
  };
}

export function validateReviewChoice(input: {
  transactionType: "income" | "expense";
  vatStatus: TransactionVatStatus;
  reason?: string | null;
}) {
  if (input.vatStatus === "pending_evidence") return "La TVA doit être décidée avant la comptabilisation.";
  if (input.transactionType === "income" && input.vatStatus !== "not_applicable") {
    return "La TVA déductible ne s’applique pas à un encaissement.";
  }
  if (input.transactionType === "expense" && input.vatStatus !== "eligible" && !input.reason?.trim()) {
    return "Un motif est requis lorsqu’aucune TVA n’est déduite.";
  }
  return null;
}
