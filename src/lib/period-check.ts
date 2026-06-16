import "server-only";
import { checkPeriodLocked } from "@/lib/audit";

export async function enforcePeriodLock(
  mois: number,
  annee: number,
  companyId?: string | null,
  dossierId?: string | null,
): Promise<Response | null> {
  const lock = await checkPeriodLocked(mois, annee, companyId, dossierId);
  if (!lock.locked) return null;

  return Response.json(
    {
      error: "period_locked",
      message: `La période ${mois}/${annee} est verrouillée.`,
      reason: lock.reason,
      locked_by: lock.lockedBy,
      lock_type: lock.lockType,
    },
    { status: 423 },
  );
}
