import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizePermission } from "@/lib/api-permissions";
import { driveClientForConnection } from "@/lib/google-drive";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: document } = await supabase
    .from("company_documents")
    .select("id,dossier_id,storage_path,storage_provider,external_file_id,file_name,mime_type,archive_id")
    .eq("id", id)
    .maybeSingle();
  if (!document) return NextResponse.json({ error: "Document introuvable." }, { status: 404 });

  const permission = await authorizePermission("document", "read", { dossierId: document.dossier_id });
  if (permission.response) return permission.response;

  const admin = createAdminClient();
  if (document.storage_provider !== "google_drive") {
    if (!document.storage_path) return NextResponse.json({ error: "Fichier absent." }, { status: 404 });
    const { data, error } = await admin.storage
      .from("company-documents")
      .download(document.storage_path);
    if (error || !data) {
      return NextResponse.json({ error: "Lecture du document impossible." }, { status: 502 });
    }
    const safeName = (document.file_name || "document").replace(/["\r\n]/g, "_");
    return new Response(data, {
      headers: {
        "Content-Type": document.mime_type || data.type || "application/octet-stream",
        "Content-Disposition": `inline; filename="${safeName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  if (!document.external_file_id || !document.archive_id) {
    return NextResponse.json({ error: "La connexion Google Drive de ce document n'est plus disponible." }, { status: 409 });
  }
  const { data: archive } = await admin
    .from("document_archives")
    .select("google_drive_connections!inner(id,token_encrypted)")
    .eq("id", document.archive_id)
    .maybeSingle();
  const relation = Array.isArray(archive?.google_drive_connections)
    ? archive.google_drive_connections[0]
    : archive?.google_drive_connections;
  if (!relation) return NextResponse.json({ error: "Google Drive n'est plus connecté." }, { status: 409 });

  try {
    const drive = await driveClientForConnection(request, relation);
    const response = await drive.files.get(
      { fileId: document.external_file_id, alt: "media" },
      { responseType: "arraybuffer" },
    );
    const bytes = new Uint8Array(response.data as ArrayBuffer);
    const safeName = (document.file_name || "document").replace(/["\r\n]/g, "_");
    return new Response(bytes, {
      headers: {
        "Content-Type": document.mime_type || "application/octet-stream",
        "Content-Disposition": `inline; filename="${safeName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Lecture du fichier Google Drive impossible." }, { status: 502 });
  }
}
