export type PricingAudience = "entreprise" | "cabinet";

export type PricingConfiguration = {
  audience: PricingAudience;
  workspaces: number;
  managedDossiers: number;
  accountingUsers: number;
  connectedClientUsers: number;
  ocrDocuments: number;
  payrollEmployees: number;
  aiSpaces: number;
};

export type PricingResult = {
  base: number;
  additionalDossiers: number;
  users: number;
  ocr: number;
  payroll: number;
  monthlyTotal: number;
  annualTotal: number;
  annualSavings: number;
  includedOcr: number;
  includedAccountingUsers: number;
  includedConnectedClientUsers: number;
  additionalOcrBlocks: number;
  billablePayrollEmployees: number;
  aiSpaces: number;
};

export const PRICING_RULES = {
  entrepriseBase: 299,
  cabinetBase: 899,
  cabinetIncludedDossiers: 10,
  additionalDossier: 190,
  additionalAccountingUser: 99,
  additionalConnectedClientUser: 49,
  includedPayrollEmployees: 20,
  additionalPayrollEmployee: 7,
  includedAiSpaces: 5,
  ocrPerBlock: 100,
  ocrBlockPrice: 75,
  annualDiscountRate: 0.1,
} as const;

export const DEFAULT_PRICING_CONFIGURATION: PricingConfiguration = {
  audience: "entreprise",
  workspaces: 1,
  managedDossiers: 10,
  accountingUsers: 1,
  connectedClientUsers: 0,
  ocrDocuments: 100,
  payrollEmployees: 0,
  aiSpaces: 0,
};

export const DEFAULT_CABINET_PRICING_CONFIGURATION: PricingConfiguration = {
  audience: "cabinet",
  workspaces: 1,
  managedDossiers: 10,
  accountingUsers: 2,
  connectedClientUsers: 10,
  ocrDocuments: 1_000,
  payrollEmployees: 0,
  aiSpaces: 0,
};

function quantity(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : fallback;
}

export function normalizePricingConfiguration(input: unknown): PricingConfiguration | null {
  if (!input || typeof input !== "object") return null;
  const value = input as Record<string, unknown>;
  if (value.audience !== "entreprise" && value.audience !== "cabinet") return null;
  const defaults = value.audience === "cabinet"
    ? DEFAULT_CABINET_PRICING_CONFIGURATION
    : DEFAULT_PRICING_CONFIGURATION;

  return {
    audience: value.audience,
    workspaces: Math.max(1, quantity(value.workspaces, defaults.workspaces)),
    managedDossiers: quantity(value.managedDossiers, defaults.managedDossiers),
    accountingUsers: Math.max(1, quantity(value.accountingUsers, defaults.accountingUsers)),
    connectedClientUsers: quantity(value.connectedClientUsers, defaults.connectedClientUsers),
    ocrDocuments: quantity(value.ocrDocuments, defaults.ocrDocuments),
    payrollEmployees: quantity(value.payrollEmployees, defaults.payrollEmployees),
    aiSpaces: Math.min(PRICING_RULES.includedAiSpaces, quantity(value.aiSpaces, defaults.aiSpaces)),
  };
}

export function calculatePricing(configuration: PricingConfiguration): PricingResult {
  const normalized = normalizePricingConfiguration(configuration) ?? DEFAULT_PRICING_CONFIGURATION;
  const workspaces = normalized.workspaces;
  const managedDossiers = normalized.managedDossiers;
  const accountingUsers = normalized.accountingUsers;
  const connectedClientUsers = normalized.connectedClientUsers;
  const ocrDocuments = normalized.ocrDocuments;
  const payrollEmployees = normalized.payrollEmployees;
  const aiSpaces = normalized.aiSpaces;

  const isCabinet = normalized.audience === "cabinet";
  const base = isCabinet
    ? PRICING_RULES.cabinetBase
    : workspaces * PRICING_RULES.entrepriseBase;
  const additionalDossiers = isCabinet
    ? Math.max(0, managedDossiers - PRICING_RULES.cabinetIncludedDossiers) * PRICING_RULES.additionalDossier
    : 0;
  const includedOcr = isCabinet
    ? Math.max(PRICING_RULES.cabinetIncludedDossiers, managedDossiers) * PRICING_RULES.ocrPerBlock
    : workspaces * PRICING_RULES.ocrPerBlock;
  const includedAccountingUsers = isCabinet ? 2 : workspaces;
  const includedConnectedClientUsers = isCabinet ? managedDossiers : 0;
  const users = Math.max(0, accountingUsers - includedAccountingUsers) * PRICING_RULES.additionalAccountingUser
    + (isCabinet
      ? Math.max(0, connectedClientUsers - includedConnectedClientUsers) * PRICING_RULES.additionalConnectedClientUser
      : 0);
  const additionalOcrBlocks = Math.ceil(Math.max(0, ocrDocuments - includedOcr) / PRICING_RULES.ocrPerBlock);
  const ocr = additionalOcrBlocks * PRICING_RULES.ocrBlockPrice;
  const billablePayrollEmployees = Math.max(0, payrollEmployees - PRICING_RULES.includedPayrollEmployees);
  const payroll = billablePayrollEmployees * PRICING_RULES.additionalPayrollEmployee;
  const monthlyTotal = base + additionalDossiers + users + ocr + payroll;
  const annualBeforeDiscount = monthlyTotal * 12;
  const annualSavings = Math.round(annualBeforeDiscount * PRICING_RULES.annualDiscountRate);

  return {
    base,
    additionalDossiers,
    users,
    ocr,
    payroll,
    monthlyTotal,
    annualTotal: annualBeforeDiscount - annualSavings,
    annualSavings,
    includedOcr,
    includedAccountingUsers,
    includedConnectedClientUsers,
    additionalOcrBlocks,
    billablePayrollEmployees,
    aiSpaces,
  };
}

export function pricingEntitlements(configuration: PricingConfiguration) {
  const normalized = normalizePricingConfiguration(configuration) ?? DEFAULT_PRICING_CONFIGURATION;
  const result = calculatePricing(normalized);
  return {
    ocrLimit: Math.max(normalized.ocrDocuments, result.includedOcr),
    dossiersLimit: normalized.audience === "cabinet"
      ? Math.max(PRICING_RULES.cabinetIncludedDossiers, normalized.managedDossiers)
      : 0,
    usersLimit: Math.max(1, normalized.accountingUsers + (normalized.audience === "cabinet" ? normalized.connectedClientUsers : 0)),
    employeeLimit: Math.max(PRICING_RULES.includedPayrollEmployees, normalized.payrollEmployees),
  };
}

export function pricingPlanLabel(plan: string | null | undefined) {
  if (plan === "entreprise") return "Entreprise";
  if (plan === "cabinet") return "Cabinet";
  if (plan === "free") return "Mohasib Gratuit";
  if (plan === "trial") return "Essai gratuit";
  if (plan === "custom") return "Ancien tarif sur mesure";
  return plan ? `Ancien · ${plan}` : "Non configuré";
}
