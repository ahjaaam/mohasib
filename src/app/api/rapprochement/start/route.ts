import { NextRequest, NextResponse } from "next/server";
import { autoMatch, type BankLine, type Ecriture } from "@/lib/rapprochement-engine";
import { getRapprochementContext, recomputeRapprochementSession } from "@/lib/rapprochement-api";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const periodeDebut = body.periodeDebut;
    const periodeFin = body.periodeFin;
    const soldeInitial = Number(body.soldeBancaireInitial ?? 0);
    const soldeFinal = Number(body.soldeBancaireFinal ?? 0);
    const { supabase, user, companyId, dossierId, error } = await getRapprochementContext(body.companyId, body.dossierId);

    if (!user) return NextResponse.json({ error }, { status: 401 });
    if (error) return NextResponse.json({ error }, { status: 404 });
    if (!periodeDebut || !periodeFin) return NextResponse.json({ error: "Période requise" }, { status: 400 });
    if (!companyId && !dossierId) return NextResponse.json({ error: "Aucune société trouvée" }, { status: 400 });

    let bankLines: BankLine[] = [];

    if (companyId) {
      const { data: importedLines } = await supabase
        .from("bank_statement_lines")
        .select("id, date, description, reference, amount")
        .eq("company_id", companyId)
        .gte("date", periodeDebut)
        .lte("date", periodeFin)
        .order("date", { ascending: true });
      bankLines = (importedLines ?? []).map((line: any) => ({
        id: line.id,
        date: line.date,
        description: line.description ?? "Mouvement bancaire",
        reference: line.reference,
        amount: Number(line.amount ?? 0),
      }));
    }

    if (!bankLines.length) {
      let transactionQuery = supabase
        .from("transactions")
        .select("id, date, description, amount")
        .gte("date", periodeDebut)
        .lte("date", periodeFin)
        .order("date", { ascending: true });
      transactionQuery = dossierId
        ? transactionQuery.eq("dossier_id", dossierId)
        : transactionQuery.eq("user_id", user.id).is("dossier_id", null);
      const { data: txs } = await transactionQuery;
      bankLines = (txs ?? []).map((tx: any) => ({
        id: tx.id,
        date: tx.date,
        description: tx.description ?? "Transaction bancaire",
        amount: Number(tx.amount ?? 0),
      }));
    }

    const { data: ecrituresRaw } = dossierId
      ? await supabase.from("dossier_ecritures")
          .select("id, date, compte_cgnc, libelle, debit, credit")
          .eq("dossier_id", dossierId).eq("compte_cgnc", "5141")
          .gte("date", periodeDebut).lte("date", periodeFin).order("date")
      : await supabase.from("ecritures_comptables")
          .select("id, date_ecriture, compte, libelle, debit, credit, source_id, source_type")
          .eq("company_id", companyId).eq("compte", "5141")
          .gte("date_ecriture", periodeDebut).lte("date_ecriture", periodeFin).order("date_ecriture");

    const ecritures: Ecriture[] = (ecrituresRaw ?? []).map((entry: any) => ({
      id: entry.id,
      date_ecriture: entry.date_ecriture ?? entry.date,
      compte: entry.compte ?? entry.compte_cgnc,
      libelle: entry.libelle,
      debit: Number(entry.debit ?? 0),
      credit: Number(entry.credit ?? 0),
      transaction_id: entry.source_type === "bank" ? entry.source_id : null,
      invoice_id: entry.source_type === "invoice" ? entry.source_id : null,
    }));

    const { data: openingRows } = dossierId
      ? await supabase.from("dossier_ecritures").select("debit,credit")
          .eq("dossier_id", dossierId).eq("compte_cgnc", "5141").lt("date", periodeDebut)
      : await supabase.from("ecritures_comptables").select("debit,credit")
          .eq("company_id", companyId).eq("compte", "5141").lt("date_ecriture", periodeDebut);
    const soldeInitialComptable = (openingRows ?? []).reduce(
      (sum: number, entry: any) => sum + Number(entry.debit ?? 0) - Number(entry.credit ?? 0), 0
    );

    const { data: session, error: sessionError } = await supabase
      .from("rapprochement_sessions")
      .insert({
        company_id: companyId,
        dossier_id: dossierId,
        user_id: user.id,
        periode_debut: periodeDebut,
        periode_fin: periodeFin,
        solde_initial_banque: soldeInitial,
        solde_final_banque: soldeFinal,
        solde_initial_comptable: soldeInitialComptable,
        solde_final_comptable: soldeInitialComptable,
        ecart: soldeFinal - soldeInitialComptable,
        is_balanced: false,
      })
      .select()
      .single();

    if (sessionError || !session) return NextResponse.json({ error: sessionError?.message ?? "Erreur session" }, { status: 500 });

    const matches = await autoMatch(session.id, bankLines, ecritures);
    if (matches.length) {
      const records = matches.map((match) => ({
        session_id: session.id,
        bank_line_id: match.bankLine.id && companyId ? match.bankLine.id : null,
        bank_date: match.bankLine.date,
        bank_description: match.bankLine.description,
        bank_amount: match.bankLine.amount,
        bank_reference: match.bankLine.reference ?? null,
        ecriture_id: dossierId ? null : match.ecriture?.id ?? null,
        dossier_ecriture_id: dossierId ? match.ecriture?.id ?? null : null,
        transaction_id: match.ecriture?.transaction_id ?? null,
        invoice_id: match.ecriture?.invoice_id ?? null,
        statut: match.method === "auto" ? "rapproché" : match.method === "suggestion" ? "en_attente" : "non_rapproché",
        match_confidence: match.confidence,
        match_method: match.method,
        matched_at: match.method === "auto" ? new Date().toISOString() : null,
        matched_by: match.method === "auto" ? "auto" : null,
      }));
      await supabase.from("rapprochement_lignes").insert(records);
    }

    await recomputeRapprochementSession(supabase, session.id);

    return NextResponse.json({ sessionId: session.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
