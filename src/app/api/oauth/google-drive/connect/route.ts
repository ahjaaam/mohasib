import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveAccountOwnerId } from "@/lib/account-owner";
import {
  createGoogleDriveState,
  googleDriveAuthorizationUrl,
  googleDriveConfig,
  googleDriveStateCookieName,
} from "@/lib/google-drive";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/connexion", request.url));

  const ownerId = await resolveAccountOwnerId(user.id);
  if (ownerId !== user.id) {
    return NextResponse.redirect(new URL("/settings?tab=integrations&error=drive_owner_required", request.url));
  }

  const config = googleDriveConfig(request);
  if (!config.clientId || !config.clientSecret) {
    return NextResponse.redirect(new URL("/settings?tab=integrations&error=drive_not_configured", request.url));
  }

  const state = createGoogleDriveState(user.id);
  const response = NextResponse.redirect(googleDriveAuthorizationUrl(request, state));
  response.cookies.set(googleDriveStateCookieName(), state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/oauth/google-drive/callback",
    maxAge: 10 * 60,
  });
  return response;
}
