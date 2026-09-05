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
  const { data, error } = await admin.storage
    .from("receipts")
    .createSignedUrl(receipt.storage_path, 5 * 60);
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "Lecture de la note de frais impossible." }, { status: 502 });
  }

  const response = NextResponse.redirect(data.signedUrl, 307);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
