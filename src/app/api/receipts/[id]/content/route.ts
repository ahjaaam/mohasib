import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizePermission } from "@/lib/api-permissions";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: receipt } = await supabase
    .from("receipts")
    .select("id,dossier_id,storage_path,file_name,mime_type")
    .eq("id", id)
    .maybeSingle();

  if (!receipt) {
    return NextResponse.json({ error: "Note de frais introuvable." }, { status: 404 });
  }

  const permission = await authorizePermission("document", "read", { dossierId: receipt.dossier_id });
  if (permission.response) return permission.response;
  if (!receipt.storage_path) {
    return NextResponse.json({ error: "Fichier absent." }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.storage.from("receipts").download(receipt.storage_path);
  if (error || !data) {
    return NextResponse.json({ error: "Lecture de la note de frais impossible." }, { status: 502 });
  }

  const safeName = (receipt.file_name || "note-de-frais").replace(/["\r\n]/g, "_");
  return new Response(data, {
    headers: {
      "Content-Type": receipt.mime_type || data.type || "application/octet-stream",
      "Content-Disposition": `inline; filename="${safeName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
