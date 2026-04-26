import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateInvoicePDF } from "@/lib/pdf/generateInvoicePDF";
import sizeOf from "image-size";

async function buildInput(inv: any, company: any) {
  const client = inv.clients ?? null;

  // Fetch logo as base64 and compute proportional dimensions
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

        // Get natural dimensions and scale to fit max bounding box
        try {
          const dims = sizeOf(buffer);
          if (dims.width && dims.height) {
            const MAX_WIDTH = 180;
            const MAX_HEIGHT = 80;
            const ratio = Math.min(MAX_WIDTH / dims.width, MAX_HEIGHT / dims.height, 1);
            logoWidthPx = Math.round(dims.width * ratio);
            logoHeightPx = Math.round(dims.height * ratio);
          }
        } catch (sizeErr) {
          console.error("[PDF] image-size failed:", sizeErr);
        }
      }
    } catch {}
  }

  const generatedAt = new Date().toLocaleDateString("fr-MA", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });

  return {
    input: {
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
    },
    client,
  };
}

export async function GET(
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

    const { data: company, error: companyErr } = await supabase
      .from("companies")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (companyErr) console.error("[PDF GET] Company fetch error:", companyErr.message);
    console.log("[PDF GET] Company:", JSON.stringify({ raison_sociale: company?.raison_sociale, invoice_color: company?.invoice_color, logo_url: company?.logo_url }));

    const { input, client } = await buildInput(inv, company);
    const arrayBuffer = generateInvoicePDF(input);

    const clientName = client?.name
      ? client.name.replace(/[^a-zA-Z0-9\u00C0-\u024F\s-]/g, "").trim().replace(/\s+/g, "-")
      : "Client";
    const filename = `Facture-${inv.invoice_number}-${clientName}.pdf`;

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    console.error("[PDF GET]", err);
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}

function formatMoroccanPhone(raw: string): string {
  const clean = raw.replace(/[\s\-().+]/g, "");
  if (clean.startsWith("00212")) return "+212" + clean.slice(5);
  if (clean.startsWith("212")) return "+" + clean;
  if (clean.startsWith("0")) return "+212" + clean.slice(1);
  return "+" + clean;
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

    const { data: company, error: companyErr2 } = await supabase
      .from("companies")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (companyErr2) console.error("[PDF POST] Company fetch error:", companyErr2.message);
    console.log("[PDF POST] Company:", JSON.stringify({ raison_sociale: company?.raison_sociale, invoice_color: company?.invoice_color, logo_url: company?.logo_url }));

    const { input, client } = await buildInput(inv, company);
    const arrayBuffer = generateInvoicePDF(input);

    // Build share URL from short ID — no storage upload required for WhatsApp
    const shareUrl = `https://www.mohasibai.com/f/${id.substring(0, 8)}`;

    // Upload PDF to storage in the background — failures are silent and never block WhatsApp
    const storagePath = `${user.id}/${inv.invoice_number}.pdf`;
    supabase.storage
      .from("invoices-pdf")
      .upload(storagePath, new Uint8Array(arrayBuffer), { contentType: "application/pdf", upsert: true })
      .catch(() => {});

    // Build message
    const ttc = Number(inv.total).toLocaleString("fr-MA", { minimumFractionDigits: 2 });
    const clientName = client?.name ?? "";
    const companyName = company?.raison_sociale ?? "";
    const companyPhone = company?.phone ?? "";
    const dueDate = inv.due_date
      ? new Date(inv.due_date).toLocaleDateString("fr-MA", { day: "2-digit", month: "2-digit", year: "numeric" })
      : null;

    const lines = [
      `Bonjour ${clientName},`,
      "",
      `Veuillez trouver ci-joint votre facture *${inv.invoice_number}* d'un montant de *${ttc} MAD*.`,
      "",
      `📄 Télécharger la facture :`,
      shareUrl,
      ...(dueDate ? ["", `Date d'échéance : ${dueDate}`] : []),
      "",
      "Merci pour votre confiance.",
      ...(companyName ? [companyName] : []),
      ...(companyPhone ? [companyPhone] : []),
    ];
    const message = lines.join("\n");

    // Format phone number (prefer whatsapp field, fall back to phone)
    const rawPhone = (client as any)?.whatsapp || client?.phone || null;
    const formattedPhone = rawPhone ? formatMoroccanPhone(rawPhone) : null;
    const whatsappUrl = formattedPhone
      ? `https://wa.me/${formattedPhone.replace("+", "")}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    // Track send (graceful — columns may not exist yet)
    try {
      await supabase
        .from("invoices")
        .update({
          whatsapp_sent_at: new Date().toISOString(),
          whatsapp_sent_count: (Number(inv.whatsapp_sent_count ?? 0) + 1),
        })
        .eq("id", id);
    } catch { /* columns may not exist yet */ }

    return NextResponse.json({ whatsappUrl, publicUrl: shareUrl });
  } catch (err: any) {
    console.error("[PDF POST]", err);
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
