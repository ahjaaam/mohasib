export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";
import { simpleParser } from "mailparser";
import { extractWithFallback } from "@/lib/ocr-engine";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export async function POST(request: Request) {
  try {
    const workerSecret = request.headers.get("X-Worker-Secret");
    if (workerSecret !== process.env.WORKER_SECRET) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { to, from, subject, raw } = body as {
      to: string;
      from: string;
      subject: string;
      raw: string;
    };

    const rawTo = Array.isArray(to) ? to[0] : to;
    const recipientEmail = (rawTo.match(/<([^>]+)>/) ?? [])[1]?.toLowerCase()
      ?? rawTo.toLowerCase().trim();

    console.log("[inbound]", { to: recipientEmail, from, subject });

    // Only process dedicated dossier addresses (factures-XXXXXX@mohasibai.com).
    // Anything else is silently acknowledged — never write to receipts.
    const isDossierEmail =
      /^factures-[a-z0-9]+@mohasibai\.com$/.test(recipientEmail);

    if (!isDossierEmail) {
      console.log("[inbound] Not a dossier address, ignoring:", recipientEmail);
      return Response.json({ received: true, routed: false, reason: "Not a dossier address" });
    }

    const parsed = await simpleParser(raw);

    const { data: dossier } = await supabase
      .from("dossiers")
      .select("id, fiduciaire_user_id, raison_sociale")
      .ilike("inbox_email", recipientEmail)
      .single();

    if (!dossier) {
      console.log("[inbound] No dossier for:", recipientEmail);
      return Response.json({ received: true, routed: false, reason: "No dossier found" });
    }

    const attachments = parsed.attachments ?? [];
    let processed = 0;
    let supportedAttachments = 0;
    const failures: string[] = [];

    for (const attachment of attachments) {
      const mime: string = attachment.contentType ?? "application/octet-stream";
      const isPdf = mime === "application/pdf" || attachment.filename?.toLowerCase().endsWith(".pdf");
      const isImage = mime.startsWith("image/");
      if (!isPdf && !isImage) continue;
      supportedAttachments++;

      const fileBuffer = attachment.content as Buffer;
      const originalName = attachment.filename ?? `attachment-${Date.now()}`;
      const ext = originalName.split(".").pop()?.toLowerCase() ?? (isPdf ? "pdf" : "jpg");
      const storagePath = `${dossier.fiduciaire_user_id}/${dossier.id}/email-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

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
      ocrData.email_from = from ?? "";
      ocrData.email_subject = subject ?? "";
      ocrData.email_provider = "inbound";

      // Fall back to sender display name if OCR didn't find a vendor
      if (!ocrData.vendor_name) {
        const displayName = from?.split("<")[0]?.trim().replace(/^"(.*)"$/, "$1");
        if (displayName) ocrData.vendor_name = displayName;
      }

      const { error: dbErr } = await supabase.from("receipts").insert({
        user_id: dossier.fiduciaire_user_id,
        dossier_id: dossier.id,
        storage_path: storagePath,
        file_name: originalName,
        mime_type: mime,
        status: "pending",
        ocr_data: ocrData,
      });

      if (dbErr) {
        console.error("[inbound] DB error:", dbErr.message);
        failures.push(`database:${originalName}`);
      } else {
        processed++;
        console.log(`[inbound] Imported to ${dossier.raison_sociale}: ${originalName}`);
      }
    }

    return Response.json({
      received: true,
      routed: true,
      dossier: dossier.raison_sociale,
      processed,
      attachments: attachments.length,
      supportedAttachments,
      failures,
    });
  } catch (err: any) {
    console.error("[inbound] Error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
