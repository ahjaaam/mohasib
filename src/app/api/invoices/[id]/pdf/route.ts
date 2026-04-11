import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateInvoicePDF } from "@/lib/pdf/generateInvoicePDF";

async function buildInput(inv: any, company: any) {
  const client = inv.clients ?? null;

  // Fetch logo as base64 if available
  let logoBase64: string | null = null;
  let logoMimeType: string | null = null;
  if (company?.logo_url) {
    try {
      const res = await fetch(company.logo_url);
      if (res.ok) {
        const buf = await res.arrayBuffer();
        logoBase64 = Buffer.from(buf).toString("base64");
        logoMimeType = res.headers.get("content-type") ?? "image/png";
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
      company: company ? { ...company, logoBase64, logoMimeType } : null,
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

    const { data: company } = await supabase
      .from("companies")
      .select("*")
      .eq("user_id", user.id)
      .single();

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

    const { data: company } = await supabase
      .from("companies")
      .select("*")
      .eq("user_id", user.id)
      .single();

    const { input, client } = await buildInput(inv, company);
    const arrayBuffer = generateInvoicePDF(input);

    const storagePath = `${user.id}/${inv.invoice_number}-${Date.now()}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from("invoices-pdf")
      .upload(storagePath, new Uint8Array(arrayBuffer), {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

    const { data: { publicUrl } } = supabase.storage
      .from("invoices-pdf")
      .getPublicUrl(storagePath);

    const ttc = Number(inv.total).toLocaleString("fr-MA", { minimumFractionDigits: 2 });
    const clientPhone = client?.phone ? client.phone.replace(/\D/g, "") : null;
    const message = `Bonjour, veuillez trouver ci-joint votre facture ${inv.invoice_number} d'un montant de ${ttc} MAD.\nLien PDF : ${publicUrl}`;
    const whatsappUrl = clientPhone
      ? `https://wa.me/${clientPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    return NextResponse.json({ whatsappUrl, publicUrl });
  } catch (err: any) {
    console.error("[PDF POST]", err);
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
