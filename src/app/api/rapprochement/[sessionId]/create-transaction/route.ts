import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recomputeRapprochementSession } from "@/lib/rapprochement-api";
import { authorizePermission } from "@/lib/api-permissions";

export async function POST(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await params;
    const { bankLineId, category, compte, description } = await req.json();
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const permission = await authorizePermission("accounting", "create");
    if (permission.response) return permission.response;
    if (!bankLineId) return NextResponse.json({ error: "bankLineId required" }, { status: 400 });

    const { data: line } = await supabase
      .from("rapprochement_lignes")
      .select("id, bank_date, bank_description, bank_amount, session_id")
      .eq("id", bankLineId)
      .eq("session_id", sessionId)
      .single();

    const { data: session } = await supabase
      .from("rapprochement_sessions")
      .select("id, company_id, dossier_id")
      .eq("id", sessionId)
      .single();

    if (!line || !session) return NextResponse.json({ error: "Line not found" }, { status: 404 });

    const amount = Number(line.bank_amount ?? 0);
    const type = amount >= 0 ? "income" : "expense";
    const label = description || line.bank_description || "Mouvement bancaire";

    const { data: transaction, error: txError } = await supabase
      .from("transactions")
      .insert({
        user_id: user.id,
        type,
        category: category || null,
        description: label,
        amount: Math.abs(amount),
        date: line.bank_date,
        payment_method: "bank_transfer",
        currency: "MAD",
        ...(session.dossier_id ? { dossier_id: session.dossier_id } : {}),
      })
      .select("id")
      .single();

    if (txError || !transaction) return NextResponse.json({ error: txError?.message ?? "Transaction error" }, { status: 500 });

    const { data: ecriture } = await supabase
      .from("ecritures_comptables")
      .insert({
        company_id: session.company_id,
        dossier_id: session.dossier_id,
        date_ecriture: line.bank_date,
        journal: "BQ",
        compte: compte || "5141",
        compte_label: "Banque",
        debit: amount > 0 ? Math.abs(amount) : 0,
        credit: amount < 0 ? Math.abs(amount) : 0,
        libelle: label,
        source_type: "bank",
        source_id: transaction.id,
        is_validated: true,
      })
      .select("id")
      .single();

    await supabase
      .from("rapprochement_lignes")
      .update({
        transaction_id: transaction.id,
        ecriture_id: ecriture?.id ?? null,
        statut: "rapproché",
        match_confidence: 1,
        match_method: "manuel",
        matched_at: new Date().toISOString(),
        matched_by: "user",
      })
      .eq("id", bankLineId)
      .eq("session_id", sessionId);

    await recomputeRapprochementSession(supabase, sessionId);
    return NextResponse.json({ ok: true, transactionId: transaction.id, ecritureId: ecriture?.id ?? null });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
