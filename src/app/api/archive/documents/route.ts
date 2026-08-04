import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizePermission } from "@/lib/api-permissions";
import { resolveAccountOwnerId } from "@/lib/account-owner";
import { driveClientForConnection, uploadDriveFile } from "@/lib/google-drive";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const ALLOWED_EXTENSIONS = new Set(["pdf", "jpg", "jpeg", "png", "webp", "csv", "xls", "xlsx", "docx"]);

function isAllowedFile(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return ALLOWED_TYPES.has(file.type) || ALLOWED_EXTENSIONS.has(extension);
}

function textValue(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Sélectionnez un document." }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "Le document dépasse la limite de 20 Mo." }, { status: 413 });
  }
  if (!isAllowedFile(file)) {
    return NextResponse.json(
      { error: "Format non accepté. Utilisez PDF, CSV, Excel, JPG, PNG, WEBP ou DOCX." },
      { status: 415 },
    );
  }

  const dossierId = textValue(form, "dossierId") || null;
  const archiveId = textValue(form, "archiveId") || null;
  const category = textValue(form, "category") || "Autre";
  const customName = textValue(form, "customName");
  const expiry = textValue(form, "expiry") || null;
  const notes = textValue(form, "notes") || null;
  const name = category === "Autre" && customName ? customName : `${category} — ${file.name}`;

  const permission = await authorizePermission("document", "create", { dossierId });
  if (permission.response || !permission.user) return permission.response;
  const ownerId = await resolveAccountOwnerId(permission.user.id);
  const admin = createAdminClient();

  let storagePath: string | null = null;
  let externalFileId: string | null = null;
  let externalWebUrl: string | null = null;
  let storageProvider: "supabase" | "google_drive" = "supabase";
  let drive: Awaited<ReturnType<typeof driveClientForConnection>> | null = null;

  try {
    if (archiveId) {
      const { data: archive } = await admin
        .from("document_archives")
        .select("id,dossier_id,drive_folder_id,google_drive_connections!inner(id,token_encrypted)")
        .eq("id", archiveId)
        .eq("user_id", ownerId)
        .maybeSingle();
      if (!archive || (archive.dossier_id ?? null) !== dossierId) {
        return NextResponse.json({ error: "Archive inaccessible." }, { status: 404 });
      }

      const relation = Array.isArray(archive.google_drive_connections)
        ? archive.google_drive_connections[0]
        : archive.google_drive_connections;
      if (!relation) return NextResponse.json({ error: "Connexion Google Drive absente." }, { status: 409 });
      drive = await driveClientForConnection(request, relation);
      const uploaded = await uploadDriveFile(drive, archive.drive_folder_id, file);
      externalFileId = uploaded.id ?? null;
      externalWebUrl = uploaded.webViewLink ?? uploaded.webContentLink ?? null;
      storageProvider = "google_drive";
    } else {
      const extension = file.name.includes(".") ? `.${file.name.split(".").pop()}` : "";
      const scope = dossierId ? `dossiers/${dossierId}` : "main";
      storagePath = `${ownerId}/${scope}/${Date.now()}-${crypto.randomUUID()}${extension}`;
      const { error } = await admin.storage
        .from("company-documents")
        .upload(storagePath, Buffer.from(await file.arrayBuffer()), {
          contentType: file.type,
          upsert: false,
        });
      if (error) throw error;
    }

    const { data: inserted, error } = await admin
      .from("company_documents")
      .insert({
        user_id: ownerId,
        dossier_id: dossierId,
        archive_id: archiveId,
        name,
        document_category: category,
        storage_path: storagePath,
        storage_provider: storageProvider,
        external_file_id: externalFileId,
        external_web_url: externalWebUrl,
        file_name: file.name,
        mime_type: file.type,
        expiration_date: expiry,
        notes,
      })
      .select("id,name,document_category,file_name,mime_type,expiration_date,notes,created_at,archive_id,storage_provider")
      .single();
    if (error) throw error;

    return NextResponse.json({
      document: {
        ...inserted,
        content_url: `/api/archive/documents/${inserted.id}/content`,
      },
    }, { status: 201 });
  } catch (error) {
    if (externalFileId && drive) await drive.files.delete({ fileId: externalFileId }).catch(() => undefined);
    if (storagePath) await admin.storage.from("company-documents").remove([storagePath]).catch(() => undefined);
    const message = error instanceof Error ? error.message : "Ajout du document impossible.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
