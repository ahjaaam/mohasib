import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPlanEntitlements } from "@/lib/plan-entitlements";
import type { PlanFeature } from "@/lib/plan-features";

export async function requirePlanFeature(feature: PlanFeature) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, response: NextResponse.json({ error: "Non authentifié" }, { status: 401 }) };
  const entitlements = await getPlanEntitlements(user.id);
  if (!entitlements.features[feature]) {
    return {
      user,
      response: NextResponse.json({
        error: "upgrade_required",
        message: `Cette fonctionnalité n'est pas incluse dans le plan ${entitlements.plan}.`,
      }, { status: 403 }),
    };
  }
  return { user, entitlements, response: null };
}
