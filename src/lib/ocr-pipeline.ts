import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";

const anthropic = new Anthropic();

const OCR_PROMPT = `You are a Moroccan receipt/invoice parser. Extract data from this document.

Return ONLY a valid JSON object — no markdown, no explanation:
{
  "vendor_name": "exact vendor name from document",
  "date": "YYYY-MM-DD or null",
  "amount": -32.96,
  "currency": "MAD",
  "category": "one of: Achats|Salaires|Loyer|Fournitures|Transport|Communication|Fiscalité|Autre dépense|Ventes|Services|Remboursement|Autre revenu",
  "tva_amount": 5.49,
  "tva_rate": 20,
  "description": "brief description in French",
  "payment_method": "cash|card|virement|cheque or null",
  "receipt_number": "reference number or null",
  "confidence": 0.95,
  "compte": "6132"
}

Rules:
- amount: negative number for expenses/purchases, positive for income/sales
- tva_rate: only 7, 10, 14, or 20 — use null if not visible
- confidence: 1.0 = very clear receipt, 0.5 = partially readable, 0.1 = very hard to read
- compte: Moroccan CGNC account code. Expenses → 6xxx, Revenue/Sales → 7xxx
- Always use null for fields that cannot be determined
- Respond with JSON only`;

export async function processEmailAttachment(
  supabase: SupabaseClient,
  userId: string,
  bytes: Buffer,
  mimeType: string,
  fileName: string,
): Promise<{ receiptId: string; ocrData: Record<string, unknown> } | null> {
  const base64 = bytes.toString("base64");

  // Upload to storage
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "pdf";
  const storagePath = `${userId}/email-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  let finalStoragePath: string | null = null;

  const { error: uploadErr } = await supabase.storage
    .from("receipts")
    .upload(storagePath, bytes, { contentType: mimeType, upsert: false });
  if (!uploadErr) finalStoragePath = storagePath;

  // Run OCR
  let ocrData: Record<string, unknown> = {};
  try {
    const isPdf = mimeType === "application/pdf";
    const fileBlock = isPdf
      ? { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: base64 } }
      : { type: "image" as const, source: { type: "base64" as const, media_type: mimeType as "image/jpeg" | "image/png" | "image/webp", data: base64 } };

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      messages: [{ role: "user", content: [fileBlock, { type: "text" as const, text: OCR_PROMPT }] }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text.trim() : "";
    const cleaned = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    ocrData = JSON.parse(cleaned);
    if (ocrData.vendor_name && !ocrData.vendor) ocrData.vendor = ocrData.vendor_name;
    if (typeof ocrData.amount === "number") {
      ocrData.type = ocrData.amount >= 0 ? "income" : "expense";
    }
  } catch {
    // OCR failed — user can fill manually
  }

  const { data: receipt, error: dbErr } = await supabase
    .from("receipts")
    .insert({
      user_id: userId,
      storage_path: finalStoragePath,
      file_name: fileName,
      mime_type: mimeType,
      status: "pending",
      ocr_data: ocrData,
    })
    .select("id")
    .single();

  if (dbErr || !receipt) return null;
  return { receiptId: receipt.id, ocrData };
}
