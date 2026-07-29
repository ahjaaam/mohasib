import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizePermission } from "@/lib/api-permissions";

const VALID_STATUSES = new Set(["pending", "matched", "ignored"]);

async function accessibleReceipt(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { response: NextResponse.json({ error: "Non authentifié" }, { status: 401 }) };

  const { data } = await supabase
    .from("receipts")
    .select("id,user_id,dossier_id,storage_path")
    .eq("id", id)
    .maybeSingle();
  if (!data) return { response: NextResponse.json({ error: "Justificatif introuvable" }, { status: 404 }) };

  return { receipt: data };
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const resolved = await accessibleReceipt(id);
  if (resolved.response || !resolved.receipt) return resolved.response;

  const permission = await authorizePermission("document", "create", { dossierId: resolved.receipt.dossier_id });
  if (permission.response) return permission.response;

  const body = await request.json().catch(() => ({}));
  if (!VALID_STATUSES.has(body.status)) {
    return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("receipts")
    .update({ status: body.status })
    .eq("id", id)
    .select("id,status")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ receipt: data });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const resolved = await accessibleReceipt(id);
  if (resolved.response || !resolved.receipt) return resolved.response;

  const permission = await authorizePermission("document", "delete", { dossierId: resolved.receipt.dossier_id });
  if (permission.response) return permission.response;

  const admin = createAdminClient();
  if (resolved.receipt.storage_path) {
    const { error: storageError } = await admin.storage.from("receipts").remove([resolved.receipt.storage_path]);
    if (storageError) {
      return NextResponse.json({ error: "Le fichier n'a pas pu être supprimé." }, { status: 500 });
    }
  }

  const { error } = await admin.from("receipts").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
