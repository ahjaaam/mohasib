import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { findMatches } from "@/lib/reconciliation";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { statement_id } = await req.json();

    // Fetch statement + company
    const { data: stmt } = await supabase
      .from("bank_statements")
      .select("*")
      .eq("id", statement_id)
      .eq("user_id", user.id)
      .single();
    if (!stmt) return NextResponse.json({ error: "Statement not found" }, { status: 404 });

    // Fetch unmatched bank lines
    const { data: lines } = await supabase
      .from("bank_statement_lines")
      .select("*")
      .eq("statement_id", statement_id)
      .eq("status", "unmatched");

    if (!lines?.length) return NextResponse.json({ matched: 0, suggested: 0 });

    // Fetch unreconciled transactions within ±30 days of period
    const start = new Date(stmt.period_start);
    const end   = new Date(stmt.period_end);
    start.setDate(start.getDate() - 30);
    end.setDate(end.getDate() + 30);

    const { data: txs } = await supabase
      .from("transactions")
      .select("id, date, description, amount, category")
      .eq("user_id", user.id)
      .eq("reconciliation_status", "unreconciled")
      .gte("date", start.toISOString().split("T")[0])
      .lte("date", end.toISOString().split("T")[0]);

    // Fetch client names for rule 5
    const { data: clients } = await supabase
      .from("clients")
      .select("name")
      .eq("user_id", user.id);
    const clientNames = (clients ?? []).map((c: any) => c.name);

    let autoMatched = 0;
    let suggested   = 0;

    for (const line of lines) {
      const candidates = (txs ?? []).map((t: any) => ({
        id: t.id,
        date: t.date,
        description: t.description ?? "",
        amount: Number(t.amount),
        category: t.category,
      }));

      const matches = findMatches(line, candidates, clientNames);
      if (!matches.length) continue;

      const best = matches[0];

      if (best.confidence >= 0.95) {
        // Auto-reconcile
        await supabase.from("bank_statement_lines").update({
          status: "matched",
          transaction_id: best.transaction_id,
          match_confidence: best.confidence,
          match_reason: best.reason,
          matched_at: new Date().toISOString(),
          matched_by: "auto",
        }).eq("id", line.id);

        await supabase.from("transactions").update({
          reconciled: true,
          reconciled_at: new Date().toISOString(),
          bank_line_id: line.id,
          reconciliation_status: "reconciled",
        }).eq("id", best.transaction_id);

        autoMatched++;
      } else {
        // Save as suggestion
        await supabase.from("bank_statement_lines").update({
          status: "suggested",
          transaction_id: best.transaction_id,
          match_confidence: best.confidence,
          match_reason: best.reason,
        }).eq("id", line.id);

        suggested++;
      }
    }

    // Update statement status
    await supabase.from("bank_statements").update({
      status: autoMatched + suggested > 0 ? "reconciling" : "pending",
    }).eq("id", statement_id);

    return NextResponse.json({ matched: autoMatched, suggested });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
