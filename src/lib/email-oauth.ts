import "server-only";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { resolveAccountOwnerId } from "@/lib/account-owner";

export type EmailProvider = "gmail" | "outlook";

const SETTINGS_PATH = "/settings?tab=integrations";

export function oauthRedirect(request: Request, params: Record<string, string>) {
  const url = new URL(request.url);
  url.pathname = SETTINGS_PATH;
  url.search = new URLSearchParams(params).toString();
  return url;
}

export function appOrigin(request: Request) {
  const url = new URL(request.url);
  return process.env.NEXT_PUBLIC_SITE_URL || url.origin;
}

export function getOAuthConfig(provider: EmailProvider, request: Request) {
  const origin = appOrigin(request);
  if (provider === "gmail") {
    return {
      clientId: process.env.GOOGLE_CLIENT_ID || process.env.GMAIL_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || process.env.GMAIL_CLIENT_SECRET || "",
      redirectUri: `${origin}/api/oauth/gmail/callback`,
    };
  }
  return {
    clientId: process.env.MICROSOFT_CLIENT_ID || process.env.OUTLOOK_CLIENT_ID || "",
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET || process.env.OUTLOOK_CLIENT_SECRET || "",
    redirectUri: `${origin}/api/oauth/outlook/callback`,
  };
}

export function encodeTokenPayload(payload: unknown) {
  const raw = JSON.stringify(payload);
  const secret = process.env.EMAIL_TOKEN_SECRET || process.env.NEXTAUTH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return `plain:${Buffer.from(raw).toString("base64url")}`;

  const key = crypto.createHash("sha256").update(secret).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(raw, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `aes256gcm:${Buffer.concat([iv, tag, encrypted]).toString("base64url")}`;
}

export async function getCurrentCompanyId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, companyId: null };

  const ownerId = await resolveAccountOwnerId(user.id);
  const admin = createAdminClient();
  const { data: company } = await admin
    .from("companies")
    .select("id")
    .eq("user_id", ownerId)
    .maybeSingle();

  return { user, companyId: company?.id ?? null };
}
