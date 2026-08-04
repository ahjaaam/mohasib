import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizePermission } from "@/lib/api-permissions";
import { driveClientForConnection } from "@/lib/google-drive";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: document } = await supabase
    .from("company_documents")
    .select("id,dossier_id,storage_path,storage_provider,external_file_id,archive_id")
    .eq("id", id)
    .maybeSingle();
  if (!document) return NextResponse.json({ error: "Document introuvable." }, { status: 404 });

  const permission = await authorizePermission("document", "delete", { dossierId: document.dossier_id });
  if (permission.response) return permission.response;
  const admin = createAdminClient();

  if (document.storage_provider === "google_drive" && document.external_file_id && document.archive_id) {
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
      await drive.files.delete({ fileId: document.external_file_id });
    } catch {
      return NextResponse.json({ error: "Le fichier n'a pas pu être supprimé de Google Drive." }, { status: 502 });
    }
  } else if (document.storage_path) {
    const { error } = await admin.storage.from("company-documents").remove([document.storage_path]);
    if (error) return NextResponse.json({ error: "Le fichier n'a pas pu être supprimé." }, { status: 502 });
  }

  const { error } = await admin.from("company_documents").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
