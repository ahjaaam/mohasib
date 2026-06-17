import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encodeTokenPayload, getCurrentCompanyId, getOAuthConfig, oauthRedirect } from "@/lib/email-oauth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!code) return NextResponse.redirect(oauthRedirect(request, { error: "gmail_failed" }));

  const { user, companyId } = await getCurrentCompanyId();
  if (!user || !companyId) return NextResponse.redirect(oauthRedirect(request, { error: "gmail_failed" }));

  const config = getOAuthConfig("gmail", request);
  if (!config.clientId || !config.clientSecret) {
    return NextResponse.redirect(oauthRedirect(request, { error: "gmail_not_configured" }));
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
  if (!tokenRes.ok) return NextResponse.redirect(oauthRedirect(request, { error: "gmail_failed" }));

  const tokenPayload = await tokenRes.json();
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

  if (error) return NextResponse.redirect(oauthRedirect(request, { error: "gmail_failed" }));
  return NextResponse.redirect(oauthRedirect(request, { success: "gmail" }));
}
