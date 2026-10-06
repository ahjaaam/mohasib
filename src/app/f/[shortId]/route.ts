import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateInvoicePDF } from "@/lib/pdf/generateInvoicePDF";
import { loadInvoiceLogo } from "@/lib/pdf/loadInvoiceLogo";
import { getInvoiceDocumentFilename } from "@/lib/pdf/document-label";
import { contentDisposition } from "../../../lib/content-disposition";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ shortId: string }> }
) {
  try {
    const { shortId: invoiceId } = await params;
    const token = req.nextUrl.searchParams.get("token");
    if (!token) {
      return new NextResponse("Facture introuvable.", { status: 404 });
    }

    const { data: inv, error: invErr } = await supabase
      .from("invoices")
      .select("*, clients(*)")
      .eq("id", invoiceId)
      .eq("devis_response_token", token)
      .single();

    if (invErr || !inv) {
      console.error("[public invoice] lookup failed", { invoiceId, code: invErr?.code, message: invErr?.message });
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

    const logo = await loadInvoiceLogo(company?.logo_url);

    const client = inv.clients ?? null;
    const generatedAt = new Date().toLocaleDateString("fr-MA", {
      day: "2-digit", month: "2-digit", year: "numeric",
    });

    const arrayBuffer = generateInvoicePDF({
      invoice: {
        invoice_number: inv.invoice_number,
        invoice_type: (inv as any).invoice_type ?? "facture",
        avoir_reason: (inv as any).avoir_reason ?? null,
        devis_objet: (inv as any).devis_objet ?? null,
        devis_expiry_date: (inv as any).devis_expiry_date ?? null,
        devis_conditions: (inv as any).devis_conditions ?? null,
        issue_date: inv.issue_date,
        due_date: inv.due_date ?? null,
        subtotal: Number(inv.subtotal),
        tax_rate: Number(inv.tax_rate),
        tax_amount: Number(inv.tax_amount),
        total: Number(inv.total),
        discount_type: inv.discount_type ?? null,
        discount_mode: inv.discount_mode ?? null,
        discount_value: Number(inv.discount_value ?? 0),
        discount_amount: Number(inv.discount_amount ?? 0),
        notes: inv.notes ?? null,
        items: (inv.items ?? []) as any[],
      },
      client,
      company: company ? { ...company, ...logo } : null,
      generatedAt,
    });

    const clientName = client?.name
      ? client.name.replace(/[^a-zA-Z0-9À-ɏ\s-]/g, "").trim().replace(/\s+/g, "-")
      : "Client";
    const filename = getInvoiceDocumentFilename(inv.invoice_type, inv.invoice_number, clientName);

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": contentDisposition("inline", filename, "Document.pdf"),
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
