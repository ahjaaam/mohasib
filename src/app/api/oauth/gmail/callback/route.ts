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
  const errorUrl = `${settingsUrl}&error=gmail_failed`;

  try {
    const { searchParams } = req.nextUrl;
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!code || !state) return NextResponse.redirect(errorUrl);

    // Verify state and extract userId
    let userId: string;
    try {
      const [uid] = decrypt(state).split(":");
      userId = uid;
    } catch {
      return NextResponse.redirect(errorUrl);
    }

    const redirectUri = `${appUrl}/api/oauth/gmail/callback`;

    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) return NextResponse.redirect(errorUrl);
    const tokens = await tokenRes.json();
    if (!tokens.refresh_token) return NextResponse.redirect(errorUrl);

    // Get user's Gmail address
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userInfo = userInfoRes.ok ? await userInfoRes.json() : {};

    // Ensure "Mohasib - Traité" label exists
    let labelId: string | null = null;
    try {
      const labelsRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/labels", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const labelsJson = await labelsRes.json();
      const existing = (labelsJson.labels ?? []).find((l: any) => l.name === "Mohasib - Traité");
      if (existing) {
        labelId = existing.id;
      } else {
        const createRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/labels", {
          method: "POST",
          headers: { Authorization: `Bearer ${tokens.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Mohasib - Traité", labelListVisibility: "labelShow", messageListVisibility: "show" }),
        });
        const created = createRes.ok ? await createRes.json() : null;
        if (created) labelId = created.id;
      }
    } catch {
      // Label creation is best-effort
    }

    const encryptedToken = encrypt(tokens.refresh_token);

    const { error: dbErr } = await serviceSupabase
      .from("companies")
      .update({
        gmail_token_encrypted: encryptedToken,
        gmail_email: userInfo.email ?? null,
        gmail_label_id: labelId,
        gmail_connected_at: new Date().toISOString(),
        gmail_last_sync: null,
        gmail_import_count: 0,
      })
      .eq("user_id", userId);

    if (dbErr) {
      console.error("[Gmail callback] DB update failed:", dbErr.message, dbErr.code);
      return NextResponse.redirect(errorUrl);
    }

    return NextResponse.redirect(`${settingsUrl}&success=gmail`);
  } catch (err) {
    console.error("[Gmail OAuth callback]", err);
    return NextResponse.redirect(errorUrl);
  }
}
