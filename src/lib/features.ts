export const FEATURES = {
  SAISIE_ENABLED: process.env.NEXT_PUBLIC_SAISIE_ENABLED === "true",
  GRAND_LIVRE_ENABLED: process.env.NEXT_PUBLIC_GRAND_LIVRE_ENABLED === "true",
  BILAN_ENABLED: process.env.NEXT_PUBLIC_BILAN_ENABLED === "true",
} as const;
