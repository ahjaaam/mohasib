import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type AccountApprovalStatus = "pending" | "approved" | "rejected" | "legacy";

export async function getAccountApprovalStatus(userId: string): Promise<AccountApprovalStatus> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("fiduciaire_waitlist")
    .select("status")
    .eq("request_kind", "signup")
    .eq("auth_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return "legacy";
  if (data.status === "approved") return "approved";
  if (data.status === "rejected") return "rejected";
  return "pending";
}

export async function isAccountApproved(userId: string) {
  const status = await getAccountApprovalStatus(userId);
  return status === "approved" || status === "legacy";
}
