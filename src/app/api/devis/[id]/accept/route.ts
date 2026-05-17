import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: devis, error: fetchErr } = await supabase
      .from("invoices")
      .select("id, invoice_type, devis_status")
      .eq("id", id)
      .single();

    if (fetchErr || !devis) {
      return NextResponse.json({ error: "Devis introuvable" }, { status: 404 });
    }
    if (devis.invoice_type !== "devis") {
      return NextResponse.json({ error: "Ce document n'est pas un devis" }, { status: 400 });
    }
    if (devis.devis_status === "accepté") {
      return NextResponse.json({ error: "Ce devis est déjà accepté" }, { status: 409 });
    }

    const { error } = await supabase
      .from("invoices")
      .update({
        devis_status: "accepté",
        devis_accepted_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
