export interface PurchaseAmounts {
  /** Amount debited to the purchase/asset account: gross HT less on-invoice commercial reductions. */
  totalHt: number;
  /** HT printed before any commercial reduction or settlement discount. */
  grossHt: number;
  /** VAT base after commercial reductions and settlement discounts. */
  taxableBaseHt: number;
  totalTtc: number;
  tvaAmount: number;
  discountAmount: number;
  commercialDiscountAmount: number;
  settlementDiscountAmount: number;
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
  const explicitTva = finiteAbsolute(ocr.tva_amount ?? ocr.tax_amount);
  const tvaRate = finiteAbsolute(ocr.tva_rate);
  const explicitGrossHt = finiteAbsolute(ocr.amount_ht);

  if (explicitGrossHt > 0) {
    const appliedCommercialDiscount = money(Math.min(commercialDiscountAmount, explicitGrossHt));
    const netCommercialHt = money(explicitGrossHt - appliedCommercialDiscount);
    const appliedSettlementDiscount = money(Math.min(settlementDiscountAmount, netCommercialHt));
    const taxableBaseHt = money(netCommercialHt - appliedSettlementDiscount);
    let tvaAmount = explicitTva;
    if (!tvaAmount && totalTtc >= taxableBaseHt) tvaAmount = totalTtc - taxableBaseHt;
    if (!tvaAmount && totalTtc > 0 && tvaRate > 0) tvaAmount = totalTtc - totalTtc / (1 + tvaRate / 100);
    tvaAmount = money(Math.min(tvaAmount, totalTtc));
    return {
      totalHt: netCommercialHt,
      grossHt: money(explicitGrossHt),
      taxableBaseHt,
      totalTtc,
      tvaAmount,
      discountAmount: money(appliedCommercialDiscount + appliedSettlementDiscount),
      commercialDiscountAmount: appliedCommercialDiscount,
      settlementDiscountAmount: appliedSettlementDiscount,
    };
  }

  let tvaAmount = explicitTva;
  if (!tvaAmount && totalTtc > 0 && tvaRate > 0) {
    tvaAmount = totalTtc - totalTtc / (1 + tvaRate / 100);
  }

  tvaAmount = money(Math.min(tvaAmount, totalTtc));
  const taxableBaseHt = money(Math.max(0, totalTtc - tvaAmount));
  const netCommercialHt = money(taxableBaseHt + settlementDiscountAmount);
  const grossHt = money(netCommercialHt + commercialDiscountAmount);
  return {
    totalHt: netCommercialHt,
    grossHt,
    taxableBaseHt,
    totalTtc,
    tvaAmount,
    discountAmount: money(commercialDiscountAmount + settlementDiscountAmount),
    commercialDiscountAmount,
    settlementDiscountAmount,
  };
}

export function computePurchaseAmountsFromHt(input: {
  amountHt: number;
  tvaRate: number;
  commercialDiscountAmount: number;
  settlementDiscountAmount: number;
}): PurchaseAmounts {
  const grossHt = money(finiteAbsolute(input.amountHt));
  const commercialDiscount = money(Math.min(finiteAbsolute(input.commercialDiscountAmount), grossHt));
  const netCommercialHt = money(grossHt - commercialDiscount);
  const settlementDiscount = money(Math.min(finiteAbsolute(input.settlementDiscountAmount), netCommercialHt));
  const taxableBaseHt = money(netCommercialHt - settlementDiscount);
  const tva = money(taxableBaseHt * finiteAbsolute(input.tvaRate) / 100);
  const ttc = money(taxableBaseHt + tva);
  return computePurchaseAmounts({
    amount: ttc,
    amount_ht: grossHt,
    tva_amount: tva,
    commercial_discount_amount: commercialDiscount,
    settlement_discount_amount: settlementDiscount,
    tva_rate: input.tvaRate,
  });
}
