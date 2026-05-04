import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { encrypt, decrypt } from "@/lib/crypto";

const serviceSupabase = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.mohasibai.com";
  const settingsUrl = `${appUrl}/settings?tab=integrations`;
  const errorUrl = `${settingsUrl}&error=outlook_failed`;

  try {
    const { searchParams } = req.nextUrl;
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!code || !state) return NextResponse.redirect(errorUrl);

    let userId: string;
    try {
      const [uid] = decrypt(state).split(":");
      userId = uid;
    } catch {
      return NextResponse.redirect(errorUrl);
    }

    const redirectUri = `${appUrl}/api/oauth/outlook/callback`;

    const tokenRes = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID!,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
        code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        scope: "Mail.Read offline_access User.Read",
      }),
    });
    if (!tokenRes.ok) return NextResponse.redirect(errorUrl);
    const tokens = await tokenRes.json();
    if (!tokens.refresh_token) return NextResponse.redirect(errorUrl);

    // Get user's email from Microsoft Graph
    const meRes = await fetch("https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const me = meRes.ok ? await meRes.json() : {};
    const email = me.mail ?? me.userPrincipalName ?? null;

    const encryptedToken = encrypt(tokens.refresh_token);

    await serviceSupabase
      .from("companies")
      .update({
        outlook_token_encrypted: encryptedToken,
        outlook_email: email,
        outlook_connected_at: new Date().toISOString(),
        outlook_last_sync: null,
        outlook_import_count: 0,
      })
      .eq("user_id", userId);

    return NextResponse.redirect(`${settingsUrl}&success=outlook`);
  } catch (err) {
    console.error("[Outlook OAuth callback]", err);
    return NextResponse.redirect(errorUrl);
  }
}
