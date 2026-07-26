import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/rbac";
import { resolveTeamContext } from "@/lib/team";
import { logAudit } from "@/lib/audit";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; membershipId: string }> }) {
  const { id, membershipId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const context = await resolveTeamContext(user.id);
  if (!context) return NextResponse.json({ error: "account_not_found" }, { status: 404 });
  const denied = await requirePermission(
    { userId: user.id, companyId: context.companyId, scope: "comptable_pro" },
    "settings", "manage_team",
  );
  if (denied) return denied;

  const admin = createAdminClient();
  const { data: dossier } = await admin.from("dossiers")
    .select("id")
    .eq("id", id)
    .eq("fiduciaire_user_id", context.ownerId)
    .maybeSingle();
  if (!dossier) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data: current } = await admin.from("user_memberships")
    .select("*")
    .eq("id", membershipId)
    .eq("company_id", context.companyId)
    .eq("dossier_id", id)
    .eq("role_name", "client_portal")
    .maybeSingle();
  if (!current) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await req.json();
  const nextStatus = body.status;
  if (!nextStatus || !["active", "suspended", "revoked"].includes(nextStatus)) {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }

  const { error } = await admin.from("user_memberships")
    .update({ status: nextStatus })
    .eq("id", membershipId)
    .eq("company_id", context.companyId)
    .eq("dossier_id", id)
    .eq("role_name", "client_portal");
  if (error) {
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  void logAudit({
    action: "UPDATE",
    entityType: "membership",
    entityId: membershipId,
    entityLabel: current.user_email,
    companyId: context.companyId,
    oldValues: current,
    newValues: { ...current, status: nextStatus },
    changedFields: ["status"],
  });

  return NextResponse.json({ success: true });
}
