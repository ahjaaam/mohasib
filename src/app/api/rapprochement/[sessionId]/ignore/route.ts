import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recomputeRapprochementSession } from "@/lib/rapprochement-api";

export async function POST(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await params;
    const { bankLineId } = await req.json();
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!bankLineId) return NextResponse.json({ error: "bankLineId required" }, { status: 400 });

    const { error } = await supabase
      .from("rapprochement_lignes")
      .update({ statut: "ignoré", matched_at: new Date().toISOString(), matched_by: "user" })
      .eq("id", bankLineId)
      .eq("session_id", sessionId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await recomputeRapprochementSession(supabase, sessionId);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
