import "server-only";

import crypto from "crypto";
import { Readable } from "stream";
import { google } from "googleapis";
import { createAdminClient } from "@/lib/supabase/admin";
import { decodeTokenPayload, encodeTokenPayload } from "@/lib/email-oauth";

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

type DriveOAuthState = {
  userId: string;
  nonce: string;
  issuedAt: number;
};

type DriveTokenPayload = {
  access_token?: string;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  expiry_date?: number;
  expires_at?: number;
  [key: string]: unknown;
};

export function googleDriveConfig(request: Request) {
  const url = new URL(request.url);
  const origin = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || url.origin;
  return {
    clientId: process.env.GOOGLE_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    redirectUri: `${origin}/api/oauth/google-drive/callback`,
  };
}

function stateSecret() {
  const secret = process.env.EMAIL_TOKEN_SECRET || process.env.NEXTAUTH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Le secret de chiffrement OAuth n'est pas configuré.");
  return secret;
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function googleDriveStateCookieName() {
  return "mohasib_oauth_state_google_drive";
}

export function createGoogleDriveState(userId: string) {
  const payload: DriveOAuthState = {
    userId,
    nonce: crypto.randomBytes(32).toString("base64url"),
    issuedAt: Date.now(),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", stateSecret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifyGoogleDriveState(
  token: string | null,
  cookieToken: string | undefined,
  userId: string,
) {
  if (!token || !cookieToken || !safeEqual(token, cookieToken)) return false;
  const [encoded, signature, ...rest] = token.split(".");
  if (!encoded || !signature || rest.length) return false;
  const expected = crypto.createHmac("sha256", stateSecret()).update(encoded).digest("base64url");
  if (!safeEqual(signature, expected)) return false;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as DriveOAuthState;
    return payload.userId === userId
      && typeof payload.nonce === "string"
      && payload.nonce.length >= 32
      && Number.isFinite(payload.issuedAt)
      && payload.issuedAt <= Date.now()
      && Date.now() - payload.issuedAt <= OAUTH_STATE_TTL_MS;
  } catch {
    return false;
  }
}

export function googleDriveAuthorizationUrl(request: Request, state: string) {
  const config = googleDriveConfig(request);
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);
  url.searchParams.set("scope", ["openid", "email", "profile", DRIVE_SCOPE].join(" "));
  return url;
}

export async function exchangeGoogleDriveCode(request: Request, code: string) {
  const config = googleDriveConfig(request);
  const response = await fetch("https://oauth2.googleapis.com/token", {
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
  if (!response.ok) throw new Error("Google a refusé l'échange du code OAuth.");
  const payload = await response.json() as DriveTokenPayload;
  payload.expires_at = Date.now() + Number(payload.expires_in ?? 3600) * 1000;
  return payload;
}

function oauthClientForToken(request: Request, token: DriveTokenPayload) {
  const config = googleDriveConfig(request);
  const client = new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
  client.setCredentials({
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    scope: token.scope,
    token_type: token.token_type,
    expiry_date: Number(token.expiry_date ?? token.expires_at ?? 0) || undefined,
  });
  return client;
}

export async function driveClientForConnection(request: Request, connection: {
  id: string;
  token_encrypted: string;
}) {
  const token = decodeTokenPayload<DriveTokenPayload>(connection.token_encrypted);
  const auth = oauthClientForToken(request, token);
  auth.on("tokens", async (freshTokens) => {
    const updated = {
      ...token,
      ...freshTokens,
      expires_at: freshTokens.expiry_date ?? token.expires_at,
    };
    await createAdminClient()
      .from("google_drive_connections")
      .update({ token_encrypted: encodeTokenPayload(updated), updated_at: new Date().toISOString() })
      .eq("id", connection.id);
  });
  return google.drive({ version: "v3", auth });
}

export async function driveClientForToken(request: Request, token: DriveTokenPayload) {
  return google.drive({ version: "v3", auth: oauthClientForToken(request, token) });
}

export async function createDriveFolder(
  drive: ReturnType<typeof google.drive>,
  name: string,
  parentId?: string | null,
) {
  const response = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      ...(parentId ? { parents: [parentId] } : {}),
    },
    fields: "id",
  });
  if (!response.data.id) throw new Error("Google Drive n'a pas retourné l'identifiant du dossier.");
  return response.data.id;
}

export async function uploadDriveFile(
  drive: ReturnType<typeof google.drive>,
  folderId: string,
  file: File,
) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const response = await drive.files.create({
    requestBody: { name: file.name, parents: [folderId] },
    media: {
      mimeType: file.type || "application/octet-stream",
      body: Readable.from(buffer),
    },
    fields: "id,webViewLink,webContentLink",
  });
  if (!response.data.id) throw new Error("Google Drive n'a pas retourné l'identifiant du fichier.");
  return response.data;
}
