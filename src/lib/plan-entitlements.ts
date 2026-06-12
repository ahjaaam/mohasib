import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_PLAN_LIMITS, FEATURE_COLUMNS, type PlanEntitlements, type PlanFeature } from "@/lib/plan-features";
import { resolveTeamContext } from "@/lib/team";

export async function getPlanEntitlements(userId: string): Promise<PlanEntitlements> {
  const context = await resolveTeamContext(userId);
  const plan = context?.plan ?? "starter";
  const fallback = DEFAULT_PLAN_LIMITS[plan] ?? DEFAULT_PLAN_LIMITS.starter;
  if (!context) return build(plan, fallback, null);

  const admin = createAdminClient();
  const [{ data: limits }, { data: override }] = await Promise.all([
    admin.from("plan_limits").select("*").eq("plan", plan).maybeSingle(),
    admin.from("company_limit_overrides").select("*").eq("company_id", context.companyId)
      .or(`expires_at.is.null,expires_at.gte.${new Date().toISOString().slice(0, 10)}`).maybeSingle(),
  ]);
  return build(plan, { ...fallback, ...(limits ?? {}) }, override);
}

function build(plan: string, limits: Record<string, any>, override: Record<string, any> | null): PlanEntitlements {
  const effective = (key: string) => override?.[key] ?? limits[key];
  const features = Object.fromEntries(
    Object.entries(FEATURE_COLUMNS).map(([feature, column]) => [feature, !!effective(column)])
  ) as Record<Exclude<PlanFeature, "multi_users">, boolean>;
  return {
    plan,
    features: { ...features, multi_users: Number(effective("users_limit") ?? 1) > 1 },
    limits: {
      ocr: Number(effective("ocr_limit") ?? 0),
      storageGb: Number(effective("storage_gb") ?? 0),
      dossiers: Number(effective("dossiers_limit") ?? 0),
      users: Number(effective("users_limit") ?? 1),
      employees: Number(effective("employee_limit") ?? limits.employee_limit ?? 0),
    },
  };
}
