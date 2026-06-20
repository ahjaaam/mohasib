import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentCompanyId } from "@/lib/email-oauth";
import { syncCompanyEmail, type EmailSyncResult } from "@/lib/email-sync";

const EMPTY: EmailSyncResult = {
  messagesScanned: 0,
  messagesFound: 0,
  attachmentsFound: 0,
  imported: 0,
  skipped: 0,
  failed: 0,
  errors: [],
};

export async function POST() {
  const { companyId } = await getCurrentCompanyId();
  if (!companyId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: company } = await admin
    .from("companies")
    .select("gmail_token_encrypted, outlook_token_encrypted")
    .eq("id", companyId)
    .maybeSingle();
  if (!company?.gmail_token_encrypted && !company?.outlook_token_encrypted) {
    return NextResponse.json({ ...EMPTY, not_connected: true });
  }

  const results: PromiseSettledResult<EmailSyncResult>[] = [];
  for (const [connected, provider] of [
    [company.gmail_token_encrypted, "gmail"],
    [company.outlook_token_encrypted, "outlook"],
  ] as const) {
    if (!connected) {
      results.push({ status: "fulfilled", value: EMPTY });
      continue;
    }
    try {
      results.push({ status: "fulfilled", value: await syncCompanyEmail(provider, companyId) });
    } catch (reason) {
      results.push({ status: "rejected", reason });
    }
  }
  const successful = results
    .filter((result): result is PromiseFulfilledResult<EmailSyncResult> => result.status === "fulfilled")
    .map(result => result.value);
  const total = successful.reduce<EmailSyncResult>((sum, result) => ({
    messagesScanned: sum.messagesScanned + result.messagesScanned,
    messagesFound: sum.messagesFound + result.messagesFound,
    attachmentsFound: sum.attachmentsFound + result.attachmentsFound,
    imported: sum.imported + result.imported,
    skipped: sum.skipped + result.skipped,
    failed: sum.failed + result.failed,
    errors: [...(sum.errors ?? []), ...(result.errors ?? [])],
  }), EMPTY);
  const providerErrors = results
    .filter((result): result is PromiseRejectedResult => result.status === "rejected")
    .map(result => result.reason instanceof Error ? result.reason.message : String(result.reason));

  if (!successful.length && providerErrors.length) {
    return NextResponse.json({ ...total, error: providerErrors.join(" ") }, { status: 400 });
  }
  return NextResponse.json({
    ...total,
    errors: [...new Set([...(total.errors ?? []), ...providerErrors])].slice(0, 3),
  });
}
