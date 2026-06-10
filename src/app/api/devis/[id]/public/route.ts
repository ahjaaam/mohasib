import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = req.nextUrl.searchParams.get("token");
    if (!token) return NextResponse.json({ error: "Lien invalide" }, { status: 404 });

    const { data: devis, error } = await supabase
      .from("invoices")
      .select("*, clients(name, city)")
      .eq("id", id)
      .eq("invoice_type", "devis")
      .eq("devis_response_token", token)
      .single();

    if (error || !devis) {
      return NextResponse.json({ error: "Devis introuvable" }, { status: 404 });
    }

    const { data: company } = await supabase
      .from("companies")
      .select("raison_sociale, phone, email, city")
      .eq("user_id", devis.user_id)
      .single();

    return NextResponse.json({
      invoice_number: devis.invoice_number,
      devis_objet: devis.devis_objet ?? null,
      devis_expiry_date: devis.devis_expiry_date ?? null,
      devis_status: devis.devis_status ?? "brouillon",
      devis_conditions: devis.devis_conditions ?? null,
      subtotal: Number(devis.subtotal),
      tax_amount: Number(devis.tax_amount),
      tax_rate: Number(devis.tax_rate),
      total: Number(devis.total),
      issue_date: devis.issue_date,
      items: devis.items ?? [],
      clients: devis.clients ?? null,
      company: company ?? null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
