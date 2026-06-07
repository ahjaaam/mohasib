import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recomputeRapprochementSession } from "@/lib/rapprochement-api";

export async function POST(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await params;
    const { bankLineId, ecritureId } = await req.json();
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!bankLineId || !ecritureId) return NextResponse.json({ error: "bankLineId and ecritureId required" }, { status: 400 });

    const { data: ecriture } = await supabase
      .from("ecritures_comptables")
      .select("id, source_id, source_type")
      .eq("id", ecritureId)
      .single();

    const { error } = await supabase
      .from("rapprochement_lignes")
      .update({
        ecriture_id: ecritureId,
        transaction_id: ecriture?.source_type === "bank" ? ecriture.source_id : null,
        invoice_id: ecriture?.source_type === "invoice" ? ecriture.source_id : null,
        statut: "rapproché",
        match_confidence: 1,
        match_method: "manuel",
        matched_at: new Date().toISOString(),
        matched_by: "user",
      })
      .eq("id", bankLineId)
      .eq("session_id", sessionId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await recomputeRapprochementSession(supabase, sessionId);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
