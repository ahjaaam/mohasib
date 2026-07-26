import "server-only";
import { NextResponse } from "next/server";
import { FEATURES } from "@/lib/features";

export function requireFeatureEnabled(flag: keyof typeof FEATURES) {
  if (FEATURES[flag]) return { response: null };
  return {
    response: NextResponse.json(
      {
        error: "feature_disabled",
        message: "La saisie manuelle d'écritures n'est plus disponible. Mohasib génère vos écritures automatiquement — exportez-les pour votre comptable.",
      },
      { status: 403 },
    ),
  };
}
