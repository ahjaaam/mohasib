import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminUser } from "@/lib/admin-auth";

export async function requireAdminApi() {
  const user = await getAdminUser();
  if (!user) return { user: null, admin: null, response: new NextResponse(null, { status: 404 }) };
  return { user, admin: createAdminClient(), response: null };
}

export async function logAdminAudit(event: {
  adminEmail: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  entityLabel?: string | null;
  companyId?: string | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
}) {
  const admin = createAdminClient();
  await admin.from("audit_logs").insert({
    user_email: event.adminEmail,
    company_id: event.companyId ?? null,
    action: `ADMIN_${event.action}`,
    entity_type: event.entityType,
    entity_id: event.entityId ?? null,
    entity_label: event.entityLabel ?? null,
    old_values: event.oldValues ?? null,
    new_values: event.newValues ?? null,
    changed_fields: event.newValues ? Object.keys(event.newValues) : null,
  });
}
