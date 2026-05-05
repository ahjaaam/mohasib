import type { SupabaseClient } from "@supabase/supabase-js";
import { decrypt } from "./crypto";
import { processEmailAttachment } from "./ocr-pipeline";

const INVOICE_KEYWORDS = ["facture", "invoice", "reçu", "recu", "receipt", "reçu de paiement"];
const MAX_MESSAGES_PER_SYNC = 20;

// ── Token helpers ─────────────────────────────────────────────────────────────

async function refreshGoogleToken(encryptedRefreshToken: string): Promise<string> {
  const refreshToken = decrypt(encryptedRefreshToken);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed: ${res.status}`);
  const json = await res.json();
  if (!json.access_token) throw new Error("No access_token in Google refresh response");
  return json.access_token as string;
}

async function refreshMicrosoftToken(encryptedRefreshToken: string): Promise<string> {
  const refreshToken = decrypt(encryptedRefreshToken);
  const res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
      scope: "Mail.Read offline_access",
    }),
  });
  if (!res.ok) throw new Error(`Microsoft token refresh failed: ${res.status}`);
  const json = await res.json();
  return json.access_token as string;
}

// ── Gmail part helpers ────────────────────────────────────────────────────────

// Recursively walks Gmail message parts to find all PDF/image attachments,
// handling nested multipart/mixed and multipart/alternative structures.
function collectAttachmentParts(part: any): any[] {
  if (!part) return [];
  const results: any[] = [];

  if (
    part.body?.attachmentId &&
    part.filename &&
    (part.mimeType === "application/pdf" || part.mimeType?.startsWith("image/"))
  ) {
    results.push(part);
  }

  for (const child of part.parts ?? []) {
    results.push(...collectAttachmentParts(child));
  }

  return results;
}

// ── Gmail sync ────────────────────────────────────────────────────────────────

export async function syncGmail(
  supabase: SupabaseClient,
  companyId: string,
  userId: string,
  encryptedToken: string,
  labelId: string | null,
): Promise<number> {
  const accessToken = await refreshGoogleToken(encryptedToken);
  const authHeader = `Bearer ${accessToken}`;

  // Build search query — exclude already-labelled emails
  const labelFilter = labelId ? ` -label:${labelId}` : "";
  const keywordFilter = INVOICE_KEYWORDS.map(k => `"${k}"`).join(" OR ");
  const query = `has:attachment (${keywordFilter})${labelFilter}`;

  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${MAX_MESSAGES_PER_SYNC}`,
    { headers: { Authorization: authHeader } },
  );
  if (!listRes.ok) throw new Error(`Gmail list failed: ${listRes.status}`);
  const listJson = await listRes.json();
  const messages: { id: string }[] = listJson.messages ?? [];

  let imported = 0;

  for (const msg of messages) {
    try {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
        { headers: { Authorization: authHeader } },
      );
      if (!msgRes.ok) continue;
      const msgJson = await msgRes.json();

      // Walk all nested parts recursively to find attachments
      const attachmentParts = collectAttachmentParts(msgJson.payload);

      for (const part of attachmentParts) {
        const attRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}/attachments/${part.body.attachmentId}`,
          { headers: { Authorization: authHeader } },
        );
        if (!attRes.ok) continue;
        const attJson = await attRes.json();

        // Gmail encodes attachment data with URL-safe base64
        const base64 = (attJson.data as string).replace(/-/g, "+").replace(/_/g, "/");
        const bytes = Buffer.from(base64, "base64");
        const fileName = part.filename || `attachment.${part.mimeType === "application/pdf" ? "pdf" : "jpg"}`;

        const result = await processEmailAttachment(supabase, userId, bytes, part.mimeType, fileName);
        if (result) imported++;
      }

      // Mark email as processed
      if (labelId) {
        await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}/modify`, {
          method: "POST",
          headers: { Authorization: authHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ addLabelIds: [labelId] }),
        });
      }
    } catch {
      // Skip failed messages; continue sync
    }
  }

  // Update last sync timestamp and import count
  const { data: current } = await supabase
    .from("companies")
    .select("gmail_import_count")
    .eq("id", companyId)
    .single();

  await supabase
    .from("companies")
    .update({
      gmail_last_sync: new Date().toISOString(),
      gmail_import_count: (current?.gmail_import_count ?? 0) + imported,
    })
    .eq("id", companyId);

  return imported;
}

// ── Outlook sync ──────────────────────────────────────────────────────────────

export async function syncOutlook(
  supabase: SupabaseClient,
  companyId: string,
  userId: string,
  encryptedToken: string,
): Promise<number> {
  const accessToken = await refreshMicrosoftToken(encryptedToken);
  const authHeader = `Bearer ${accessToken}`;

  // $search and $filter cannot be combined in Graph API — search first, filter client-side
  const search = INVOICE_KEYWORDS.join(" OR ");
  const url = `https://graph.microsoft.com/v1.0/me/messages?$search="${encodeURIComponent(search)}"&$top=${MAX_MESSAGES_PER_SYNC}&$select=id,subject,hasAttachments`;

  const listRes = await fetch(url, { headers: { Authorization: authHeader } });
  if (!listRes.ok) throw new Error(`Outlook search failed: ${listRes.status}`);
  const listJson = await listRes.json();

  return processOutlookMessages(supabase, userId, companyId, listJson.value ?? [], authHeader);
}

async function processOutlookMessages(
  supabase: SupabaseClient,
  userId: string,
  companyId: string,
  messages: any[],
  authHeader: string,
): Promise<number> {
  let imported = 0;

  for (const msg of messages) {
    if (!msg.hasAttachments) continue;
    try {
      const attRes = await fetch(
        `https://graph.microsoft.com/v1.0/me/messages/${msg.id}/attachments`,
        { headers: { Authorization: authHeader } },
      );
      if (!attRes.ok) continue;
      const attJson = await attRes.json();

      for (const att of attJson.value ?? []) {
        if (att["@odata.type"] !== "#microsoft.graph.fileAttachment") continue;
        const mime: string = att.contentType ?? "";
        if (mime !== "application/pdf" && !mime.startsWith("image/")) continue;

        const bytes = Buffer.from(att.contentBytes as string, "base64");
        const fileName = att.name || "attachment.pdf";
        const result = await processEmailAttachment(supabase, userId, bytes, mime, fileName);
        if (result) imported++;
      }
    } catch {
      // Skip failed messages
    }
  }

  const { data: current } = await supabase
    .from("companies")
    .select("outlook_import_count")
    .eq("id", companyId)
    .single();

  await supabase
    .from("companies")
    .update({
      outlook_last_sync: new Date().toISOString(),
      outlook_import_count: (current?.outlook_import_count ?? 0) + imported,
    })
    .eq("id", companyId);

  return imported;
}
