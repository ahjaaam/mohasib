import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { decodeTokenPayload, encodeTokenPayload, type EmailProvider } from "@/lib/email-oauth";
import { extractWithFallback } from "@/lib/ocr-engine";
import { getMonthlyUsage, incrementUploadCount } from "@/lib/usage";
import {
  shouldImportEmailDocument,
  type EmailImportMode,
} from "@/lib/email-document-filter";

type OAuthToken = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  expires_at?: number;
  stored_at?: number;
  token_type?: string;
  scope?: string;
};

type EmailAttachment = {
  provider: EmailProvider;
  messageId: string;
  attachmentId: string;
  fileName: string;
  mimeType: string;
  subject: string;
  sender: string;
  receivedAt: string | null;
  content: Buffer;
};

export type EmailSyncResult = {
  messagesScanned: number;
  messagesFound: number;
  attachmentsFound: number;
  imported: number;
  skipped: number;
  failed: number;
  errors?: string[];
};

const EMAIL_LOOKBACK_MS = 24 * 60 * 60 * 1000;
const EMAIL_PAGE_SIZE = 100;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function normalizedMimeType(fileName: string, mimeType: string) {
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith(".pdf")) return "application/pdf";
  if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) return "image/jpeg";
  if (lowerName.endsWith(".png")) return "image/png";
  if (lowerName.endsWith(".webp")) return "image/webp";
  if (lowerName.endsWith(".gif")) return "image/gif";
  return mimeType.toLowerCase().split(";")[0];
}

function isSupportedAttachment(fileName: string, mimeType: string) {
  return ALLOWED_MIME_TYPES.has(normalizedMimeType(fileName, mimeType));
}

function tokenExpired(token: OAuthToken) {
  const expiresAt = token.expires_at
    ?? (token.stored_at && token.expires_in ? token.stored_at + token.expires_in * 1000 : 0);
  if (!expiresAt && token.refresh_token) return true;
  return !token.access_token || (expiresAt > 0 && Date.now() >= expiresAt - 60_000);
}

async function refreshToken(provider: EmailProvider, token: OAuthToken) {
  if (!token.refresh_token) throw new Error(`La connexion ${provider} doit être renouvelée.`);

  const isGmail = provider === "gmail";
  const clientId = isGmail
    ? process.env.GOOGLE_CLIENT_ID || process.env.GMAIL_CLIENT_ID
    : process.env.MICROSOFT_CLIENT_ID || process.env.OUTLOOK_CLIENT_ID;
  const clientSecret = isGmail
    ? process.env.GOOGLE_CLIENT_SECRET || process.env.GMAIL_CLIENT_SECRET
    : process.env.MICROSOFT_CLIENT_SECRET || process.env.OUTLOOK_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error(`Configuration ${provider} incomplète.`);

  const response = await fetch(
    isGmail
      ? "https://oauth2.googleapis.com/token"
      : "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: token.refresh_token,
        grant_type: "refresh_token",
        ...(!isGmail ? { scope: "offline_access User.Read Mail.Read" } : {}),
      }),
    },
  );
  if (!response.ok) throw new Error(`Impossible de renouveler la connexion ${provider}.`);

  const refreshed = await response.json() as OAuthToken;
  return {
    ...token,
    ...refreshed,
    refresh_token: refreshed.refresh_token || token.refresh_token,
    stored_at: Date.now(),
    expires_at: Date.now() + Number(refreshed.expires_in ?? 3600) * 1000,
  };
}

async function usableToken(provider: EmailProvider, encoded: string) {
  let token = decodeTokenPayload<OAuthToken>(encoded);
  if (tokenExpired(token)) token = await refreshToken(provider, token);
  if (!token.access_token) throw new Error(`Jeton ${provider} invalide.`);
  return token;
}

