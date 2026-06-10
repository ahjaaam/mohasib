import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = req.nextUrl.searchParams.get("token");
    if (!token) return NextResponse.json({ error: "Lien invalide" }, { status: 404 });
    const body = await req.json().catch(() => ({}));
    const reason: string | null = body.reason ?? null;

    const { data: devis, error: fetchErr } = await supabase
      .from("invoices")
      .select("id, invoice_type, devis_status")
      .eq("id", id)
      .eq("devis_response_token", token)
      .single();

    if (fetchErr || !devis) {
      return NextResponse.json({ error: "Devis introuvable" }, { status: 404 });
    }
    if (devis.invoice_type !== "devis") {
      return NextResponse.json({ error: "Ce document n'est pas un devis" }, { status: 400 });
    }

    const { error } = await supabase
      .from("invoices")
      .update({
        devis_status: "refusé",
        devis_refused_at: new Date().toISOString(),
        ...(reason ? { devis_refused_reason: reason } : {}),
      })
      .eq("id", id)
      .eq("devis_response_token", token);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
