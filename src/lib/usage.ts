import { createClient } from "@/lib/supabase/server";

export interface UsageData {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  resetDate: string; // YYYY-MM-DD of next 1st
}

export async function getMonthlyUsage(companyId: string): Promise<UsageData> {
  const supabase = await createClient();

  const { data: company, error } = await supabase
    .from("companies")
    .select("docs_uploaded_this_month, docs_reset_date, docs_limit_monthly")
    .eq("id", companyId)
    .single();

  const today = new Date();
  const nextReset = new Date(today.getFullYear(), today.getMonth() + 1, 1)
    .toISOString().split("T")[0];

  // Columns not yet migrated → no enforcement
  if (error || !company || company.docs_limit_monthly == null) {
    return { allowed: true, used: 0, limit: 200, remaining: 200, resetDate: nextReset };
  }

  // Auto-reset if stale (lazy reset — no cron needed)
  const resetDate = new Date(company.docs_reset_date);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  let used = company.docs_uploaded_this_month ?? 0;

  if (resetDate < monthStart) {
    await supabase
      .from("companies")
      .update({ docs_uploaded_this_month: 0, docs_reset_date: monthStart.toISOString().split("T")[0] })
      .eq("id", companyId);
    used = 0;
  }

  const limit = company.docs_limit_monthly ?? 200;
  const remaining = Math.max(0, limit - used);
  return { allowed: used < limit, used, limit, remaining, resetDate: nextReset };
}

export async function incrementUploadCount(
  companyId: string,
  userId: string,
  fileInfo: { fileName: string; fileType: string; pageCount?: number; source: string }
) {
  const supabase = await createClient();
  // Increment counter via RPC (atomic)
  await supabase.rpc("increment_upload_count", { company_id_param: companyId }).then(() => {});
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
