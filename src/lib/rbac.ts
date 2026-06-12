import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type PermissionContext = {
  userId: string;
  companyId?: string | null;
  dossierId?: string | null;
};

export type EffectivePermission = { resource: string; action: string };

const FORBIDDEN_MESSAGE =
  "Vous n'avez pas la permission d'effectuer cette action. Contactez le propriétaire du compte.";

export async function getMembershipForContext(ctx: PermissionContext) {
  const admin = createAdminClient();
  let query = admin
    .from("user_memberships")
    .select("id,user_id,user_email,company_id,dossier_id,role_name,dossier_scope,status,employee_id")
    .eq("user_id", ctx.userId);

  if (ctx.companyId) query = query.eq("company_id", ctx.companyId);
  else if (ctx.dossierId) query = query.or(`dossier_id.eq.${ctx.dossierId},dossier_scope.cs.{${ctx.dossierId}}`);

  const { data } = await query.limit(1).maybeSingle();
  return data;
}

async function isOwner(ctx: PermissionContext) {
  const admin = createAdminClient();

  if (ctx.companyId) {
    const { data } = await admin.from("companies").select("id").eq("id", ctx.companyId).eq("user_id", ctx.userId).maybeSingle();
    if (data) return true;
  }

  if (ctx.dossierId) {
    const { data } = await admin.from("dossiers").select("id").eq("id", ctx.dossierId).eq("fiduciaire_user_id", ctx.userId).maybeSingle();
    if (data) return true;
  }

  if (!ctx.companyId && !ctx.dossierId) {
    const [{ data: company }, { data: cabinet }] = await Promise.all([
      admin.from("companies").select("id").eq("user_id", ctx.userId).maybeSingle(),
      admin.from("cabinets").select("id").eq("user_id", ctx.userId).maybeSingle(),
    ]);
    return !!company || !!cabinet;
  }

  return false;
}

export async function getEffectivePermissions(membershipId: string): Promise<EffectivePermission[]> {
  const admin = createAdminClient();
  const { data: membership } = await admin
    .from("user_memberships")
    .select("role_name")
    .eq("id", membershipId)
    .maybeSingle();

  if (!membership) return [];

  const [{ data: rolePermissions }, { data: overrides }] = await Promise.all([
    admin.from("role_permissions").select("resource,action").eq("role_name", membership.role_name),
    admin.from("membership_permissions").select("resource,action,is_granted").eq("membership_id", membershipId),
  ]);

  const effective = new Map<string, EffectivePermission>();
  for (const permission of rolePermissions ?? []) {
    effective.set(`${permission.resource}:${permission.action}`, permission);
  }
  for (const override of overrides ?? []) {
    const key = `${override.resource}:${override.action}`;
    if (override.is_granted) effective.set(key, { resource: override.resource, action: override.action });
    else effective.delete(key);
  }
  return [...effective.values()];
}

export async function getActiveUserCount(companyId?: string, dossierId?: string): Promise<number> {
  const admin = createAdminClient();
  let query = admin
    .from("user_memberships")
    .select("id", { count: "exact", head: true })
    .in("status", ["invited", "active", "suspended"]);

  if (companyId) query = query.eq("company_id", companyId);
  else if (dossierId) query = query.eq("dossier_id", dossierId);
  else return 1;

  const { count } = await query;
  return 1 + (count ?? 0);
}

export async function can(ctx: PermissionContext, resource: string, action: string): Promise<boolean> {
  if (await isOwner(ctx)) return true;

  const membership = await getMembershipForContext(ctx);
  if (!membership || membership.status !== "active") return false;
  if (membership.role_name === "manager") return resource !== "settings";

  if (ctx.dossierId && membership.role_name === "collaborateur") {
    const scope = membership.dossier_scope as string[] | null;
    if (scope?.length && !scope.includes(ctx.dossierId)) return false;
  }

  const admin = createAdminClient();
  const { data: override } = await admin
    .from("membership_permissions")
    .select("is_granted")
    .eq("membership_id", membership.id)
    .eq("resource", resource)
    .eq("action", action)
    .maybeSingle();

  if (override) return !!override.is_granted;

  const { data: preset } = await admin
    .from("role_permissions")
    .select("id")
    .eq("role_name", membership.role_name)
    .eq("resource", resource)
    .eq("action", action)
    .maybeSingle();
  return !!preset;
}

export async function requirePermission(ctx: PermissionContext, resource: string, action: string): Promise<Response | null> {
  if (await can(ctx, resource, action)) return null;
  return Response.json({ error: "forbidden", message: FORBIDDEN_MESSAGE }, { status: 403 });
}
