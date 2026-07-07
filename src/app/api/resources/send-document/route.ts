import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { checkRateLimit, getClientIp, tooManyRequests } from "@/lib/rate-limit";
import { client, hasSanityConfig } from "@/lib/sanity";
import { marketingUrl } from "@/lib/public-urls";

const EMAIL_LIMIT = 8;
const EMAIL_OPTS = { maxAttempts: EMAIL_LIMIT, windowMs: 60 * 60_000, blockMs: 60 * 60_000 };
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

type ResourceDocument = {
  _id: string;
  title: string;
  slug?: { current?: string } | string;
  fileUrl?: string | null;
};

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function slugValue(slug: ResourceDocument["slug"]) {
  return typeof slug === "string" ? slug : slug?.current ?? null;
}

function isSafeDownloadUrl(value?: string | null) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const rateLimit = await checkRateLimit(getClientIp(req), "resources/send-document", EMAIL_OPTS);
  if (!rateLimit.allowed) {
    return tooManyRequests(rateLimit, EMAIL_LIMIT, "Trop de demandes. Réessayez dans 1 heure.");
  }

  try {
    if (!resend) {
      return NextResponse.json({ error: "EMAIL_NOT_CONFIGURED" }, { status: 503 });
    }
    if (!hasSanityConfig) {
      return NextResponse.json({ error: "SANITY_NOT_CONFIGURED" }, { status: 503 });
    }

    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const resourceId = typeof body.resourceId === "string" ? body.resourceId.trim() : "";

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "INVALID_EMAIL" }, { status: 422 });
    }
    if (!resourceId) {
      return NextResponse.json({ error: "MISSING_RESOURCE" }, { status: 422 });
    }

    const document = await client.withConfig({ useCdn: false }).fetch<ResourceDocument | null>(
      `*[_type == "guide" && active == true && _id == $resourceId][0] {
        _id,
        title,
        slug,
        "fileUrl": coalesce(fileUrl, downloadFile.asset->url, file.asset->url, pdf.asset->url)
      }`,
      { resourceId },
    );

    if (!document) {
      return NextResponse.json({ error: "RESOURCE_NOT_FOUND" }, { status: 404 });
    }
    if (!isSafeDownloadUrl(document.fileUrl)) {
      return NextResponse.json({ error: "RESOURCE_FILE_MISSING" }, { status: 422 });
    }

    const pageUrl = marketingUrl(`/ressources/documents/${encodeURIComponent(slugValue(document.slug) ?? document._id)}`);
    const title = document.title || "Votre document";
    const escapedTitle = escapeHtml(title);
    const escapedFileUrl = escapeHtml(document.fileUrl!);
    const escapedPageUrl = escapeHtml(pageUrl);

    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "Mohasib <noreply@mohasibai.com>",
      to: email,
      subject: `Votre document Mohasib AI : ${title}`,
      html: `
        <div style="font-family:Inter,Arial,sans-serif;background:#F8F8F5;padding:24px;">
          <div style="max-width:580px;margin:0 auto;background:#FFFFFF;border:1px solid rgba(0,0,0,0.08);border-radius:16px;padding:28px;">
            <p style="margin:0 0 8px;color:#C8924A;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">Mohasib AI</p>
            <h1 style="margin:0 0 14px;color:#0D1526;font-size:24px;line-height:1.3;">Voici votre document</h1>
            <p style="margin:0 0 18px;color:#4B5563;font-size:14px;line-height:1.7;">
              Bonjour,<br />
              Voici le document demandé : <strong>${escapedTitle}</strong>.
            </p>
            <p style="margin:24px 0;">
              <a href="${escapedFileUrl}" style="display:inline-block;background:#C8924A;color:#FFFFFF;text-decoration:none;border-radius:10px;padding:13px 18px;font-size:14px;font-weight:700;">
                Télécharger le document
              </a>
            </p>
            <p style="margin:18px 0 0;color:#6B7280;font-size:13px;line-height:1.7;">
              Vous pouvez aussi retrouver la page ici :
              <a href="${escapedPageUrl}" style="color:#C8924A;font-weight:700;">${escapedPageUrl}</a>
            </p>
            <hr style="border:none;border-top:1px solid rgba(0,0,0,0.08);margin:24px 0;" />
            <p style="margin:0;color:#9CA3AF;font-size:12px;line-height:1.6;">
              Vous recevez cet email car vous avez demandé ce document sur Mohasib AI.
            </p>
          </div>
        </div>
      `,
      text: `Bonjour,\n\nVoici le document demandé : ${title}\n\nTélécharger : ${document.fileUrl}\nPage : ${pageUrl}\n\nVous recevez cet email car vous avez demandé ce document sur Mohasib AI.`,
    });

    if (error || !data?.id) {
      console.error("[resources/send-document] Resend rejected message", error);
      return NextResponse.json({ error: "EMAIL_SEND_FAILED" }, { status: 502 });
    }

    return NextResponse.json({ ok: true, emailId: data.id });
  } catch (error) {
    console.error("[resources/send-document] Failed", error);
    return NextResponse.json({ error: "EMAIL_SEND_FAILED" }, { status: 500 });
  }
}
