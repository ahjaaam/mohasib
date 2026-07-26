import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recomputeRapprochementSession } from "@/lib/rapprochement-api";
import { authorizePermission } from "@/lib/api-permissions";
import { requirePlanFeature } from "@/lib/api-plan";

export async function POST(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await params;
    const { bankLineId, ecritureId } = await req.json();
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const permission = await authorizePermission("accounting", "create");
    if (permission.response) return permission.response;
    const plan = await requirePlanFeature("bank_import");
    if (plan.response) return plan.response;
    if (!bankLineId || !ecritureId) return NextResponse.json({ error: "bankLineId and ecritureId required" }, { status: 400 });

    const { data: session } = await supabase
      .from("rapprochement_sessions")
      .select("company_id, dossier_id")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .single();
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    const { data: ecritureResult } = session?.dossier_id
      ? await supabase.from("dossier_ecritures").select("id").eq("id", ecritureId).eq("dossier_id", session.dossier_id).single()
      : await supabase.from("ecritures_comptables").select("id, source_id, source_type").eq("id", ecritureId).eq("company_id", session.company_id).single();
    const ecriture: any = ecritureResult;
    if (!ecriture) return NextResponse.json({ error: "Écriture introuvable" }, { status: 404 });

    const { error } = await supabase
      .from("rapprochement_lignes")
      .update({
        ecriture_id: session?.dossier_id ? null : ecritureId,
        dossier_ecriture_id: session?.dossier_id ? ecritureId : null,
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
