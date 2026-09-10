import { DEFAULT_EXPENSE_CATEGORY_ACCOUNTS, DEFAULT_REVENUE_CATEGORY_ACCOUNTS } from "./cgnc-mapping";

export type AccountingSettings = {
  clientAccount: string;
  salesAccount: string;
  collectedTvaAccount: string;
  supplierAccount: string;
  recoverableTvaAccount: string;
  purchaseDiscountAccount: string;
  purchaseConsumedDiscountAccount: string;
  purchaseExternalDiscountAccount: string;
  salesCommercialDiscountAccount: string;
  salesSettlementDiscountAccount: string;
  purchaseSettlementDiscountAccount: string;
  bankAccount: string;
  revenueCategoryAccounts: Record<string, string>;
  expenseCategoryAccounts: Record<string, string>;
};

export type BaseAccountingSettingKey = Exclude<keyof AccountingSettings, "revenueCategoryAccounts" | "expenseCategoryAccounts">;

export const DEFAULT_ACCOUNTING_SETTINGS: AccountingSettings = {
  clientAccount: "3421",
  salesAccount: "7131",
  collectedTvaAccount: "4455",
  supplierAccount: "4411",
  recoverableTvaAccount: "3455",
  purchaseDiscountAccount: "6119",
  purchaseConsumedDiscountAccount: "6129",
  purchaseExternalDiscountAccount: "6149",
  salesCommercialDiscountAccount: "7129",
  salesSettlementDiscountAccount: "6386",
  purchaseSettlementDiscountAccount: "7386",
  bankAccount: "5141",
  revenueCategoryAccounts: DEFAULT_REVENUE_CATEGORY_ACCOUNTS,
  expenseCategoryAccounts: DEFAULT_EXPENSE_CATEGORY_ACCOUNTS,
};

export const ACCOUNTING_SETTING_CLASSES: Record<BaseAccountingSettingKey, number[]> = {
  clientAccount: [3],
  salesAccount: [7],
  collectedTvaAccount: [4],
  supplierAccount: [4],
  recoverableTvaAccount: [3, 4],
  purchaseDiscountAccount: [6],
  purchaseConsumedDiscountAccount: [6],
  purchaseExternalDiscountAccount: [6],
  salesCommercialDiscountAccount: [7],
  salesSettlementDiscountAccount: [6],
  purchaseSettlementDiscountAccount: [7],
  bankAccount: [5],
};

export function isValidAccountingAccountCode(value: unknown, allowedClasses: number[]): value is string {
  return typeof value === "string"
    && /^[1-7][0-9]{3,11}$/.test(value)
    && allowedClasses.includes(Number(value[0]));
}

function cloneDefaults(): AccountingSettings {
  return {
    ...DEFAULT_ACCOUNTING_SETTINGS,
    revenueCategoryAccounts: { ...DEFAULT_REVENUE_CATEGORY_ACCOUNTS },
    expenseCategoryAccounts: { ...DEFAULT_EXPENSE_CATEGORY_ACCOUNTS },
  };
}

function normalizeCategoryAccounts(value: unknown, defaults: Record<string, string>, allowedClasses: number[]) {
  const input = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const normalized = Object.fromEntries(Object.entries(defaults).map(([category, fallback]) => {
    const candidate = input[category];
    const valid = isValidAccountingAccountCode(candidate, allowedClasses);
    return [category, valid ? candidate : fallback];
  }));

  for (const [rawCategory, candidate] of Object.entries(input)) {
    const category = rawCategory.trim();
    if (!category || category in normalized || ["__proto__", "prototype", "constructor"].includes(category)) continue;
    if (isValidAccountingAccountCode(candidate, allowedClasses)) normalized[category] = candidate as string;
  }
  return normalized;
}

export function normalizeAccountingSettings(value: unknown): AccountingSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return cloneDefaults();
  }

  const input = value as Record<string, unknown>;
  const baseSettings = Object.fromEntries(
    (Object.keys(ACCOUNTING_SETTING_CLASSES) as BaseAccountingSettingKey[]).map(key => {
      const fallback = DEFAULT_ACCOUNTING_SETTINGS[key];
      const candidate = input[key];
      return [key, isValidAccountingAccountCode(candidate, ACCOUNTING_SETTING_CLASSES[key]) ? candidate : fallback];
    }),
  ) as Pick<AccountingSettings, BaseAccountingSettingKey>;

  return {
    ...baseSettings,
    revenueCategoryAccounts: normalizeCategoryAccounts(input.revenueCategoryAccounts, DEFAULT_REVENUE_CATEGORY_ACCOUNTS, [7]),
    expenseCategoryAccounts: normalizeCategoryAccounts(input.expenseCategoryAccounts, DEFAULT_EXPENSE_CATEGORY_ACCOUNTS, [2, 6]),
  };
}
