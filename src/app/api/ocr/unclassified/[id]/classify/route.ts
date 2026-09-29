import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { authorizePermission } from "@/lib/api-permissions";
import { resolveAccountOwnerId } from "@/lib/account-owner";
import { extractWithFallback } from "@/lib/ocr-engine";
import { OCR_SECTION_CONFIG, type OcrSection, validateOcrSection } from "@/lib/ocr-sections";
import { normalizeAccountingSettings } from "@/lib/accounting-settings";
import { normalizeDocumentType } from "@/lib/document-classification";

const TARGETS = new Set<OcrSection>(["purchases", "expense_notes"]);

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const target = body.target as OcrSection;
  if (!TARGETS.has(target)) {
    return NextResponse.json({ error: "Section de destination invalide." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ownerId = await resolveAccountOwnerId(user.id);
  const { data: receipt } = await supabase
    .from("receipts")
    .select("id,user_id,dossier_id,storage_path,file_name,mime_type,document_area,ocr_data")
    .eq("id", id)
    .eq("user_id", ownerId)
    .maybeSingle();
  if (!receipt || receipt.document_area !== "unclassified" || !receipt.storage_path) {
    return NextResponse.json({ error: "Document à classer introuvable." }, { status: 404 });
  }

  const permission = await authorizePermission("document", "create", { dossierId: receipt.dossier_id });
  if (permission.response) return permission.response;
  const { data: fileData, error: downloadError } = await supabase.storage.from("receipts").download(receipt.storage_path);
  if (downloadError || !fileData) {
    return NextResponse.json({ error: "Impossible de lire le document." }, { status: 502 });
  }

  let accountingSettings: unknown = null;
  if (receipt.dossier_id) {
    const { data } = await supabase.from("dossiers").select("accounting_settings").eq("id", receipt.dossier_id).maybeSingle();
    accountingSettings = data?.accounting_settings;
  } else {
    const { data } = await supabase.from("companies").select("accounting_settings").eq("user_id", ownerId).maybeSingle();
    accountingSettings = data?.accounting_settings;
  }

  const config = OCR_SECTION_CONFIG[target];
  const bytes = Buffer.from(await fileData.arrayBuffer());
  const ocrData = await extractWithFallback(
    bytes,
    receipt.mime_type || fileData.type || "application/pdf",
    config.documentKind,
    Object.keys(normalizeAccountingSettings(accountingSettings).expenseCategoryAccounts)
      .filter(category => category !== "__default"),
  );
  // Keep a receipt identified before quarantine as a receipt when a person routes it.
  // The destination expresses the user's decision; it does not turn a receipt into an invoice.
  const priorType = normalizeDocumentType(receipt.ocr_data?.document_type);
  const extractedType = normalizeDocumentType(ocrData.document_type);
  if (priorType === "receipt") {
    ocrData.document_type = "receipt";
  } else {
    ocrData.document_type = extractedType === "unknown" || extractedType === "other"
      ? target === "purchases" ? "invoice" : "receipt"
      : extractedType;
  }
  ocrData.is_supplier_invoice = target === "purchases";
  const mismatch = validateOcrSection(target, ocrData);
  if (mismatch) {
    return NextResponse.json({
      error: mismatch.message,
      code: mismatch.code,
      correct_section: mismatch.correctSection,
    }, { status: 422 });
  }
  Object.assign(ocrData, {
    ocr_section: target,
    classification_confidence: "high",
    classification_reason: "Section confirmée manuellement par l’utilisateur.",
    classification_source: "user",
  });

  const ext = receipt.file_name?.split(".").pop()?.toLowerCase() || "bin";
  const dossierFolder = receipt.dossier_id ? `${receipt.dossier_id}/` : "";
  const targetPath = `${ownerId}/${config.storageFolder}/${dossierFolder}${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const { error: moveError } = await supabase.storage.from("receipts").move(receipt.storage_path, targetPath);
  if (moveError) {
    return NextResponse.json({ error: "Impossible de déplacer le document vers sa section." }, { status: 502 });
  }

  const { data: updated, error: updateError } = await supabase
    .from("receipts")
    .update({
      storage_path: targetPath,
      document_area: config.documentArea,
      ocr_data: ocrData,
    })
    .eq("id", receipt.id)
    .eq("document_area", "unclassified")
    .select("id,document_area,ocr_data")
    .single();
  if (updateError) {
    await supabase.storage.from("receipts").move(targetPath, receipt.storage_path).catch(() => undefined);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }
  return NextResponse.json({ receipt: updated });
}
