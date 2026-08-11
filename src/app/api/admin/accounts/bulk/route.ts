import { NextResponse } from "next/server";
import { requireAdminApi, logAdminAudit } from "@/lib/admin-api";

export async function POST(request: Request) {
  const { user, admin, response } = await requireAdminApi();
  if (response) return response;
  const body = await request.json();
  const ids = Array.isArray(body.ids) ? [...new Set(body.ids.map(String))].slice(0, 200) : [];
  const action = String(body.action ?? "");
  if (!ids.length || !["suspend", "reactivate", "archive", "restore", "add_tag"].includes(action)) return NextResponse.json({ message: "Sélection ou action invalide." }, { status: 400 });

  let result;
  if (action === "suspend" || action === "reactivate") {
    result = await admin!.from("companies").update({ is_suspended: action === "suspend", suspended_reason: action === "suspend" ? String(body.reason || "Action groupée administrateur") : null }).in("id", ids);
  } else if (action === "archive" || action === "restore") {
    result = await admin!.from("companies").update({ lifecycle_stage: action === "archive" ? "archived" : "active", archived_at: action === "archive" ? new Date().toISOString() : null }).in("id", ids);
  } else {
    const tag = String(body.tag ?? "").trim().toLowerCase();
    if (!tag) return NextResponse.json({ message: "Le tag est obligatoire." }, { status: 400 });
    const current = await admin!.from("companies").select("id,admin_tags").in("id", ids);
    const errors = [];
    for (const company of current.data ?? []) {
      const update = await admin!.from("companies").update({ admin_tags: [...new Set([...(company.admin_tags ?? []), tag])].slice(0, 20) }).eq("id", company.id);
      if (update.error) errors.push(update.error.message);
    }
    result = { error: errors.length ? new Error(errors.join("; ")) : null };
  }
  if (result.error) return NextResponse.json({ message: result.error.message }, { status: 400 });
  await logAdminAudit({ adminEmail: user!.email!, action: `ACCOUNTS_BULK_${action.toUpperCase()}`, entityType: "company", entityLabel: `${ids.length} comptes`, newValues: { ids, action, tag: body.tag ?? null } });
  return NextResponse.json({ ok: true, updated: ids.length });
}
