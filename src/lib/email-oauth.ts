import "server-only";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { resolveAccountOwnerId } from "@/lib/account-owner";

export type EmailProvider = "gmail" | "outlook";

const SETTINGS_PATH = "/settings?tab=integrations";
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

type OAuthStatePayload = {
  provider: EmailProvider;
  userId: string;
  dossierId?: string;
  nonce: string;
  issuedAt: number;
};

function oauthStateSecret() {
  const secret = process.env.EMAIL_TOKEN_SECRET || process.env.NEXTAUTH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("EMAIL_TOKEN_SECRET n'est pas configuré.");
  return secret;
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function oauthStateCookieName(provider: EmailProvider) {
  return `mohasib_oauth_state_${provider}`;
}

export function createOAuthState(provider: EmailProvider, userId: string, dossierId?: string) {
  const payload: OAuthStatePayload = {
    provider,
    userId,
    ...(dossierId ? { dossierId } : {}),
    nonce: crypto.randomBytes(32).toString("base64url"),
    issuedAt: Date.now(),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", oauthStateSecret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

// Best-effort, unverified peek at the dossierId carried in a state token — used only to
// pick the right error-redirect target before the token has been fully verified.
export function peekOAuthStateDossierId(token: string | null): string | undefined {
  if (!token) return undefined;
  try {
    const [encoded] = token.split(".");
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as OAuthStatePayload;
    return typeof payload.dossierId === "string" ? payload.dossierId : undefined;
  } catch {
    return undefined;
  }
}

export function verifyOAuthState(
  token: string | null,
  cookieToken: string | undefined,
  provider: EmailProvider,
  userId: string,
): OAuthStatePayload | null {
  if (!token || !cookieToken || !safeEqual(token, cookieToken)) return null;
  const [encoded, signature, ...rest] = token.split(".");
  if (!encoded || !signature || rest.length) return null;
  const expected = crypto.createHmac("sha256", oauthStateSecret()).update(encoded).digest("base64url");
  if (!safeEqual(signature, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as OAuthStatePayload;
    const valid = payload.provider === provider
      && payload.userId === userId
      && typeof payload.nonce === "string"
      && payload.nonce.length >= 32
      && Number.isFinite(payload.issuedAt)
      && payload.issuedAt <= Date.now()
      && Date.now() - payload.issuedAt <= OAUTH_STATE_TTL_MS;
    return valid ? payload : null;
  } catch {
    return null;
  }
}

export function oauthRedirect(request: Request, params: Record<string, string>, path: string = SETTINGS_PATH) {
  const url = new URL(request.url);
  url.pathname = path.split("?")[0];
  const search = new URLSearchParams(params);
  const pathQuery = path.split("?")[1];
  if (pathQuery) new URLSearchParams(pathQuery).forEach((value, key) => search.set(key, value));
  url.search = search.toString();
  return url;
}

export function dossierSettingsPath(dossierId: string) {
  return `/comptable-pro/dossiers/${dossierId}/settings?tab=integrations`;
}

export function appOrigin(request: Request) {
  const url = new URL(request.url);
  return process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || url.origin;
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

export function decodeTokenPayload<T extends Record<string, unknown>>(encoded: string): T {
  if (encoded.startsWith("plain:")) {
    return JSON.parse(Buffer.from(encoded.slice(6), "base64url").toString("utf8")) as T;
  }

  if (!encoded.startsWith("aes256gcm:")) {
    throw new Error("Format de jeton email invalide.");
  }

  const secret = process.env.EMAIL_TOKEN_SECRET || process.env.NEXTAUTH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("EMAIL_TOKEN_SECRET n'est pas configuré.");

  const payload = Buffer.from(encoded.slice("aes256gcm:".length), "base64url");
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const encrypted = payload.subarray(28);
  const key = crypto.createHash("sha256").update(secret).digest();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const raw = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  return JSON.parse(raw) as T;
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

// A dossier's mailbox can only be connected by the client_portal member that dossier is scoped to.
export async function getCurrentUserForDossier(dossierId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: membership } = await admin
    .from("user_memberships")
    .select("id")
    .eq("user_id", user.id)
    .eq("dossier_id", dossierId)
    .eq("role_name", "client_portal")
    .eq("status", "active")
    .maybeSingle();
  if (!membership) return null;

  return user;
}
