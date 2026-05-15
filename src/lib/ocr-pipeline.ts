import type { SupabaseClient } from "@supabase/supabase-js";
import { extractWithFallback } from "./ocr-engine";

export async function processEmailAttachment(
  supabase: SupabaseClient,
  userId: string,
  bytes: Buffer,
  mimeType: string,
  fileName: string,
  emailMeta?: { from: string; subject: string; provider?: string },
  dossierId?: string,
  emailMessageId?: string,
): Promise<{ receiptId: string; ocrData: Record<string, unknown> } | null> {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "pdf";
  const storagePath = `${userId}/email-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  let finalStoragePath: string | null = null;

  const { error: uploadErr } = await supabase.storage
    .from("receipts")
    .upload(storagePath, bytes, { contentType: mimeType, upsert: false });
  if (!uploadErr) finalStoragePath = storagePath;

  let ocrData: Record<string, unknown> = {};
  try {
    ocrData = await extractWithFallback(bytes, mimeType);
    if (typeof ocrData.amount === "number") {
      ocrData.type = ocrData.amount >= 0 ? "income" : "expense";
    }
  } catch {
    // OCR failed — user can fill manually
  }

  if (emailMeta) {
    ocrData.email_from = emailMeta.from;
    ocrData.email_subject = emailMeta.subject;
    if (emailMeta.provider) ocrData.email_provider = emailMeta.provider;
  }

  const insertPayload: Record<string, unknown> = {
    user_id: userId,
    storage_path: finalStoragePath,
    file_name: fileName,
    mime_type: mimeType,
    status: "pending",
    ocr_data: ocrData,
  };

  if (dossierId) insertPayload.dossier_id = dossierId;
  if (emailMessageId) insertPayload.email_message_id = emailMessageId;

  const { data: receipt, error: dbErr } = await supabase
    .from("receipts")
    .insert(insertPayload)
    .select("id")
    .single();

  if (dbErr || !receipt) return null;
  return { receiptId: receipt.id, ocrData };
}
