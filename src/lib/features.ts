export const FEATURES = {
  // Treasury stays hidden until it is ready for production.
  // Set NEXT_PUBLIC_TREASURY_ENABLED=true only in environments where it is being developed or reviewed.
  TREASURY_ENABLED: process.env.NEXT_PUBLIC_TREASURY_ENABLED === "true",
  SAISIE_ENABLED: process.env.NEXT_PUBLIC_SAISIE_ENABLED === "true",
  GRAND_LIVRE_ENABLED: process.env.NEXT_PUBLIC_GRAND_LIVRE_ENABLED === "true",
  BILAN_ENABLED: process.env.NEXT_PUBLIC_BILAN_ENABLED === "true",
} as const;