function gmailHeader(headers: Array<{ name?: string; value?: string }> | undefined, name: string) {
  return headers?.find(header => header.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function gmailParts(parts: any[] | undefined): any[] {
  return (parts ?? []).flatMap(part => [part, ...gmailParts(part.parts)]);
}

async function fetchGmailAttachments(accessToken: string): Promise<{ messagesScanned: number; messagesFound: number; attachments: EmailAttachment[] }> {
  const receivedAfter = Math.floor((Date.now() - EMAIL_LOOKBACK_MS) / 1000);
  const messages: Array<{ id: string }> = [];
  let pageToken: string | undefined;
  do {
    const listUrl = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
    listUrl.searchParams.set("maxResults", String(EMAIL_PAGE_SIZE));
    listUrl.searchParams.set("q", `has:attachment after:${receivedAfter}`);
    if (pageToken) listUrl.searchParams.set("pageToken", pageToken);

    const listResponse = await fetch(listUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!listResponse.ok) throw new Error("Impossible de lire les emails Gmail.");
    const page = await listResponse.json() as {
      messages?: Array<{ id: string }>;
      nextPageToken?: string;
    };
    messages.push(...(page.messages ?? []));
    pageToken = page.nextPageToken;
  } while (pageToken);

  const attachments: EmailAttachment[] = [];
  let messagesFound = 0;
  for (const item of messages) {
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(item.id)}?format=full`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!response.ok) continue;
    const message = await response.json() as any;
    const subject = gmailHeader(message.payload?.headers, "Subject");
    const sender = gmailHeader(message.payload?.headers, "From");
    const receivedAt = message.internalDate ? new Date(Number(message.internalDate)).toISOString() : null;
    const candidates = gmailParts(message.payload?.parts).filter(part =>
      part.filename && part.body?.attachmentId && isSupportedAttachment(part.filename, part.mimeType ?? ""),
    );
    if (candidates.length) messagesFound++;

    for (const part of candidates) {
      const attachmentResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(item.id)}/attachments/${encodeURIComponent(part.body.attachmentId)}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!attachmentResponse.ok) continue;
      const attachment = await attachmentResponse.json() as { data?: string; size?: number };
      if (!attachment.data || Number(attachment.size ?? 0) > MAX_FILE_SIZE) continue;
      attachments.push({
        provider: "gmail",
        messageId: item.id,
        attachmentId: part.body.attachmentId,
        fileName: part.filename,
        mimeType: normalizedMimeType(part.filename, part.mimeType ?? ""),
        subject,
        sender,
        receivedAt,
        content: Buffer.from(attachment.data.replace(/-/g, "+").replace(/_/g, "/"), "base64"),
      });
    }
  }
  return { messagesScanned: messages.length, messagesFound, attachments };
}

async function fetchOutlookAttachments(accessToken: string): Promise<{ messagesScanned: number; messagesFound: number; attachments: EmailAttachment[] }> {
  const receivedAfter = new Date(Date.now() - EMAIL_LOOKBACK_MS).toISOString();
  const messages: any[] = [];
  let nextUrl: string | undefined;
  const firstUrl = new URL("https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages");
  firstUrl.searchParams.set("$top", String(EMAIL_PAGE_SIZE));
  firstUrl.searchParams.set("$filter", `receivedDateTime ge ${receivedAfter}`);
  firstUrl.searchParams.set("$orderby", "receivedDateTime desc");
  firstUrl.searchParams.set("$select", "id,subject,from,receivedDateTime,hasAttachments");
  nextUrl = firstUrl.toString();

  while (nextUrl) {
    const response = await fetch(nextUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok) throw new Error("Impossible de lire les emails Outlook.");
    const page = await response.json() as { value?: any[]; "@odata.nextLink"?: string };
    messages.push(...(page.value ?? []));
    nextUrl = page["@odata.nextLink"];
  }

  const attachments: EmailAttachment[] = [];
  let messagesFound = 0;
  for (const message of messages) {
    if (!message.hasAttachments) continue;
    const attachmentResponse = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(message.id)}/attachments?$select=id,name,contentType,size,contentBytes,isInline`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!attachmentResponse.ok) continue;
    const attachmentList = await attachmentResponse.json() as { value?: any[] };
    const candidates = (attachmentList.value ?? []).filter(attachment =>
      !attachment.isInline
      && attachment.contentBytes
      && Number(attachment.size ?? 0) <= MAX_FILE_SIZE
      && isSupportedAttachment(attachment.name ?? "", attachment.contentType ?? ""),
    );
    if (candidates.length) messagesFound++;

    for (const attachment of candidates) {
      attachments.push({
        provider: "outlook",
        messageId: message.id,
        attachmentId: attachment.id,
        fileName: attachment.name,
        mimeType: normalizedMimeType(attachment.name ?? "", attachment.contentType ?? ""),
        subject: message.subject ?? "",
        sender: message.from?.emailAddress?.address ?? "",
        receivedAt: message.receivedDateTime ?? null,
        content: Buffer.from(attachment.contentBytes, "base64"),
      });
    }
  }
  return { messagesScanned: messages.length, messagesFound, attachments };
}

