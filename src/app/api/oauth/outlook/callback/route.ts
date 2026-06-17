import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encodeTokenPayload, getCurrentCompanyId, getOAuthConfig, oauthRedirect } from "@/lib/email-oauth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!code) return NextResponse.redirect(oauthRedirect(request, { error: "outlook_failed" }));

  const { user, companyId } = await getCurrentCompanyId();
  if (!user || !companyId) return NextResponse.redirect(oauthRedirect(request, { error: "outlook_failed" }));

  const config = getOAuthConfig("outlook", request);
  if (!config.clientId || !config.clientSecret) {
    return NextResponse.redirect(oauthRedirect(request, { error: "outlook_not_configured" }));
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
  if (!tokenRes.ok) return NextResponse.redirect(oauthRedirect(request, { error: "outlook_failed" }));

  const tokenPayload = await tokenRes.json();
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

  if (error) return NextResponse.redirect(oauthRedirect(request, { error: "outlook_failed" }));
  return NextResponse.redirect(oauthRedirect(request, { success: "outlook" }));
}
