import { NextResponse } from "next/server";
import { createOAuthState, dossierSettingsPath, getCurrentUserForDossier, getOAuthConfig, oauthRedirect, oauthStateCookieName } from "@/lib/email-oauth";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const dossierId = url.searchParams.get("dossierId") || undefined;
  const errorPath = dossierId ? dossierSettingsPath(dossierId) : undefined;

  let userId: string;
  if (dossierId) {
    const user = await getCurrentUserForDossier(dossierId);
    if (!user) return NextResponse.redirect(oauthRedirect(request, { error: "outlook_failed" }, errorPath));
    userId = user.id;
  } else {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.redirect(oauthRedirect(request, { error: "outlook_failed" }));
    userId = user.id;
  }

  const config = getOAuthConfig("outlook", request);
  if (!config.clientId || !config.clientSecret) {
    return NextResponse.redirect(oauthRedirect(request, { error: "outlook_not_configured" }, errorPath));
  }

  const authUrl = new URL("https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
  authUrl.searchParams.set("client_id", config.clientId);
  authUrl.searchParams.set("redirect_uri", config.redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("response_mode", "query");
  authUrl.searchParams.set("scope", "offline_access User.Read Mail.Read");
  const state = createOAuthState("outlook", userId, dossierId);
  authUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authUrl);
  response.cookies.set(oauthStateCookieName("outlook"), state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/oauth/outlook/callback",
    maxAge: 10 * 60,
  });
  return response;
}
