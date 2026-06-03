import { createClient } from "@/lib/supabase/server";

type PermissionContext = {
  userId: string;
  companyId?: string | null;
  dossierId?: string | null;
};

const WRITE_ACTIONS = new Set(["create", "update", "delete", "validate", "lock", "export"]);

function roleAllows(role: string, _resource: string, action: string) {
  if (role === "owner" || role === "cabinet_owner") return true;
  if (role === "read_auditor") return !WRITE_ACTIONS.has(action);
  if (role === "client_portal") return action === "read";
  if (role === "manager" || role === "collaborateur") return action !== "delete";
  if (role === "employee") return action === "read" || action === "update";
  return false;
}

export async function can(ctx: PermissionContext, resource: string, action: string): Promise<boolean> {
  const supabase = await createClient();

  let query = supabase
    .from("user_memberships")
    .select("role_name, dossier_scope, status")
    .eq("user_id", ctx.userId)
    .eq("status", "active");

  if (ctx.dossierId) {
    query = query.or(`dossier_id.eq.${ctx.dossierId},dossier_scope.cs.{${ctx.dossierId}}`);
  } else if (ctx.companyId) {
    query = query.eq("company_id", ctx.companyId);
  }

  const { data } = await query;
  return (data ?? []).some((membership: any) => roleAllows(membership.role_name, resource, action));
}

export async function requirePermission(
  ctx: PermissionContext,
  resource: string,
  action: string,
): Promise<Response | null> {
  const allowed = await can(ctx, resource, action);
  if (allowed) return null;
  return Response.json({ error: "Accès non autorisé" }, { status: 403 });
}
