import { NextResponse } from "next/server";
import { createOAuthState, getOAuthConfig, oauthRedirect, oauthStateCookieName } from "@/lib/email-oauth";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(oauthRedirect(request, { error: "gmail_failed" }));

  const config = getOAuthConfig("gmail", request);
  if (!config.clientId || !config.clientSecret) {
    return NextResponse.redirect(oauthRedirect(request, { error: "gmail_not_configured" }));
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
  const state = createOAuthState("gmail", user.id);
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
