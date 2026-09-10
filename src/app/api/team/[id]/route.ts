import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/rbac";
import { resolveTeamContext } from "@/lib/team";
import { logAudit } from "@/lib/audit";
import { parseDossierScope } from "@/lib/dossier-scope";

const ACCESS_SCOPES = ["business_only", "comptable_pro_only", "both"] as const;
type AccessScope = typeof ACCESS_SCOPES[number];

function isAccessScope(value: unknown): value is AccessScope {
  return ACCESS_SCOPES.includes(value as AccessScope);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const context = await resolveTeamContext(user.id);
  if (!context) return NextResponse.json({ error: "account_not_found" }, { status: 404 });
  const denied = await requirePermission({ userId: user.id, companyId: context.companyId, scope: context.track === "comptable" ? "comptable_pro" : "business" }, "settings", "manage_team");
  if (denied) return denied;

  const { id } = await params;
  const admin = createAdminClient();
  const { data: current } = await admin.from("user_memberships").select("*").eq("id", id).eq("company_id", context.companyId).neq("role_name", "client_portal").maybeSingle();
  if (!current) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (current.user_id === context.ownerId) return NextResponse.json({ error: "owner_immutable" }, { status: 400 });

  const body = await req.json();
  const nextStatus = body.status;
  if (nextStatus && !["active", "suspended", "revoked"].includes(nextStatus)) {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }
  const changes: Record<string, unknown> = {};
  changes.role_name = "manager";
  if (nextStatus) changes.status = nextStatus;
  if (body.first_name !== undefined) changes.first_name = body.first_name || null;
  if (body.last_name !== undefined) changes.last_name = body.last_name || null;
  if (body.access_scope !== undefined) {
    if (!isAccessScope(body.access_scope)) return NextResponse.json({ error: "invalid_access_scope" }, { status: 400 });
    changes.access_scope = body.access_scope;
  }

  const effectiveAccessScope = (changes.access_scope ?? current.access_scope ?? "both") as AccessScope;
  if (effectiveAccessScope === "business_only") {
    changes.dossier_scope = null;
  } else if (body.dossier_scope !== undefined) {
    const parsedDossierScope = parseDossierScope(body.dossier_scope);
    if (!parsedDossierScope.valid) {
      return NextResponse.json({ error: "invalid_dossier_scope", message: "Sélectionnez au moins un dossier ou choisissez Tous les dossiers." }, { status: 400 });
    }
    const dossierScope = parsedDossierScope.value;
    if (dossierScope) {
      const { count } = await admin
        .from("dossiers")
        .select("id", { count: "exact", head: true })
        .eq("fiduciaire_user_id", context.ownerId)
        .eq("statut", "actif")
        .in("id", dossierScope);
      if (count !== dossierScope.length) {
        return NextResponse.json({ error: "invalid_dossier_scope", message: "Un ou plusieurs dossiers sélectionnés sont invalides." }, { status: 400 });
      }
    }
    changes.dossier_scope = dossierScope;
  }

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
