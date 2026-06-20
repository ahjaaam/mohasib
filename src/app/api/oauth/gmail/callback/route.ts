import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encodeTokenPayload, getCurrentCompanyId, getOAuthConfig, oauthRedirect, oauthStateCookieName, verifyOAuthState } from "@/lib/email-oauth";

function redirectAndClearState(request: Request, params: Record<string, string>) {
  const response = NextResponse.redirect(oauthRedirect(request, params));
  response.cookies.set(oauthStateCookieName("gmail"), "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/oauth/gmail/callback",
    maxAge: 0,
  });
  return response;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!code) return redirectAndClearState(request, { error: "gmail_failed" });

  const { user, companyId } = await getCurrentCompanyId();
  if (!user || !companyId) return redirectAndClearState(request, { error: "gmail_failed" });
  const stateValid = verifyOAuthState(
    url.searchParams.get("state"),
    request.headers.get("cookie")?.match(/(?:^|;\s*)mohasib_oauth_state_gmail=([^;]+)/)?.[1],
    "gmail",
    user.id,
  );
  if (!stateValid) return redirectAndClearState(request, { error: "gmail_invalid_state" });

  const config = getOAuthConfig("gmail", request);
  if (!config.clientId || !config.clientSecret) {
    return redirectAndClearState(request, { error: "gmail_not_configured" });
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) return redirectAndClearState(request, { error: "gmail_failed" });

  const tokenPayload = await tokenRes.json();
  tokenPayload.stored_at = Date.now();
  tokenPayload.expires_at = Date.now() + Number(tokenPayload.expires_in ?? 3600) * 1000;
  const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokenPayload.access_token}` },
  });
  const profile = profileRes.ok ? await profileRes.json() : null;

  const admin = createAdminClient();
  const { error } = await admin.from("companies").update({
    gmail_token_encrypted: encodeTokenPayload(tokenPayload),
    gmail_email: profile?.email ?? user.email ?? null,
    gmail_connected_at: new Date().toISOString(),
  }).eq("id", companyId);

  if (error) return redirectAndClearState(request, { error: "gmail_failed" });
  return redirectAndClearState(request, { success: "gmail" });
}
