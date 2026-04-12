import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

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
  "confidence": 0.95
}

Rules:
- amount: negative number for expenses/purchases, positive for income/sales
- tva_rate: only 7, 10, 14, or 20 — use null if not visible
- confidence: 1.0 = very clear receipt, 0.5 = partially readable, 0.1 = very hard to read
- Always use null for fields that cannot be determined
- Respond with JSON only`;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: "Type de fichier non supporté. Utilisez JPG, PNG, WebP ou PDF." }, { status: 400 });
  }

  const MAX_SIZE = 10 * 1024 * 1024; // 10MB
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Fichier trop volumineux (max 10 MB)." }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");

  // Upload to Supabase Storage
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const storagePath = `${user.id}/${Date.now()}.${ext}`;
  let finalStoragePath: string | null = null;

  const { error: uploadErr } = await supabase.storage
    .from("receipts")
    .upload(storagePath, bytes, { contentType: file.type, upsert: false });

  if (!uploadErr) finalStoragePath = storagePath;

  // Claude Vision / Document OCR
  let ocrData: Record<string, unknown> = {};
  try {
    const isPdf = file.type === "application/pdf";
    const fileBlock = isPdf
      ? { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: base64 } }
      : { type: "image" as const, source: { type: "base64" as const, media_type: file.type as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: base64 } };

    const message = await anthropic.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 600,
      messages: [{ role: "user", content: [fileBlock, { type: "text" as const, text: OCR_PROMPT }] }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text.trim() : "";
    const cleaned = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    ocrData = JSON.parse(cleaned);

    // Normalise: keep both vendor and vendor_name, derive type from amount sign
    if (ocrData.vendor_name && !ocrData.vendor) ocrData.vendor = ocrData.vendor_name;
    if (typeof ocrData.amount === "number") {
      ocrData.type = ocrData.amount >= 0 ? "income" : "expense";
    }
  } catch {
    // OCR failed — user fills manually
  }

  const { data: receipt, error: dbErr } = await supabase
    .from("receipts")
    .insert({
      user_id: user.id,
      storage_path: finalStoragePath,
      file_name: file.name,
      mime_type: file.type,
      status: "pending",
      ocr_data: ocrData,
    })
    .select()
    .single();

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

  return NextResponse.json({ receipt, ocr: ocrData });
}
