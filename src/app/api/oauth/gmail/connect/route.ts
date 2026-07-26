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
    if (!user) return NextResponse.redirect(oauthRedirect(request, { error: "gmail_failed" }, errorPath));
    userId = user.id;
  } else {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.redirect(oauthRedirect(request, { error: "gmail_failed" }));
    userId = user.id;
  }

  const config = getOAuthConfig("gmail", request);
  if (!config.clientId || !config.clientSecret) {
    return NextResponse.redirect(oauthRedirect(request, { error: "gmail_not_configured" }, errorPath));
  }

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", config.clientId);
  authUrl.searchParams.set("redirect_uri", config.redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("scope", [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/gmail.readonly",
  ].join(" "));
  const state = createOAuthState("gmail", userId, dossierId);
  authUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authUrl);
  response.cookies.set(oauthStateCookieName("gmail"), state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/oauth/gmail/callback",
    maxAge: 10 * 60,
  });
  return response;
}
