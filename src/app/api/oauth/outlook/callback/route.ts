import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encodeTokenPayload, getCurrentCompanyId, getOAuthConfig, oauthRedirect, oauthStateCookieName, verifyOAuthState } from "@/lib/email-oauth";

function redirectAndClearState(request: Request, params: Record<string, string>) {
  const response = NextResponse.redirect(oauthRedirect(request, params));
  response.cookies.set(oauthStateCookieName("outlook"), "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/oauth/outlook/callback",
    maxAge: 0,
  });
  return response;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!code) return redirectAndClearState(request, { error: "outlook_failed" });

  const { user, companyId } = await getCurrentCompanyId();
  if (!user || !companyId) return redirectAndClearState(request, { error: "outlook_failed" });
  const stateValid = verifyOAuthState(
    url.searchParams.get("state"),
    request.headers.get("cookie")?.match(/(?:^|;\s*)mohasib_oauth_state_outlook=([^;]+)/)?.[1],
    "outlook",
    user.id,
  );
  if (!stateValid) return redirectAndClearState(request, { error: "outlook_invalid_state" });

  const config = getOAuthConfig("outlook", request);
  if (!config.clientId || !config.clientSecret) {
    return redirectAndClearState(request, { error: "outlook_not_configured" });
  }

  const tokenRes = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
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
  if (!tokenRes.ok) return redirectAndClearState(request, { error: "outlook_failed" });

  const tokenPayload = await tokenRes.json();
  tokenPayload.stored_at = Date.now();
  tokenPayload.expires_at = Date.now() + Number(tokenPayload.expires_in ?? 3600) * 1000;
  const profileRes = await fetch("https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName", {
    headers: { Authorization: `Bearer ${tokenPayload.access_token}` },
  });
  const profile = profileRes.ok ? await profileRes.json() : null;
  const email = profile?.mail || profile?.userPrincipalName || user.email || null;

  const admin = createAdminClient();
  const { error } = await admin.from("companies").update({
    outlook_token_encrypted: encodeTokenPayload(tokenPayload),
    outlook_email: email,
    outlook_connected_at: new Date().toISOString(),
  }).eq("id", companyId);

  if (error) return redirectAndClearState(request, { error: "outlook_failed" });
  return redirectAndClearState(request, { success: "outlook" });
}
