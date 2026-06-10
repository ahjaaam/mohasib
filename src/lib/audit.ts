import { createClient } from "@/lib/supabase/server";

export type AuditEvent = {
  action: string;
  entityType: string;
  entityId?: string | null;
  entityLabel?: string | null;
  companyId?: string | null;
  dossierId?: string | null;
  userId?: string | null;
  userEmail?: string | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  changedFields?: string[] | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export async function logAudit(event: AuditEvent) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  await supabase.from("audit_logs").insert({
    user_id: event.userId ?? user?.id ?? null,
    user_email: event.userEmail ?? user?.email ?? null,
    company_id: event.companyId ?? null,
    dossier_id: event.dossierId ?? null,
    action: event.action,
    entity_type: event.entityType,
    entity_id: event.entityId ?? null,
    entity_label: event.entityLabel ?? null,
    old_values: event.oldValues ?? null,
    new_values: event.newValues ?? null,
    changed_fields: event.changedFields ?? null,
    ip_address: event.ipAddress ?? null,
    user_agent: event.userAgent ?? null,
  });
}

export async function checkPeriodLocked(
  mois: number,
  annee: number,
  companyId?: string | null,
  dossierId?: string | null,
) {
  const supabase = await createClient();
  let query = supabase
    .from("accounting_periods")
    .select("is_locked, lock_reason")
    .eq("mois", mois)
    .eq("annee", annee);

  if (dossierId) query = query.eq("dossier_id", dossierId).is("company_id", null);
  else if (companyId) query = query.eq("company_id", companyId).is("dossier_id", null);
  else return { locked: false };

  const { data } = await query.maybeSingle();
  return {
    locked: !!data?.is_locked,
    reason: data?.lock_reason ?? undefined,
  };
}
