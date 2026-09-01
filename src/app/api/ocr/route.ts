import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMonthlyUsage, incrementUploadCount } from "@/lib/usage";
import { extractWithFallback } from "@/lib/ocr-engine";
import { authorizePermission } from "@/lib/api-permissions";
import { resolveAccountOwnerId } from "@/lib/account-owner";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const permission = await authorizePermission("document", "create");
  if (permission.response) return permission.response;
  const ownerId = await resolveAccountOwnerId(user.id);

  const { data: company } = await supabase.from("companies").select("id").eq("user_id", ownerId).single();
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

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  const dossierId = formData.get("dossier_id") as string | null;
  const requestedArea = formData.get("document_area");
  const documentArea = requestedArea === "supporting_document" ? "supporting_document" : "purchase";
  if (dossierId) {
    const { data: ownedDossier } = await supabase
      .from("dossiers")
      .select("id")
      .eq("id", dossierId)
      .eq("fiduciaire_user_id", ownerId)
      .maybeSingle();
    if (!ownedDossier) {
      return NextResponse.json({ error: "Dossier introuvable" }, { status: 404 });
    }
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: "Type de fichier non supporté. Utilisez JPG, PNG, WebP ou PDF." }, { status: 400 });
  }

  const MAX_SIZE = 10 * 1024 * 1024; // 10MB
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Fichier trop volumineux (max 10 MB)." }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // Upload to Supabase Storage
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const storagePath = `${ownerId}/${dossierId ? `${dossierId}/` : ""}${Date.now()}-${crypto.randomUUID()}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from("receipts")
    .upload(storagePath, bytes, { contentType: file.type, upsert: false });

  if (uploadErr) {
    return NextResponse.json({ error: "Impossible de stocker le fichier." }, { status: 502 });
  }

  // OCR with fallback chain
  let ocrData: Record<string, unknown> = {};
  try {
    ocrData = await extractWithFallback(buffer, file.type);
    if (typeof ocrData.amount === "number") {
      ocrData.type = ocrData.amount >= 0 ? "income" : "expense";
    }
  } catch {
    // OCR failed — user fills manually
  }

  const { data: receipt, error: dbErr } = await supabase
    .from("receipts")
    .insert({
      user_id: ownerId,
      ...(dossierId ? { dossier_id: dossierId } : {}),
      storage_path: storagePath,
      file_name: file.name,
      mime_type: file.type,
      status: "pending",
      document_area: documentArea,
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
      fileName: file.name, fileType: file.type, source: "inbox",
    });
  }

  return NextResponse.json({ receipt, ocr: ocrData });
}
