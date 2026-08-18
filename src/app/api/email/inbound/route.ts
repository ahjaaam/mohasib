export const dynamic = "force-dynamic";

import crypto from "node:crypto";
import { simpleParser } from "mailparser";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractWithFallback } from "@/lib/ocr-engine";
import { getMonthlyUsage, incrementUploadCount } from "@/lib/usage";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  INBOUND_EMAIL_LIMITS,
  inboundAttachmentKey,
  inboundMessageKey,
  safeInboundFileName,
  senderRateLimitKey,
  utf8Bytes,
} from "@/lib/inbound-email";

export async function POST(request: Request) {
  try {
    const configuredSecret = process.env.WORKER_SECRET;
    const workerSecret = request.headers.get("X-Worker-Secret");
    if (!configuredSecret || !workerSecret || workerSecret !== configuredSecret) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const supabase = createAdminClient();

    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (Number.isFinite(contentLength) && contentLength > INBOUND_EMAIL_LIMITS.requestBytes) {
      return Response.json({ error: "Message too large" }, { status: 413 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return Response.json({ error: "Invalid payload" }, { status: 400 });
    }
    const { to, from, subject, raw } = body as {
      to: string | string[];
      from?: string;
      subject?: string;
      raw: string;
    };
    if (typeof raw !== "string" || utf8Bytes(raw) > INBOUND_EMAIL_LIMITS.rawBytes) {
      return Response.json({ error: "Message too large" }, { status: 413 });
    }

    const rawTo = Array.isArray(to) ? to[0] : to;
    if (typeof rawTo !== "string") {
      return Response.json({ error: "Invalid recipient" }, { status: 400 });
    }
    const recipientEmail = (rawTo.match(/<([^>]+)>/) ?? [])[1]?.toLowerCase()
      ?? rawTo.toLowerCase().trim();

    const safeFrom = typeof from === "string" ? from.slice(0, 500) : "";
    const safeSubject = typeof subject === "string" ? subject.slice(0, 500) : "";
    console.log("[inbound]", { to: recipientEmail, from: safeFrom, subject: safeSubject });

    // Only process dedicated dossier addresses (factures-XXXXXX@mohasibai.com).
    // Anything else is silently acknowledged — never write to receipts.
    const isDossierEmail =
      /^factures-[a-z0-9]+@mohasibai\.com$/.test(recipientEmail);

    if (!isDossierEmail) {
      console.log("[inbound] Not a dossier address, ignoring:", recipientEmail);
      return Response.json({ received: true, routed: false, reason: "Not a dossier address" });
    }

    // This endpoint only needs headers and attachments. Avoid HTML-to-text
    // conversion entirely, reducing parser work and exposure to HTML merge paths.
    const parsed = await simpleParser(raw, {
      skipHtmlToText: true,
      skipTextToHtml: true,
      maxHtmlLengthToParse: 1 * 1024 * 1024,
    });

    const { data: dossier } = await supabase
      .from("dossiers")
      .select("id, fiduciaire_user_id, raison_sociale")
      .ilike("inbox_email", recipientEmail)
      .single();

    if (!dossier) {
      console.log("[inbound] No dossier for:", recipientEmail);
      return Response.json({ received: true, routed: false, reason: "No dossier found" });
    }

    const [{ data: company }, senderLimit, dossierLimit] = await Promise.all([
      supabase
        .from("companies")
        .select("id")
        .eq("user_id", dossier.fiduciaire_user_id)
        .maybeSingle(),
      checkRateLimit(senderRateLimitKey(dossier.id, safeFrom), "email/inbound:sender", {
        maxAttempts: 30,
        windowMs: 60 * 60_000,
        blockMs: 60 * 60_000,
      }),
      checkRateLimit(dossier.id, "email/inbound:dossier", {
        maxAttempts: 100,
        windowMs: 60 * 60_000,
        blockMs: 60 * 60_000,
      }),
    ]);
    if (!senderLimit.allowed || !dossierLimit.allowed) {
      return Response.json({ received: true, routed: false, reason: "Rate limit exceeded" });
    }
    if (!company) {
      return Response.json({ received: true, routed: false, reason: "Company not found" });
    }

    const usage = await getMonthlyUsage(company.id);
    if (!usage.allowed) {
      return Response.json({ received: true, routed: true, quota_exhausted: true, processed: 0 });
    }

    const attachments = parsed.attachments ?? [];
    const messageKey = inboundMessageKey(raw, parsed.messageId);
    let processed = 0;
    let skipped = 0;
    let supportedAttachments = 0;
    let totalAttachmentBytes = 0;
    let quotaExhausted = false;
    const failures: string[] = [];

    for (const attachment of attachments) {
      const mime: string = attachment.contentType ?? "application/octet-stream";
      const isPdf = mime === "application/pdf" || attachment.filename?.toLowerCase().endsWith(".pdf");
      const isImage = ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mime);
      if (!isPdf && !isImage) continue;
      supportedAttachments++;

      if (supportedAttachments > INBOUND_EMAIL_LIMITS.attachments) {
        skipped++;
        failures.push("attachment-count-limit");
        continue;
      }

      const fileBuffer = attachment.content as Buffer;
      if (fileBuffer.length > INBOUND_EMAIL_LIMITS.attachmentBytes
        || totalAttachmentBytes + fileBuffer.length > INBOUND_EMAIL_LIMITS.totalAttachmentBytes) {
        skipped++;
        failures.push("attachment-size-limit");
        continue;
      }
      if (usage.remaining >= 0 && processed >= usage.remaining) {
        quotaExhausted = true;
        break;
      }
      totalAttachmentBytes += fileBuffer.length;

      const fallbackName = `attachment-${Date.now()}.${isPdf ? "pdf" : "jpg"}`;
      const originalName = safeInboundFileName(attachment.filename, fallbackName);
      const extensionByMime: Record<string, string> = {
        "application/pdf": "pdf",
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/gif": "gif",
        "image/webp": "webp",
      };
      const ext = extensionByMime[mime] ?? (isPdf ? "pdf" : "jpg");
      const dedupeId = inboundAttachmentKey(dossier.id, messageKey, fileBuffer);
      const { data: existing } = await supabase
        .from("receipts")
        .select("id")
        .eq("email_message_id", dedupeId)
        .maybeSingle();
      if (existing) {
        skipped++;
        continue;
      }

      const storagePath = `${dossier.fiduciaire_user_id}/${dossier.id}/email-${Date.now()}-${crypto.randomUUID()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("receipts")
        .upload(storagePath, fileBuffer, { contentType: mime, upsert: false });

      if (uploadErr) {
        console.error("[inbound] Upload error:", uploadErr.message);
        failures.push(`upload:${originalName}`);
        continue;
      }

      // OCR extraction
      let ocrData: Record<string, unknown> = {};
      try {
        ocrData = await extractWithFallback(fileBuffer, mime);
        if (typeof ocrData.amount === "number") {
          ocrData.type = ocrData.amount >= 0 ? "income" : "expense";
        }
      } catch {
        // OCR failed — user fills manually
      }

      // Attach email metadata
      ocrData.email_import_id = dedupeId;
      ocrData.email_from = safeFrom;
      ocrData.email_subject = safeSubject;
      ocrData.email_provider = "inbound";

      // Fall back to sender display name if OCR didn't find a vendor
      if (!ocrData.vendor_name) {
        const displayName = safeFrom.split("<")[0]?.trim().replace(/^"(.*)"$/, "$1");
        if (displayName) ocrData.vendor_name = displayName;
      }

      const { error: dbErr } = await supabase.from("receipts").insert({
        user_id: dossier.fiduciaire_user_id,
        dossier_id: dossier.id,
        storage_path: storagePath,
        file_name: originalName,
        mime_type: mime,
        status: "pending",
        email_message_id: dedupeId,
        ocr_data: ocrData,
      });

      if (dbErr) {
        await supabase.storage.from("receipts").remove([storagePath]).catch(() => undefined);
        if (dbErr.code === "23505") {
          skipped++;
          continue;
        }
        console.error("[inbound] DB error:", dbErr.message);
        failures.push(`database:${originalName}`);
      } else {
        processed++;
        try {
          await incrementUploadCount(company.id, dossier.fiduciaire_user_id, {
            fileName: originalName,
            fileType: mime,
            source: "email_inbound",
          });
        } catch (usageError) {
          console.error("[inbound] Usage increment failed", usageError);
        }
        console.log(`[inbound] Imported to ${dossier.raison_sociale}: ${originalName}`);
      }
    }

    return Response.json({
      received: true,
      routed: true,
      dossier: dossier.raison_sociale,
      processed,
      skipped,
      quota_exhausted: quotaExhausted,
      attachments: attachments.length,
      supportedAttachments,
      failures,
    });
  } catch (err: any) {
    console.error("[inbound] Error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
