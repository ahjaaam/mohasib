import type { SupabaseClient } from "@supabase/supabase-js";
import { decrypt } from "./crypto";
import { processEmailAttachment } from "./ocr-pipeline";

const INVOICE_KEYWORDS = ["facture", "invoice", "reçu", "recu", "receipt", "reçu de paiement"];
const MAX_ATTACHMENTS_PER_SYNC = 20;

// ── Token helpers ──────────────────────────────────────────────────────────────

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

  // Build search query
  const labelFilter = labelId ? ` -label:${labelId}` : "";
  const keywordFilter = INVOICE_KEYWORDS.map(k => `"${k}"`).join(" OR ");
  const query = `has:attachment (${keywordFilter})${labelFilter}`;

  // List matching messages (max 20)
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${MAX_ATTACHMENTS_PER_SYNC}`,
    { headers: { Authorization: authHeader } },
  );
  if (!listRes.ok) throw new Error(`Gmail list failed: ${listRes.status}`);
  const listJson = await listRes.json();
  const messages: { id: string }[] = listJson.messages ?? [];

  let imported = 0;

  for (const msg of messages) {
    try {
      // Get full message (metadata + attachment info)
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
        { headers: { Authorization: authHeader } },
      );
      if (!msgRes.ok) continue;
      const msgJson = await msgRes.json();

      // Find PDF/image attachments in parts
      const parts: any[] = msgJson.payload?.parts ?? [];
      const attachmentParts = parts.filter(
        (p: any) =>
          p.body?.attachmentId &&
          (p.mimeType === "application/pdf" ||
            p.mimeType?.startsWith("image/")),
      );

      for (const part of attachmentParts) {
        const attRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}/attachments/${part.body.attachmentId}`,
          { headers: { Authorization: authHeader } },
        );
        if (!attRes.ok) continue;
        const attJson = await attRes.json();

        // Gmail uses URL-safe base64
        const base64 = (attJson.data as string).replace(/-/g, "+").replace(/_/g, "/");
        const bytes = Buffer.from(base64, "base64");
        const fileName = part.filename || `email-attachment.${part.mimeType === "application/pdf" ? "pdf" : "jpg"}`;

        const result = await processEmailAttachment(supabase, userId, bytes, part.mimeType, fileName);
        if (result) imported++;
      }

      // Apply "Mohasib - Traité" label
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

  // Update sync timestamp + import count
  await supabase
    .from("companies")
    .update({
      gmail_last_sync: new Date().toISOString(),
      gmail_import_count: supabase.rpc ? undefined : undefined, // handled below
    })
    .eq("id", companyId);

  if (imported > 0) {
    await supabase.rpc("increment_gmail_import_count", { company_id: companyId, amount: imported }).catch(() => {
      // RPC may not exist; best-effort
    });
  }

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

  // Search for messages with attachments containing invoice keywords
  const search = INVOICE_KEYWORDS.join(" OR ");
  const url = `https://graph.microsoft.com/v1.0/me/messages?$search="${encodeURIComponent(search)}"&$top=${MAX_ATTACHMENTS_PER_SYNC}&$select=id,subject,hasAttachments&$filter=hasAttachments eq true`;

  const listRes = await fetch(url, { headers: { Authorization: authHeader } });
  if (!listRes.ok) {
    // $search + $filter not always supported; fall back without filter
    const fallback = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages?$search="${encodeURIComponent(search)}"&$top=${MAX_ATTACHMENTS_PER_SYNC}&$select=id,subject,hasAttachments`,
      { headers: { Authorization: authHeader } },
    );
    if (!fallback.ok) throw new Error(`Outlook search failed: ${fallback.status}`);
    const json = await fallback.json();
    return processOutlookMessages(supabase, userId, companyId, json.value ?? [], authHeader);
  }

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
        const mime: string = att.contentType ?? "";
        if (att["@odata.type"] !== "#microsoft.graph.fileAttachment") continue;
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

  await supabase
    .from("companies")
    .update({ outlook_last_sync: new Date().toISOString() })
    .eq("id", companyId);

  if (imported > 0) {
    await supabase.rpc("increment_outlook_import_count", { company_id: companyId, amount: imported }).catch(() => {});
  }

  return imported;
}
