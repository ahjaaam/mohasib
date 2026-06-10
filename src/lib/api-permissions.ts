import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/rbac";
import { resolveTeamContext } from "@/lib/team";

export async function authorizePermission(resource: string, action: string, scope?: { companyId?: string | null; dossierId?: string | null }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, response: Response.json({ error: "unauthorized" }, { status: 401 }) };

  let companyId = scope?.companyId ?? null;
  if (!companyId && !scope?.dossierId) companyId = (await resolveTeamContext(user.id))?.companyId ?? null;
  const response = await requirePermission({ userId: user.id, companyId, dossierId: scope?.dossierId ?? null }, resource, action);
  return { user, response };
}
