import crypto from "node:crypto";

export const INBOUND_EMAIL_LIMITS = {
  requestBytes: 35 * 1024 * 1024,
  rawBytes: 25 * 1024 * 1024,
  attachmentBytes: 10 * 1024 * 1024,
  totalAttachmentBytes: 20 * 1024 * 1024,
  attachments: 5,
} as const;

export function utf8Bytes(value: string) {
  return Buffer.byteLength(value, "utf8");
}

export function inboundMessageKey(raw: string, messageId?: string | null) {
  const normalizedId = messageId?.trim().toLowerCase();
  if (normalizedId) return normalizedId.slice(0, 500);
  return `sha256:${crypto.createHash("sha256").update(raw).digest("hex")}`;
}

export function inboundAttachmentKey(
  dossierId: string,
  messageKey: string,
  content: Buffer,
) {
  const contentHash = crypto.createHash("sha256").update(content).digest("hex");
  return `${dossierId}:inbound:${messageKey}:${contentHash}`;
}

export function safeInboundFileName(value: string | undefined, fallback: string) {
  const cleaned = (value || fallback)
    .replace(/[\u0000-\u001f\u007f/\\]/g, "_")
    .trim();
  return (cleaned || fallback).slice(0, 180);
}

export function senderRateLimitKey(dossierId: string, sender: string) {
  const senderHash = crypto
    .createHash("sha256")
    .update(sender.trim().toLowerCase())
    .digest("hex")
    .slice(0, 24);
  return `${dossierId}:${senderHash}`;
}
