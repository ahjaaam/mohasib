import "server-only";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

type JsonRecord = Record<string, unknown>;

export interface AuditEvent {
  userId?: string | null;
  userEmail?: string | null;
  companyId?: string | null;
  dossierId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  entityLabel?: string | null;
  oldValues?: JsonRecord | null;
  newValues?: JsonRecord | null;
  changedFields?: string[] | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  deviceType?: string | null;
  sessionId?: string | null;
  requestMethod?: string | null;
  requestPath?: string | null;
  success?: boolean;
  errorMessage?: string | null;
}

export interface AccountingEvent {
  companyId?: string | null;
  dossierId?: string | null;
  eventType: string;
  triggeredBy?: string | null;
  triggeredByEmail?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  amount?: number | null;
  currency?: string;
  periodMois?: number | null;
  periodAnnee?: number | null;
  eventData: JsonRecord;
  previousEventId?: string | null;
}

function checksum(payload: unknown) {
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export async function logAudit(event: AuditEvent) {
  const createdAt = new Date().toISOString();
  const admin = createAdminClient();
  const digest = checksum({
    entityId: event.entityId,
    action: event.action,
    newValues: event.newValues,
    createdAt,
  });

  const { error } = await admin.from("audit_logs").insert({
    user_id: event.userId ?? null,
    user_email: event.userEmail ?? null,
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
    device_type: event.deviceType ?? null,
    session_id: event.sessionId ?? null,
    request_method: event.requestMethod ?? null,
    request_path: event.requestPath ?? null,
    success: event.success ?? true,
    error_message: event.errorMessage ?? null,
    checksum: digest,
    created_at: createdAt,
  });

  if (error) console.error("[audit] logAudit failed", error.message);
}

export async function logAccountingEvent(event: AccountingEvent) {
  const createdAt = new Date().toISOString();
  const admin = createAdminClient();
  let previousEventId = event.previousEventId ?? null;

  if (!previousEventId) {
    let query = admin
      .from("accounting_events")
      .select("id")
      .order("created_at", { ascending: false })
      .limit(1);

    if (event.dossierId) query = query.eq("dossier_id", event.dossierId);
    else if (event.companyId) query = query.eq("company_id", event.companyId);

    const { data } = await query.maybeSingle();
    previousEventId = data?.id ?? null;
  }

  const eventHash = checksum({
    eventType: event.eventType,
    entityId: event.entityId,
    amount: event.amount,
    eventData: event.eventData,
    previousEventId,
    createdAt,
  });

  const { data, error } = await admin
    .from("accounting_events")
    .insert({
      company_id: event.companyId ?? null,
      dossier_id: event.dossierId ?? null,
      event_type: event.eventType,
      triggered_by: event.triggeredBy ?? null,
      triggered_by_email: event.triggeredByEmail ?? null,
      entity_type: event.entityType ?? null,
      entity_id: event.entityId ?? null,
      amount: event.amount ?? null,
      currency: event.currency ?? "MAD",
      period_mois: event.periodMois ?? null,
      period_annee: event.periodAnnee ?? null,
      event_data: event.eventData,
      event_hash: eventHash,
      previous_event_id: previousEventId,
      created_at: createdAt,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[audit] logAccountingEvent failed", error.message);
    return null;
  }

  return data?.id ?? null;
}

export async function createVersion(
  entityType: string,
  entityId: string,
  snapshot: JsonRecord,
  changedBy?: string | null,
  changedByEmail?: string | null,
  changeType = "UPDATE",
  changeReason?: string | null,
  diff?: JsonRecord | null,
) {
  const admin = createAdminClient();
  const { data: lastVersion } = await admin
    .from("entity_versions")
    .select("version_number")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = Number(lastVersion?.version_number ?? 0) + 1;
  const { error } = await admin.from("entity_versions").insert({
    entity_type: entityType,
    entity_id: entityId,
    version_number: nextVersion,
    changed_by: changedBy ?? null,
    changed_by_email: changedByEmail ?? null,
    change_type: changeType,
    change_reason: changeReason ?? null,
    snapshot,
    diff: diff ?? null,
  });

  if (error) console.error("[audit] createVersion failed", error.message);
  return nextVersion;
}

export async function checkPeriodLocked(
  mois: number,
  annee: number,
  companyId?: string | null,
  dossierId?: string | null,
): Promise<{ locked: boolean; reason?: string; lockedBy?: string; lockType?: string }> {
  if (!companyId && !dossierId) return { locked: false };

  const admin = createAdminClient();
  let query = admin
    .from("accounting_periods")
    .select("is_locked, lock_type, lock_reason, locked_by_email")
    .eq("mois", mois)
    .eq("annee", annee)
    .eq("is_locked", true);

  if (dossierId) query = query.eq("dossier_id", dossierId);
  else if (companyId) query = query.eq("company_id", companyId);

  const { data } = await query.maybeSingle();
  if (!data) return { locked: false };

  return {
    locked: true,
    reason: data.lock_reason ?? undefined,
    lockedBy: data.locked_by_email ?? undefined,
    lockType: data.lock_type ?? undefined,
  };
}

export async function lockAccountingPeriod(params: {
  mois: number;
  annee: number;
  companyId?: string | null;
  dossierId?: string | null;
  lockedBy?: string | null;
  lockedByEmail?: string | null;
  reason: string;
  lockType?: "soft" | "hard";
  triggeredByEntity?: string | null;
  triggeredById?: string | null;
}) {
  const admin = createAdminClient();
  const { error } = await admin.from("accounting_periods").upsert(
    {
      company_id: params.companyId ?? null,
      dossier_id: params.dossierId ?? null,
      mois: params.mois,
      annee: params.annee,
      lock_type: params.lockType ?? "hard",
      is_locked: true,
      locked_at: new Date().toISOString(),
      locked_by: params.lockedBy ?? null,
      locked_by_email: params.lockedByEmail ?? null,
      lock_reason: params.reason,
      is_unlocked: false,
      unlocked_at: null,
      unlocked_by: null,
      unlock_reason: null,
      triggered_by_entity: params.triggeredByEntity ?? null,
      triggered_by_id: params.triggeredById ?? null,
    },
    { onConflict: params.dossierId ? "dossier_id,mois,annee" : "company_id,mois,annee" },
  );

  if (error) console.error("[audit] lockAccountingPeriod failed", error.message);
}

export function getDiff(
  oldRecord: JsonRecord | null | undefined,
  newRecord: JsonRecord | null | undefined,
): Record<string, { from: unknown; to: unknown }> {
  const before = oldRecord ?? {};
  const after = newRecord ?? {};
  const diff: Record<string, { from: unknown; to: unknown }> = {};
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of allKeys) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      diff[key] = { from: before[key], to: after[key] };
    }
  }

  return diff;
}
