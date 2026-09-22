export interface PurchaseAmounts {
  totalHt: number;
  totalTtc: number;
  tvaAmount: number;
  discountAmount: number;
  commercialDiscountAmount: number;
  settlementDiscountAmount: number;
  grossTtc: number;
}

export function shouldBookConfirmedPurchase(ocr: Record<string, unknown>) {
  return ocr.document_type === "receipt" || ocr.is_supplier_invoice !== false;
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
  const hasTypedDiscount = ocr.commercial_discount_amount != null || ocr.settlement_discount_amount != null;
  const legacyDiscount = money(finiteAbsolute(ocr.discount_amount));
  const commercialDiscountAmount = money(hasTypedDiscount
    ? finiteAbsolute(ocr.commercial_discount_amount)
    : String(ocr.discount_type ?? "") === "escompte" ? 0 : legacyDiscount);
  const settlementDiscountAmount = money(hasTypedDiscount
    ? finiteAbsolute(ocr.settlement_discount_amount)
    : String(ocr.discount_type ?? "") === "escompte" ? legacyDiscount : 0);
  const discountAmount = money(commercialDiscountAmount + settlementDiscountAmount);
  const explicitTva = finiteAbsolute(ocr.tva_amount ?? ocr.tax_amount);
  const tvaRate = finiteAbsolute(ocr.tva_rate);

  if (hasTypedDiscount) {
    let tvaAmount = explicitTva;
    const explicitGrossHt = finiteAbsolute(ocr.amount_ht);
    const explicitNetHt = Math.max(0, explicitGrossHt - discountAmount);
    if (!tvaAmount && explicitGrossHt > 0 && totalTtc >= explicitNetHt) tvaAmount = totalTtc - explicitNetHt;
    if (!tvaAmount && totalTtc > 0 && tvaRate > 0) tvaAmount = totalTtc - totalTtc / (1 + tvaRate / 100);
    tvaAmount = money(Math.min(tvaAmount, totalTtc));
    const netHt = explicitGrossHt > 0 ? money(explicitNetHt) : money(Math.max(0, totalTtc - tvaAmount));
    const totalHt = explicitGrossHt > 0 ? money(explicitGrossHt) : money(netHt + discountAmount);
    return {
      totalHt,
      totalTtc,
      tvaAmount,
      discountAmount,
      commercialDiscountAmount,
      settlementDiscountAmount,
      grossTtc: money(totalHt + tvaAmount),
    };
  }

  const grossTtc = money(totalTtc + discountAmount);

  let tvaAmount = explicitTva;
  if (!tvaAmount && grossTtc > 0 && tvaRate > 0) {
    tvaAmount = grossTtc - grossTtc / (1 + tvaRate / 100);
  }

  tvaAmount = money(Math.min(tvaAmount, grossTtc));
  return {
    totalHt: money(grossTtc - tvaAmount),
    totalTtc,
    tvaAmount,
    discountAmount,
    commercialDiscountAmount,
    settlementDiscountAmount,
    grossTtc,
  };
}

export function computePurchaseAmountsFromHt(input: {
  amountHt: number;
  tvaRate: number;
  commercialDiscountAmount: number;
  settlementDiscountAmount: number;
}): PurchaseAmounts {
  const ht = money(finiteAbsolute(input.amountHt));
  const tva = money(ht * finiteAbsolute(input.tvaRate) / 100);
  const discount = money(finiteAbsolute(input.commercialDiscountAmount) + finiteAbsolute(input.settlementDiscountAmount));
  const ttc = money(ht + tva - discount);
  return computePurchaseAmounts({
    amount: ttc,
    amount_ht: ht,
    tva_amount: tva,
    commercial_discount_amount: input.commercialDiscountAmount,
    settlement_discount_amount: input.settlementDiscountAmount,
    tva_rate: input.tvaRate,
  });
}
