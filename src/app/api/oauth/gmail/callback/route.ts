import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  dossierSettingsPath, encodeTokenPayload, getCurrentCompanyId, getCurrentUserForDossier,
  getOAuthConfig, oauthRedirect, oauthStateCookieName, peekOAuthStateDossierId, verifyOAuthState,
} from "@/lib/email-oauth";

function redirectAndClearState(request: Request, params: Record<string, string>, path?: string) {
  const response = NextResponse.redirect(oauthRedirect(request, params, path));
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
  const stateToken = url.searchParams.get("state");
  const peekedDossierId = peekOAuthStateDossierId(stateToken);
  const redirectPath = peekedDossierId ? dossierSettingsPath(peekedDossierId) : undefined;
  if (!code) return redirectAndClearState(request, { error: "gmail_failed" }, redirectPath);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirectAndClearState(request, { error: "gmail_failed" }, redirectPath);

  const statePayload = verifyOAuthState(
    stateToken,
    request.headers.get("cookie")?.match(/(?:^|;\s*)mohasib_oauth_state_gmail=([^;]+)/)?.[1],
    "gmail",
    user.id,
  );
  if (!statePayload) return redirectAndClearState(request, { error: "gmail_invalid_state" }, redirectPath);

  const dossierId = statePayload.dossierId;
  let companyId: string | null = null;
  if (dossierId) {
    const authorizedUser = await getCurrentUserForDossier(dossierId);
    if (!authorizedUser) return redirectAndClearState(request, { error: "gmail_failed" }, redirectPath);
  } else {
    const result = await getCurrentCompanyId();
    if (!result.companyId) return redirectAndClearState(request, { error: "gmail_failed" }, redirectPath);
    companyId = result.companyId;
  }

  const config = getOAuthConfig("gmail", request);
  if (!config.clientId || !config.clientSecret) {
    return redirectAndClearState(request, { error: "gmail_not_configured" }, redirectPath);
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
  if (!tokenRes.ok) return redirectAndClearState(request, { error: "gmail_failed" }, redirectPath);

  const tokenPayload = await tokenRes.json();
  tokenPayload.stored_at = Date.now();
  tokenPayload.expires_at = Date.now() + Number(tokenPayload.expires_in ?? 3600) * 1000;
  const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokenPayload.access_token}` },
  });
  const profile = profileRes.ok ? await profileRes.json() : null;

  const admin = createAdminClient();
  const update = {
    gmail_token_encrypted: encodeTokenPayload(tokenPayload),
    gmail_email: profile?.email ?? user.email ?? null,
    gmail_connected_at: new Date().toISOString(),
  };
  const { error } = dossierId
    ? await admin.from("dossiers").update(update).eq("id", dossierId)
    : await admin.from("companies").update(update).eq("id", companyId);

  if (error) return redirectAndClearState(request, { error: "gmail_failed" }, redirectPath);
  return redirectAndClearState(request, { success: "gmail" }, redirectPath);
}
