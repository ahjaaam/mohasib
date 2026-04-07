import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

const OCR_PROMPT = `Tu es un assistant spécialisé dans l'extraction de données de reçus et factures marocains.
Extrait les informations suivantes de cette image et retourne UNIQUEMENT du JSON valide (sans markdown, sans explication):
{
  "date": "YYYY-MM-DD ou null",
  "amount": nombre ou null (montant total),
  "currency": "MAD",
  "vendor": "nom du vendeur/fournisseur ou null",
  "description": "description courte de l'achat",
  "category": "une seule valeur parmi: Achats, Loyer, Transport, Fournitures, Communication, Fiscalité, Salaires, Services, Ventes, Remboursement, Autre dépense, Autre revenu",
  "type": "income ou expense",
  "tax_amount": montant TVA ou null
}`;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: "Type de fichier non supporté. Utilisez JPG, PNG ou WebP." }, { status: 400 });
  }

  // Convert to base64 for Claude Vision
  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");
  const mimeType = file.type as "image/jpeg" | "image/png" | "image/gif" | "image/webp";

  // Upload to Supabase Storage
  const ext = file.name.split(".").pop() ?? "jpg";
  const storagePath = `${user.id}/${Date.now()}.${ext}`;
  let finalStoragePath: string | null = null;

  const { error: uploadErr } = await supabase.storage
    .from("receipts")
    .upload(storagePath, bytes, { contentType: file.type, upsert: false });

  if (!uploadErr) {
    finalStoragePath = storagePath;
  }
  // If upload fails (e.g. bucket not created yet), we still proceed with OCR

  // Claude Vision OCR
  let ocrData: Record<string, unknown> = {};
  try {
    const message = await anthropic.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 512,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mimeType, data: base64 },
          },
          { type: "text", text: OCR_PROMPT },
        ],
      }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text.trim() : "";
    // Strip markdown fences if present
    const cleaned = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    ocrData = JSON.parse(cleaned);
  } catch {
    // OCR parsing failed — return empty data, user fills manually
  }

  // Insert receipt record
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