export async function syncCompanyEmail(
  provider: EmailProvider,
  companyId: string,
  mode: EmailImportMode = "accounting_documents",
): Promise<EmailSyncResult> {
  const admin = createAdminClient();
  const tokenColumn = provider === "gmail" ? "gmail_token_encrypted" : "outlook_token_encrypted";
  const lastSyncColumn = provider === "gmail" ? "gmail_last_sync" : "outlook_last_sync";
  const importCountColumn = provider === "gmail" ? "gmail_import_count" : "outlook_import_count";
  const { data: company, error: companyError } = await admin
    .from("companies")
    .select(`id, user_id, ${tokenColumn}, ${importCountColumn}`)
    .eq("id", companyId)
    .maybeSingle();
  if (companyError || !company) throw new Error("Entreprise introuvable.");

  const encoded = company[tokenColumn] as string | null;
  if (!encoded) throw new Error(`${provider === "gmail" ? "Gmail" : "Outlook"} n'est pas connecté.`);
  const token = await usableToken(provider, encoded);
  const fetched = provider === "gmail"
    ? await fetchGmailAttachments(token.access_token!)
    : await fetchOutlookAttachments(token.access_token!);
  const usage = await getMonthlyUsage(companyId);
  if (!usage.allowed) {
    throw new Error(
      usage.isTrial
        ? "La limite de documents de votre essai est atteinte."
        : "La limite mensuelle d'import de documents est atteinte.",
    );
  }
  const importLimit = usage.remaining < 0
    ? fetched.attachments.length
    : Math.min(fetched.attachments.length, usage.remaining);

  let imported = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];
  for (const attachment of fetched.attachments) {
    if (imported >= importLimit) break;
    const dedupeId = `${companyId}:${provider}:${attachment.messageId}:${attachment.attachmentId}`;
    const { data: existingByKey, error: keyDedupeError } = await admin
      .from("receipts")
      .select("id")
      .eq("email_message_id", dedupeId)
      .maybeSingle();
    const { data: existingLegacy, error: legacyDedupeError } = existingByKey
      ? { data: null, error: null }
      : await admin
        .from("receipts")
        .select("id")
        .contains("ocr_data", { email_import_id: dedupeId })
        .maybeSingle();
    const dedupeError = keyDedupeError ?? legacyDedupeError;
    if (dedupeError) {
      errors.push(`Vérification doublon: ${dedupeError.message}`);
    }
    if (existingByKey || existingLegacy) {
      skipped++;
      continue;
    }

    let ocrData: Record<string, unknown> = {};
    try {
      ocrData = await extractWithFallback(attachment.content, attachment.mimeType);
      if (typeof ocrData.amount === "number") ocrData.type = ocrData.amount >= 0 ? "income" : "expense";
    } catch {
      // Filename/subject classification below can still identify an invoice.
    }
    if (!shouldImportEmailDocument(ocrData, mode, {
      fileName: attachment.fileName,
      subject: attachment.subject,
    })) {
      skipped++;
      continue;
    }

    const extension = attachment.fileName.split(".").pop()?.toLowerCase() || (attachment.mimeType === "application/pdf" ? "pdf" : "jpg");
    const storagePath = `${company.user_id}/email/${provider}-${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await admin.storage
      .from("receipts")
      .upload(storagePath, attachment.content, { contentType: attachment.mimeType, upsert: false });
    if (uploadError) {
      failed++;
      errors.push(`Stockage ${attachment.fileName}: ${uploadError.message}`);
      continue;
    }

    Object.assign(ocrData, {
      email_import_id: dedupeId,
      email_provider: provider,
      email_from: attachment.sender,
      email_subject: attachment.subject,
      email_received_at: attachment.receivedAt,
    });

    const { error: insertError } = await admin.from("receipts").insert({
      user_id: company.user_id,
      storage_path: storagePath,
      file_name: attachment.fileName,
      mime_type: attachment.mimeType,
      status: "pending",
      email_message_id: dedupeId,
      ocr_data: ocrData,
    });
    if (insertError) {
      await admin.storage.from("receipts").remove([storagePath]);
      if (insertError.code === "23505") skipped++;
      else {
        failed++;
        errors.push(`Enregistrement ${attachment.fileName}: ${insertError.message}`);
      }
      continue;
    }
    imported++;
    await incrementUploadCount(companyId, company.user_id, {
      fileName: attachment.fileName,
      fileType: attachment.mimeType,
      source: `email_${provider}`,
    });
  }

  await admin.from("companies").update({
    [tokenColumn]: encodeTokenPayload(token),
    [lastSyncColumn]: new Date().toISOString(),
    [importCountColumn]: Number(company[importCountColumn] ?? 0) + imported,
  }).eq("id", companyId);

  return {
    messagesScanned: fetched.messagesScanned,
    messagesFound: fetched.messagesFound,
    attachmentsFound: fetched.attachments.length,
    imported,
    skipped,
    failed,
    errors: [...new Set(errors)].slice(0, 3),
  };
}

export async function syncDossierEmail(
  provider: EmailProvider,
  dossierId: string,
  mode: EmailImportMode = "accounting_documents",
): Promise<EmailSyncResult> {
  const admin = createAdminClient();
  const tokenColumn = provider === "gmail" ? "gmail_token_encrypted" : "outlook_token_encrypted";
  const lastSyncColumn = provider === "gmail" ? "gmail_last_sync" : "outlook_last_sync";
  const importCountColumn = provider === "gmail" ? "gmail_import_count" : "outlook_import_count";
  const { data: dossier, error: dossierError } = await admin
    .from("dossiers")
    .select(`id, fiduciaire_user_id, ${tokenColumn}, ${importCountColumn}`)
    .eq("id", dossierId)
    .maybeSingle();
  if (dossierError || !dossier) throw new Error("Dossier introuvable.");

  const encoded = dossier[tokenColumn] as string | null;
  if (!encoded) throw new Error(`${provider === "gmail" ? "Gmail" : "Outlook"} n'est pas connecté.`);
  const token = await usableToken(provider, encoded);
  const fetched = provider === "gmail"
    ? await fetchGmailAttachments(token.access_token!)
    : await fetchOutlookAttachments(token.access_token!);

  const { data: company } = await admin
    .from("companies")
    .select("id")
    .eq("user_id", dossier.fiduciaire_user_id)
    .maybeSingle();
  const usage = company
    ? await getMonthlyUsage(company.id)
    : { allowed: true, used: 0, limit: -1, remaining: -1, resetDate: "", isTrial: false };
  if (!usage.allowed) {
    throw new Error(
      usage.isTrial
        ? "La limite de documents de votre essai est atteinte."
        : "La limite mensuelle d'import de documents est atteinte.",
    );
  }
  const importLimit = usage.remaining < 0
    ? fetched.attachments.length
    : Math.min(fetched.attachments.length, usage.remaining);

  let imported = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];
  for (const attachment of fetched.attachments) {
    if (imported >= importLimit) break;
    const dedupeId = `${dossierId}:${provider}:${attachment.messageId}:${attachment.attachmentId}`;
    const { data: existingByKey, error: keyDedupeError } = await admin
      .from("receipts")
      .select("id")
      .eq("email_message_id", dedupeId)
      .maybeSingle();
    const { data: existingLegacy, error: legacyDedupeError } = existingByKey
      ? { data: null, error: null }
      : await admin
        .from("receipts")
        .select("id")
        .contains("ocr_data", { email_import_id: dedupeId })
        .maybeSingle();
    const dedupeError = keyDedupeError ?? legacyDedupeError;
    if (dedupeError) {
      errors.push(`Vérification doublon: ${dedupeError.message}`);
    }
    if (existingByKey || existingLegacy) {
      skipped++;
      continue;
    }

    let ocrData: Record<string, unknown> = {};
    try {
      ocrData = await extractWithFallback(attachment.content, attachment.mimeType);
      if (typeof ocrData.amount === "number") ocrData.type = ocrData.amount >= 0 ? "income" : "expense";
    } catch {
      // Filename/subject classification below can still identify an invoice.
    }
    if (!shouldImportEmailDocument(ocrData, mode, {
      fileName: attachment.fileName,
      subject: attachment.subject,
    })) {
      skipped++;
      continue;
    }

    const extension = attachment.fileName.split(".").pop()?.toLowerCase() || (attachment.mimeType === "application/pdf" ? "pdf" : "jpg");
    const storagePath = `${dossier.fiduciaire_user_id}/email/${provider}-${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await admin.storage
      .from("receipts")
      .upload(storagePath, attachment.content, { contentType: attachment.mimeType, upsert: false });
    if (uploadError) {
      failed++;
      errors.push(`Stockage ${attachment.fileName}: ${uploadError.message}`);
      continue;
    }

    Object.assign(ocrData, {
      email_import_id: dedupeId,
      email_provider: provider,
      email_from: attachment.sender,
      email_subject: attachment.subject,
      email_received_at: attachment.receivedAt,
    });

    const { error: insertError } = await admin.from("receipts").insert({
      user_id: dossier.fiduciaire_user_id,
      dossier_id: dossierId,
      storage_path: storagePath,
      file_name: attachment.fileName,
      mime_type: attachment.mimeType,
      status: "pending",
      email_message_id: dedupeId,
      ocr_data: ocrData,
    });
    if (insertError) {
      await admin.storage.from("receipts").remove([storagePath]);
      if (insertError.code === "23505") skipped++;
      else {
        failed++;
        errors.push(`Enregistrement ${attachment.fileName}: ${insertError.message}`);
      }
      continue;
    }
    imported++;
    if (company) {
      await incrementUploadCount(company.id, dossier.fiduciaire_user_id, {
        fileName: attachment.fileName,
        fileType: attachment.mimeType,
        source: `email_${provider}`,
      });
    }
  }

  await admin.from("dossiers").update({
    [tokenColumn]: encodeTokenPayload(token),
    [lastSyncColumn]: new Date().toISOString(),
    [importCountColumn]: Number(dossier[importCountColumn] ?? 0) + imported,
  }).eq("id", dossierId);

  return {
    messagesScanned: fetched.messagesScanned,
    messagesFound: fetched.messagesFound,
    attachmentsFound: fetched.attachments.length,
    imported,
    skipped,
    failed,
    errors: [...new Set(errors)].slice(0, 3),
  };
}
