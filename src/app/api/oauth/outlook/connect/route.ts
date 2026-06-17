import { NextResponse } from "next/server";
import { getOAuthConfig, oauthRedirect } from "@/lib/email-oauth";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(oauthRedirect(request, { error: "outlook_failed" }));

  const config = getOAuthConfig("outlook", request);
  if (!config.clientId || !config.clientSecret) {
    return NextResponse.redirect(oauthRedirect(request, { error: "outlook_not_configured" }));
  }

  const authUrl = new URL("https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
  authUrl.searchParams.set("client_id", config.clientId);
  authUrl.searchParams.set("redirect_uri", config.redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("response_mode", "query");
  authUrl.searchParams.set("scope", "offline_access User.Read Mail.Read");
  authUrl.searchParams.set("state", "outlook");

  return NextResponse.redirect(authUrl);
}
