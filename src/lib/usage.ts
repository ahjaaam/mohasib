import { createClient } from "@/lib/supabase/server";
import { checkPlanLimit, checkTrialLimit, incrementOCRUsage, incrementTrialUsage } from "@/lib/plan-check";

export interface UsageData {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  resetDate: string; // YYYY-MM-DD of next 1st
  isTrial?: boolean;
}

export async function getMonthlyUsage(companyId: string): Promise<UsageData> {
  const today = new Date();
  const nextReset = new Date(today.getFullYear(), today.getMonth() + 1, 1)
    .toISOString().split("T")[0];
  const usage = await checkPlanLimit(companyId, "ocr");
  const trialUsage = await checkTrialLimit(companyId, "ocr_scans");
  if (trialUsage.isTrial) {
    return {
      allowed: trialUsage.allowed,
      used: trialUsage.used,
      limit: trialUsage.limit,
      remaining: Math.max(0, trialUsage.limit - trialUsage.used),
      resetDate: nextReset,
      isTrial: true,
    };
  }
  const limit = Number(usage.limit ?? 0);
  const used = Number(usage.used ?? 0);
  return {
    allowed: usage.allowed,
    used,
    limit,
    remaining: limit < 0 ? -1 : Math.max(0, limit - used),
    resetDate: nextReset,
    isTrial: false,
  };
}

export async function incrementUploadCount(
  companyId: string,
  userId: string,
  fileInfo: { fileName: string; fileType: string; pageCount?: number; source: string }
) {
  const supabase = await createClient();
  const trialUsage = await checkTrialLimit(companyId, "ocr_scans");
  if (trialUsage.isTrial && fileInfo.source !== "bank_import") await incrementTrialUsage(companyId, "ocr_scans");
  await incrementOCRUsage(companyId);

  // Log upload (best-effort — table may not exist yet during migration)
  await supabase.from("upload_logs").insert({
    company_id: companyId,
    user_id: userId,
    file_name: fileInfo.fileName,
    file_type: fileInfo.fileType,
    page_count: fileInfo.pageCount ?? 1,
    source: fileInfo.source,
  }).then(() => {});
}
