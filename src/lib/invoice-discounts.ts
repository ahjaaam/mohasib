export const DISCOUNT_TYPES = [
  "none",
  "remise_commerciale",
  "rabais",
  "reduction",
  "ristourne",
  "escompte",
] as const;

export type DiscountType = typeof DISCOUNT_TYPES[number];
export type DiscountMode = "percent" | "amount";

export const DISCOUNT_LABELS: Record<DiscountType, string> = {
  none: "Aucune réduction",
  remise_commerciale: "Remise commerciale",
  rabais: "Rabais",
  reduction: "Réduction",
  ristourne: "Ristourne",
  escompte: "Escompte",
};

export function isCommercialDiscount(type: DiscountType | null | undefined) {
  return Boolean(type && type !== "none" && type !== "escompte");
}

function money(value: number) {
  return Math.round(value * 100) / 100;
}

export function computeInvoiceDiscount(input: {
  grossSubtotal: number;
  grossTax: number;
  type: DiscountType;
  mode: DiscountMode;
  value: number;
}) {
  const grossSubtotal = Math.max(0, Number(input.grossSubtotal) || 0);
  const grossTax = Math.max(0, Number(input.grossTax) || 0);
  const rawValue = Math.max(0, Number(input.value) || 0);
  const discountAmount = input.type === "none"
    ? 0
    : Math.min(grossSubtotal, input.mode === "percent" ? grossSubtotal * Math.min(rawValue, 100) / 100 : rawValue);
  const ratio = grossSubtotal > 0 ? (grossSubtotal - discountAmount) / grossSubtotal : 0;
  const taxAmount = money(grossTax * ratio);
  const netSubtotal = money(grossSubtotal - discountAmount);

  return {
    grossSubtotal: money(grossSubtotal),
    discountAmount: money(discountAmount),
    netSubtotal,
    taxAmount,
    total: money(netSubtotal + taxAmount),
  };
}

export function salesCommercialDiscountAccount(salesAccount: string) {
  return salesAccount.startsWith("711") ? "7119" : "7129";
}

export function purchaseCommercialDiscountAccount(
  expenseAccount: string,
  merchandiseAccount = "6119",
  consumedPurchaseAccount = "6129",
  externalExpenseAccount = "6149",
) {
  if (expenseAccount.startsWith("611")) return merchandiseAccount;
  if (expenseAccount.startsWith("612")) return consumedPurchaseAccount;
  return externalExpenseAccount;
}
