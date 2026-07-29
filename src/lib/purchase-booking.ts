export interface PurchaseAmounts {
  totalHt: number;
  totalTtc: number;
  tvaAmount: number;
}

function money(value: number) {
  return Math.round(value * 100) / 100;
}

function finiteAbsolute(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? Math.abs(numeric) : 0;
}

export function computePurchaseAmounts(ocr: Record<string, unknown>): PurchaseAmounts {
  const totalTtc = money(finiteAbsolute(ocr.amount));
  const explicitTva = finiteAbsolute(ocr.tva_amount ?? ocr.tax_amount);
  const tvaRate = finiteAbsolute(ocr.tva_rate);

  let tvaAmount = explicitTva;
  if (!tvaAmount && totalTtc > 0 && tvaRate > 0) {
    tvaAmount = totalTtc - totalTtc / (1 + tvaRate / 100);
  }

  tvaAmount = money(Math.min(tvaAmount, totalTtc));
  return {
    totalHt: money(totalTtc - tvaAmount),
    totalTtc,
    tvaAmount,
  };
}
