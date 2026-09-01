import { NextResponse } from "next/server";
import { requireAdminApi, logAdminAudit } from "@/lib/admin-api";

export async function POST(request: Request) {
  const { user, admin, response } = await requireAdminApi();
  if (response) return response;
  const body = await request.json();
  const ids: string[] = Array.isArray(body.ids) ? [...new Set<string>(body.ids.map((id: unknown) => String(id)))].slice(0, 200) : [];
  const action = String(body.action ?? "");
  if (!ids.length || !["suspend", "reactivate"].includes(action)) return NextResponse.json({ message: "Sélection ou action invalide." }, { status: 400 });

  const errors: string[] = [];
  const successfulIds: string[] = [];
  for (const id of ids) {
    const previousMemberships = await admin!.from("user_memberships").select("id,status").eq("user_id", id).neq("status", "revoked");
    if (previousMemberships.error) {
      errors.push(`${id}: ${previousMemberships.error.message}`);
      continue;
    }
    const membership = await admin!.from("user_memberships").update({ status: action === "suspend" ? "suspended" : "active" }).eq("user_id", id).neq("status", "revoked");
    if (membership.error) {
      errors.push(`${id}: ${membership.error.message}`);
      continue;
    }
    const authResult = await admin!.auth.admin.updateUserById(id, { ban_duration: action === "suspend" ? "876000h" : "none" });
    if (authResult.error) {
      const rollbackErrors: string[] = [];
      for (const previous of previousMemberships.data ?? []) {
        const rollback = await admin!.from("user_memberships").update({ status: previous.status }).eq("id", previous.id);
        if (rollback.error) rollbackErrors.push(rollback.error.message);
      }
      errors.push(`${id}: ${authResult.error.message}${rollbackErrors.length ? `; restauration des accès incomplète (${rollbackErrors.join("; ")})` : ""}`);
      continue;
    }
    successfulIds.push(id);
  }
  await logAdminAudit({ adminEmail: user!.email!, action: `USERS_BULK_${action.toUpperCase()}`, entityType: "auth_user", entityLabel: `${successfulIds.length} utilisateurs`, newValues: { ids: successfulIds, errors } });
  if (errors.length) return NextResponse.json({ message: `${successfulIds.length} utilisateur(s) sur ${ids.length} ont été modifiés. ${errors.join("; ")}`, updated: successfulIds.length, errors }, { status: 400 });
  return NextResponse.json({ ok: true, updated: successfulIds.length, errors: [] });
}
