import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentCompanyId } from "@/lib/email-oauth";
import { syncCompanyEmail, syncDossierEmail, type EmailSyncResult } from "@/lib/email-sync";
import { authorizePermission } from "@/lib/api-permissions";
import type { EmailImportMode } from "@/lib/email-document-filter";

const EMPTY: EmailSyncResult = {
  messagesScanned: 0,
  messagesFound: 0,
  attachmentsFound: 0,
  imported: 0,
  skipped: 0,
  failed: 0,
  errors: [],
};

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const dossierId = typeof body.dossierId === "string" ? body.dossierId : null;
  const mode: EmailImportMode = body.mode === "receipts_only"
    ? "receipts_only"
    : "accounting_documents";

  const admin = createAdminClient();
  let companyId: string | null = null;
  let connectedAccount: {
    gmail_token_encrypted: string | null;
    outlook_token_encrypted: string | null;
  } | null = null;

  if (dossierId) {
    const permission = await authorizePermission("document", "create", { dossierId });
    if (permission.response) return permission.response;
    const { data } = await admin
      .from("dossiers")
      .select("gmail_token_encrypted, outlook_token_encrypted")
      .eq("id", dossierId)
      .maybeSingle();
    connectedAccount = data;
  } else {
    const current = await getCurrentCompanyId();
    companyId = current.companyId;
    if (!companyId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const { data } = await admin
      .from("companies")
      .select("gmail_token_encrypted, outlook_token_encrypted")
      .eq("id", companyId)
      .maybeSingle();
    connectedAccount = data;
  }

  if (!connectedAccount?.gmail_token_encrypted && !connectedAccount?.outlook_token_encrypted) {
    return NextResponse.json({ ...EMPTY, not_connected: true });
  }

  const results: PromiseSettledResult<EmailSyncResult>[] = [];
  for (const [connected, provider] of [
    [connectedAccount.gmail_token_encrypted, "gmail"],
    [connectedAccount.outlook_token_encrypted, "outlook"],
  ] as const) {
    if (!connected) {
      results.push({ status: "fulfilled", value: EMPTY });
      continue;
    }
    try {
      const value = dossierId
        ? await syncDossierEmail(provider, dossierId, mode)
        : await syncCompanyEmail(provider, companyId!, mode);
      results.push({ status: "fulfilled", value });
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
