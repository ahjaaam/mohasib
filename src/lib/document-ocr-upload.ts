import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMonthlyUsage, incrementUploadCount } from "@/lib/usage";
import { classifyDocumentBeforeOcr, extractWithFallback, isAmbiguousReceiptType } from "@/lib/ocr-engine";
import { authorizePermission } from "@/lib/api-permissions";
import { resolveAccountOwnerId } from "@/lib/account-owner";
import { normalizeAccountingSettings } from "@/lib/accounting-settings";
import { OCR_SECTION_CONFIG, type OcrSection, validateOcrSection } from "@/lib/ocr-sections";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"]);
const MAX_SIZE = 10 * 1024 * 1024;

export async function handleDocumentOcrUpload(req: NextRequest, section: OcrSection) {
  const config = OCR_SECTION_CONFIG[section];
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Aucun fichier fourni." }, { status: 400 });
  }
  const uploadFile = file;
  const dossierIdValue = formData.get("dossier_id");
  const dossierId = typeof dossierIdValue === "string" && dossierIdValue ? dossierIdValue : null;
  const isTopBarUpload = formData.get("upload_source") === "topbar";

  const permission = await authorizePermission("document", "create", { dossierId });
  if (permission.response) return permission.response;
  const ownerId = await resolveAccountOwnerId(user.id);

  const { data: company } = await supabase
    .from("companies")
    .select("id, accounting_settings")
    .eq("user_id", ownerId)
    .single();
  if (company) {
    const usage = await getMonthlyUsage(company.id);
    if (!usage.allowed) {
      return NextResponse.json({
        error: usage.isTrial ? "trial_limit_reached" : "limit_reached",
        feature: usage.isTrial ? "ocr_scans" : undefined,
        message: usage.isTrial
          ? `Vous avez atteint la limite de votre essai gratuit (${usage.limit} documents scannés). Passez à un plan payant pour continuer.`
          : `Limite mensuelle atteinte (${usage.used}/${usage.limit} documents). Réinitialisation le ${usage.resetDate}.`,
        used: usage.used,
        limit: usage.limit,
        resetDate: usage.resetDate,
      }, { status: usage.isTrial ? 403 : 429 });
    }
  }

  let workspaceAccountingSettings: unknown = company?.accounting_settings ?? null;
  if (dossierId) {
    const { data: ownedDossier } = await supabase
      .from("dossiers")
      .select("id, accounting_settings")
      .eq("id", dossierId)
      .eq("fiduciaire_user_id", ownerId)
      .maybeSingle();
    if (!ownedDossier) return NextResponse.json({ error: "Dossier introuvable" }, { status: 404 });
    workspaceAccountingSettings = ownedDossier.accounting_settings;
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Type de fichier non supporté. Utilisez JPG, PNG, WebP ou PDF." }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Fichier trop volumineux (max 10 MB)." }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const dossierFolder = dossierId ? `${dossierId}/` : "";
  let storagePath = `${ownerId}/unclassified/${dossierFolder}${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const { error: uploadErr } = await supabase.storage
    .from("receipts")
    .upload(storagePath, bytes, { contentType: file.type, upsert: false });
  if (uploadErr) return NextResponse.json({ error: "Impossible de stocker le fichier." }, { status: 502 });

  const classification = await classifyDocumentBeforeOcr(buffer, file.type);
  const effectiveClassification = isTopBarUpload
    && section === "expense_notes"
    && isAmbiguousReceiptType(classification.documentType)
    ? { ...classification, section: "expense_notes" as const }
    : classification;
  async function quarantineDocument(extractedData: Record<string, unknown>, reason: string | null) {
    const quarantineData = {
      ...extractedData,
      ocr_section: "unclassified",
      document_type: extractedData.document_type ?? effectiveClassification.documentType,
      classification_confidence: "low",
      classification_reason: reason,
      classification_source: "automatic",
      requested_section: section,
    };
    const { data: receipt, error: quarantineError } = await supabase
      .from("receipts")
      .insert({
        user_id: ownerId,
        ...(dossierId ? { dossier_id: dossierId } : {}),
        storage_path: storagePath,
        file_name: uploadFile.name,
        mime_type: uploadFile.type,
        status: "pending",
        document_area: "unclassified",
        ocr_data: quarantineData,
      })
      .select()
      .single();
    if (quarantineError) {
      await supabase.storage.from("receipts").remove([storagePath]).catch(() => undefined);
      return NextResponse.json({ error: quarantineError.message }, { status: 500 });
    }
    if (company) {
      await incrementUploadCount(company.id, user.id, {
        fileName: uploadFile.name,
        fileType: uploadFile.type,
        source: "unclassified_ocr",
      });
    }
    return NextResponse.json({
      receipt,
      quarantined: true,
      message: "Le document n’a pas pu être classé avec fiabilité. Il a été placé dans Documents à classer.",
    }, { status: 202 });
  }

  if (effectiveClassification.section === "unclassified") {
    return quarantineDocument({}, effectiveClassification.reason);
  }

  if (effectiveClassification.section !== section) {
    await supabase.storage.from("receipts").remove([storagePath]).catch(() => undefined);
    const messages = {
      bank_statements: "Ce document est un relevé bancaire. Importez-le depuis Transactions → Importer un relevé bancaire.",
      purchases: "Ce document est une pièce d’achat. Importez-le depuis Achats.",
      expense_notes: "Ce document est un justificatif de note de frais. Importez-le depuis Notes de frais.",
    } as const;
    return NextResponse.json({
      error: messages[effectiveClassification.section],
      code: "wrong_document_section",
      correct_section: effectiveClassification.section,
      detected_document_type: effectiveClassification.documentType,
    }, { status: 422 });
  }

  let ocrData: Record<string, unknown> = {};
  try {
    ocrData = await extractWithFallback(
      buffer,
      file.type,
      config.documentKind,
      Object.keys(normalizeAccountingSettings(workspaceAccountingSettings).expenseCategoryAccounts)
        .filter(category => category !== "__default"),
    );
    if (typeof ocrData.amount === "number") {
      ocrData.type = ocrData.amount >= 0 ? "income" : "expense";
    }
  } catch {
    // The independent classifier remains authoritative when field extraction fails.
  }
  ocrData.document_type ??= effectiveClassification.documentType;
  if (isAmbiguousReceiptType(ocrData.document_type) && !(isTopBarUpload && section === "expense_notes")) {
    return quarantineDocument(
      { ...ocrData, document_type: "receipt" },
      "Un reçu seul ne permet pas de distinguer un achat d’une note de frais.",
    );
  }
  ocrData.is_supplier_invoice ??= section === "purchases";
  ocrData.classification_confidence = effectiveClassification.confidence;
  ocrData.classification_reason = effectiveClassification.reason;
  ocrData.classification_source = "automatic";

  const mismatch = validateOcrSection(section, ocrData);
  if (mismatch) {
    if (mismatch.correctSection === "unclassified") {
      return quarantineDocument(
        ocrData,
        "Le type extrait n’est pas reconnu. Le document doit être classé manuellement.",
      );
    }
    await supabase.storage.from("receipts").remove([storagePath]).catch(() => undefined);
    return NextResponse.json({
      error: mismatch.message,
      code: mismatch.code,
      correct_section: mismatch.correctSection,
      detected_document_type: ocrData.document_type,
    }, { status: 422 });
  }
  ocrData.ocr_section = section;

  const targetStoragePath = `${ownerId}/${config.storageFolder}/${dossierFolder}${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const { error: moveError } = await supabase.storage.from("receipts").move(storagePath, targetStoragePath);
  if (moveError) {
    await supabase.storage.from("receipts").remove([storagePath]).catch(() => undefined);
    return NextResponse.json({ error: "Impossible de classer le fichier dans son espace documentaire." }, { status: 502 });
  }
  storagePath = targetStoragePath;

  const { data: receipt, error: dbErr } = await supabase
    .from("receipts")
    .insert({
      user_id: ownerId,
      ...(dossierId ? { dossier_id: dossierId } : {}),
      storage_path: storagePath,
      file_name: file.name,
      mime_type: file.type,
      status: "pending",
      document_area: config.documentArea,
      ocr_data: ocrData,
    })
    .select()
    .single();
  if (dbErr) {
    await supabase.storage.from("receipts").remove([storagePath]).catch(() => undefined);
    return NextResponse.json({ error: dbErr.message }, { status: 500 });
  }

  if (company) {
    await incrementUploadCount(company.id, user.id, {
      fileName: file.name,
      fileType: file.type,
      source: section === "purchases" ? "purchases_ocr" : "expense_notes_ocr",
    });
  }

  return NextResponse.json({ receipt, ocr: ocrData });
}
