import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminUser } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit";

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
  await logAudit({
    userEmail: event.adminEmail,
    companyId: event.companyId ?? null,
    action: `ADMIN_${event.action}`,
    entityType: event.entityType,
    entityId: event.entityId ?? null,
    entityLabel: event.entityLabel ?? null,
    oldValues: event.oldValues ?? null,
    newValues: event.newValues ?? null,
    changedFields: event.newValues ? Object.keys(event.newValues) : null,
  });
}
