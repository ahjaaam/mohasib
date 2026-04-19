import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateInvoicePDF } from "@/lib/pdf/generateInvoicePDF";
import { Resend } from "resend";
import sizeOf from "image-size";

const resend = new Resend(process.env.RESEND_API_KEY);

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-MA", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtAmount(n: number) {
  return n.toLocaleString("fr-MA", { minimumFractionDigits: 2 }) + " MAD";
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: inv, error: invErr } = await supabase
      .from("invoices")
      .select("*, clients(*)")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (invErr || !inv) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

    const client = inv.clients as any;
    if (!client?.email) {
      return NextResponse.json({ error: "NO_EMAIL", message: "Ce client n'a pas d'email enregistré" }, { status: 422 });
    }

    const { data: company } = await supabase
      .from("companies")
      .select("*")
      .eq("user_id", user.id)
      .single();

    // Build PDF
    let logoBase64: string | null = null;
    let logoMimeType: string | null = null;
    let logoWidthPx: number | null = null;
    let logoHeightPx: number | null = null;

    if (company?.logo_url) {
      try {
        const res = await fetch(company.logo_url);
        if (res.ok) {
          const buf = await res.arrayBuffer();
          const buffer = Buffer.from(buf);
          logoBase64 = buffer.toString("base64");
          logoMimeType = res.headers.get("content-type") ?? "image/png";
          try {
            const dims = sizeOf(buffer);
            if (dims.width && dims.height) {
              const ratio = Math.min(180 / dims.width, 80 / dims.height, 1);
              logoWidthPx = Math.round(dims.width * ratio);
              logoHeightPx = Math.round(dims.height * ratio);
            }
          } catch {}
        }
      } catch {}
    }

    const generatedAt = new Date().toLocaleDateString("fr-MA", {
      day: "2-digit", month: "2-digit", year: "numeric",
    });

    const pdfInput = {
      invoice: {
        invoice_number: inv.invoice_number,
        issue_date: inv.issue_date,
        due_date: inv.due_date ?? null,
        subtotal: Number(inv.subtotal),
        tax_rate: Number(inv.tax_rate),
        tax_amount: Number(inv.tax_amount),
        total: Number(inv.total),
        notes: inv.notes ?? null,
        items: (inv.items ?? []) as any[],
      },
      client,
      company: company ? { ...company, logoBase64, logoMimeType, logoWidthPx, logoHeightPx } : null,
      generatedAt,
    };

    const pdfArrayBuffer = generateInvoicePDF(pdfInput);
    const pdfBuffer = Buffer.from(pdfArrayBuffer);

    const companyName = company?.raison_sociale ?? "Mohasib";
    const clientName = client.name ?? "Client";
    const safeClientName = clientName.replace(/[^a-zA-Z0-9\u00C0-\u024F\s-]/g, "").trim().replace(/\s+/g, "-");
    const filename = `Facture-${inv.invoice_number}-${safeClientName}.pdf`;

    const emailHtml = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8" /></head>
<body style="font-family: Arial, sans-serif; color: #1A1A2E; max-width: 600px; margin: 0 auto; padding: 32px 24px;">
  <p style="margin: 0 0 20px;">Bonjour ${clientName},</p>
  <p style="margin: 0 0 20px;">
    Veuillez trouver ci-joint votre facture <strong>${inv.invoice_number}</strong>
    d'un montant de <strong>${fmtAmount(Number(inv.total))}</strong>.
  </p>
  ${inv.due_date ? `<p style="margin: 0 0 20px;">Date d'échéance : <strong>${fmtDate(inv.due_date)}</strong></p>` : ""}
  <p style="margin: 0 0 32px;">Pour toute question, n'hésitez pas à nous contacter.</p>
  <p style="margin: 0 0 4px;">Cordialement,</p>
  <p style="margin: 0 0 4px; font-weight: 600;">${companyName}</p>
  ${company?.phone ? `<p style="margin: 0 0 4px; color: #6B7280;">${company.phone}</p>` : ""}
  ${company?.email ? `<p style="margin: 0; color: #6B7280;">${company.email}</p>` : ""}
  <hr style="margin: 32px 0; border: none; border-top: 1px solid #E5E7EB;" />
  <p style="margin: 0; font-size: 11px; color: #9CA3AF;">
    Facture générée via <a href="https://mohasibai.com" style="color: #C8924A; text-decoration: none;">Mohasib AI</a> — mohasibai.com
  </p>
</body>
</html>`;

    await resend.emails.send({
      from: `${companyName} via Mohasib AI <noreply@mohasibai.com>`,
      to: client.email,
      subject: `Facture ${inv.invoice_number} — ${companyName}`,
      html: emailHtml,
      attachments: [{ filename, content: pdfBuffer }],
    });

    // Update invoice email tracking
    const currentCount = Number((inv as any).email_sent_count ?? 0);
    await supabase.from("invoices").update({
      email_sent_at: new Date().toISOString(),
      email_sent_count: currentCount + 1,
    }).eq("id", id);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    console.error("[send-email]", msg, err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
