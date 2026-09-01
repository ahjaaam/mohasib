import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { encodeTokenPayload } from "@/lib/email-oauth";
import {
  createDriveFolder,
  driveClientForToken,
  exchangeGoogleDriveCode,
  googleDriveStateCookieName,
  verifyGoogleDriveState,
} from "@/lib/google-drive";

function redirectAndClear(request: Request, params: Record<string, string>) {
  const url = new URL("/parametres", request.url);
  url.searchParams.set("tab", "integrations");
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = NextResponse.redirect(url);
  response.cookies.set(googleDriveStateCookieName(), "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/oauth/google-drive/callback",
    maxAge: 0,
  });
  return response;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code) return redirectAndClear(request, { error: "drive_failed" });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirectAndClear(request, { error: "drive_failed" });

  const cookieState = request.headers.get("cookie")
    ?.match(/(?:^|;\s*)mohasib_oauth_state_google_drive=([^;]+)/)?.[1];
  if (!verifyGoogleDriveState(state, cookieState, user.id)) {
    return redirectAndClear(request, { error: "drive_invalid_state" });
  }

  try {
    const token = await exchangeGoogleDriveCode(request, code);
    const profileResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (!profileResponse.ok) throw new Error("Profil Google inaccessible.");
    const profile = await profileResponse.json() as { id?: string; email?: string };
    if (!profile.id) throw new Error("Compte Google non identifié.");

    const admin = createAdminClient();
    const { data: existing } = await admin
      .from("google_drive_connections")
      .select("id,google_account_id,root_folder_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (existing && existing.google_account_id !== profile.id) {
      return redirectAndClear(request, { error: "drive_account_mismatch" });
    }

    const drive = await driveClientForToken(request, token);
    const rootFolderId = existing?.root_folder_id
      ?? await createDriveFolder(drive, "Mohasib");

    const { error } = await admin
      .from("google_drive_connections")
      .upsert({
        user_id: user.id,
        google_account_id: profile.id,
        email: profile.email ?? user.email ?? null,
        token_encrypted: encodeTokenPayload(token),
        root_folder_id: rootFolderId,
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
    if (error) throw error;

    return redirectAndClear(request, { success: "google_drive" });
  } catch {
    return redirectAndClear(request, { error: "drive_failed" });
  }
}
