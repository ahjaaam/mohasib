import { NextResponse } from "next/server";
import { requireAdminApi, logAdminAudit } from "@/lib/admin-api";

export async function POST(request: Request) {
  const { user, admin, response } = await requireAdminApi();
  if (response) return response;
  const body = await request.json();
  const ids = Array.isArray(body.ids) ? [...new Set(body.ids.map(String))].slice(0, 200) : [];
  const action = String(body.action ?? "");
  if (!ids.length || !["suspend", "reactivate"].includes(action)) return NextResponse.json({ message: "Sélection ou action invalide." }, { status: 400 });

  const errors: string[] = [];
  for (const id of ids) {
    const result = await admin!.auth.admin.updateUserById(id, { ban_duration: action === "suspend" ? "876000h" : "none" });
    if (result.error) errors.push(`${id}: ${result.error.message}`);
  }
  const successfulIds = ids.filter(id => !errors.some(error => error.startsWith(`${id}:`)));
  if (successfulIds.length) await admin!.from("user_memberships").update({ status: action === "suspend" ? "suspended" : "active" }).in("user_id", successfulIds).neq("status", "revoked");
  await logAdminAudit({ adminEmail: user!.email!, action: `USERS_BULK_${action.toUpperCase()}`, entityType: "auth_user", entityLabel: `${successfulIds.length} utilisateurs`, newValues: { ids: successfulIds, errors } });
  return NextResponse.json({ ok: errors.length === 0, updated: successfulIds.length, errors });
}
