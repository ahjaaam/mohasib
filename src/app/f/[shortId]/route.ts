import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateInvoicePDF } from "@/lib/pdf/generateInvoicePDF";
import sizeOf from "image-size";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ shortId: string }> }
) {
  try {
    const { shortId } = await params;

    const { data: inv, error: invErr } = await supabase
      .from("invoices")
      .select("*, clients(*)")
      .like("id", `${shortId}%`)
      .single();

    if (invErr || !inv) {
      console.error("[public invoice] lookup failed", { shortId, invErr });
      return new NextResponse("Facture introuvable.", {
        status: 404,
        headers: { "Content-Type": "text/plain" },
      });
    }

    const { data: company } = await supabase
      .from("companies")
      .select("*")
      .eq("user_id", inv.user_id)
      .single();

    // Fetch logo as base64
    let logoBase64: string | null = null;
    let logoMimeType: string | null = null;
    let logoWidthPx: number | null = null;
    let logoHeightPx: number | null = null;

    if (company?.logo_url) {
      try {
        const res = await fetch(company.logo_url);
        if (res.ok) {
          const buffer = Buffer.from(await res.arrayBuffer());
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

    const client = inv.clients ?? null;
    const generatedAt = new Date().toLocaleDateString("fr-MA", {
      day: "2-digit", month: "2-digit", year: "numeric",
    });

    const arrayBuffer = generateInvoicePDF({
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
      company: company
        ? { ...company, logoBase64, logoMimeType, logoWidthPx, logoHeightPx }
        : null,
      generatedAt,
    });

    const clientName = client?.name
      ? client.name.replace(/[^a-zA-Z0-9À-ɏ\s-]/g, "").trim().replace(/\s+/g, "-")
      : "Client";
    const filename = `Facture-${inv.invoice_number}-${clientName}.pdf`;

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    console.error("[public invoice]", err);
    return new NextResponse("Erreur interne.", {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    });
  }
}
