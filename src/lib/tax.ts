export interface TaxableAmount {
  amount?: number | string | null;
  tax_amount?: number | string | null;
  tax_rate?: number | string | null;
}

export function taxIncludedInAmount(value: TaxableAmount, defaultRate = 20) {
  const ttc = Number(value.amount ?? 0);
  const explicitTax = value.tax_amount == null ? NaN : Number(value.tax_amount);
  if (Number.isFinite(explicitTax) && explicitTax >= 0) return explicitTax;

  const rate = Number(value.tax_rate ?? defaultRate);
  return rate > 0 ? ttc * rate / (100 + rate) : 0;
}
