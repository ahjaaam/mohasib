export const FEATURES = {
  // Treasury is intentionally reversible while the first version is evaluated.
  // Set NEXT_PUBLIC_TREASURY_ENABLED=false to remove it from navigation and routes.
  TREASURY_ENABLED: process.env.NEXT_PUBLIC_TREASURY_ENABLED !== "false",
  SAISIE_ENABLED: process.env.NEXT_PUBLIC_SAISIE_ENABLED === "true",
  GRAND_LIVRE_ENABLED: process.env.NEXT_PUBLIC_GRAND_LIVRE_ENABLED === "true",
  BILAN_ENABLED: process.env.NEXT_PUBLIC_BILAN_ENABLED === "true",
} as const;
