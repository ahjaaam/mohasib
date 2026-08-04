import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizePermission } from "@/lib/api-permissions";
import { resolveAccountOwnerId } from "@/lib/account-owner";
import { createDriveFolder, driveClientForConnection } from "@/lib/google-drive";

function dossierIdFrom(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export async function GET(request: NextRequest) {
  const dossierId = dossierIdFrom(request.nextUrl.searchParams.get("dossierId"));
  const permission = await authorizePermission("document", "read", { dossierId });
  if (permission.response || !permission.user) return permission.response;

  const ownerId = await resolveAccountOwnerId(permission.user.id);
  const admin = createAdminClient();
  const [{ data: connection }, { data: archives, error }] = await Promise.all([
    admin
      .from("google_drive_connections")
      .select("id,email,connected_at")
      .eq("user_id", ownerId)
      .maybeSingle(),
    (dossierId
      ? admin.from("document_archives").select("id,name,created_at").eq("user_id", ownerId).eq("dossier_id", dossierId)
      : admin.from("document_archives").select("id,name,created_at").eq("user_id", ownerId).is("dossier_id", null)
    ).order("created_at", { ascending: true }),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({
    connected: !!connection,
    email: connection?.email ?? null,
    connectedAt: connection?.connected_at ?? null,
    archives: archives ?? [],
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const dossierId = dossierIdFrom(body.dossierId);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 100) {
    return NextResponse.json({ error: "Le nom doit contenir entre 1 et 100 caractères." }, { status: 400 });
  }

  const permission = await authorizePermission("document", "create", { dossierId });
  if (permission.response || !permission.user) return permission.response;

  const ownerId = await resolveAccountOwnerId(permission.user.id);
  const admin = createAdminClient();
  const { data: connection } = await admin
    .from("google_drive_connections")
    .select("id,token_encrypted,root_folder_id")
    .eq("user_id", ownerId)
    .maybeSingle();
  if (!connection) {
    return NextResponse.json({ error: "Connectez d'abord Google Drive dans les paramètres." }, { status: 409 });
  }

  const { data: duplicate } = await (dossierId
    ? admin.from("document_archives").select("id").eq("user_id", ownerId).eq("dossier_id", dossierId).ilike("name", name)
    : admin.from("document_archives").select("id").eq("user_id", ownerId).is("dossier_id", null).ilike("name", name)
  ).maybeSingle();
  if (duplicate) return NextResponse.json({ error: "Une archive porte déjà ce nom." }, { status: 409 });

  try {
    const drive = await driveClientForConnection(request, connection);
    const folderId = await createDriveFolder(drive, name, connection.root_folder_id);
    const { data, error } = await admin
      .from("document_archives")
      .insert({
        user_id: ownerId,
        dossier_id: dossierId,
        drive_connection_id: connection.id,
        name,
        drive_folder_id: folderId,
      })
      .select("id,name,created_at")
      .single();
    if (error) {
      await drive.files.delete({ fileId: folderId }).catch(() => undefined);
      throw error;
    }
    return NextResponse.json({ archive: data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Création de l'archive impossible.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
