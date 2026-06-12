import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/rbac";
import { resolveTeamContext } from "@/lib/team";
import { logAudit } from "@/lib/audit";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const context = await resolveTeamContext(user.id);
  if (!context) return NextResponse.json({ error: "account_not_found" }, { status: 404 });
  const denied = await requirePermission({ userId: user.id, companyId: context.companyId }, "settings", "manage_team");
  if (denied) return denied;

  const { id } = await params;
  const admin = createAdminClient();
  const { data: current } = await admin.from("user_memberships").select("*").eq("id", id).eq("company_id", context.companyId).maybeSingle();
  if (!current) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (current.user_id === context.ownerId) return NextResponse.json({ error: "owner_immutable" }, { status: 400 });

  const body = await req.json();
  const nextStatus = body.status;
  if (nextStatus && !["active", "suspended", "revoked"].includes(nextStatus)) {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }
  const changes: Record<string, unknown> = {};
  changes.role_name = "manager";
  changes.dossier_scope = null;
  if (nextStatus) changes.status = nextStatus;
  if (body.first_name !== undefined) changes.first_name = body.first_name || null;
  if (body.last_name !== undefined) changes.last_name = body.last_name || null;

  if (Object.keys(changes).length) await admin.from("user_memberships").update(changes).eq("id", id);
  await admin.from("membership_permissions").delete().eq("membership_id", id);

  void logAudit({
    action: "UPDATE",
    entityType: "membership",
    entityId: id,
    entityLabel: current.user_email,
    companyId: context.companyId,
    oldValues: current,
    newValues: { ...current, ...changes },
    changedFields: Object.keys(changes),
  });
  return NextResponse.json({ success: true });
}
