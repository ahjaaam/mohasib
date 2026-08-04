import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { resolveAccountOwnerId } from "@/lib/account-owner";
import { decodeTokenPayload } from "@/lib/email-oauth";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (await resolveAccountOwnerId(user.id) !== user.id) {
    return NextResponse.json({ error: "Seul le propriétaire peut déconnecter Google Drive." }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: connection } = await admin
    .from("google_drive_connections")
    .select("id,token_encrypted")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!connection) return NextResponse.json({ success: true });

  try {
    const token = decodeTokenPayload<{ access_token?: string; refresh_token?: string }>(connection.token_encrypted);
    const value = token.refresh_token ?? token.access_token;
    if (value) {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(value)}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
    }
  } catch {
    // The local connection must still be removable when Google has already revoked it.
  }

  const { error } = await admin.from("google_drive_connections").delete().eq("id", connection.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
