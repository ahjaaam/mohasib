import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { authorizePermission } from "@/lib/api-permissions";
import { requirePlanFeature } from "@/lib/api-plan";
import { resolveAccountOwnerId } from "@/lib/account-owner";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const permission = await authorizePermission("accounting", "create");
    if (permission.response) return permission.response;
    const plan = await requirePlanFeature("bank_import");
    if (plan.response) return plan.response;

    const { line_id, transaction_id, action } = await req.json();
    // action: "confirm" | "reject"

    if (!line_id || !action) {
      return NextResponse.json({ error: "line_id and action required" }, { status: 400 });
    }

    const ownerId = await resolveAccountOwnerId(user.id);

    // Verify the bank line belongs to one of the account owner's statements.
    const { data: line } = await supabase
      .from("bank_statement_lines")
      .select("id, transaction_id, statement_id, bank_statements!inner(user_id)")
      .eq("id", line_id)
      .eq("bank_statements.user_id", ownerId)
      .single();

    if (!line) return NextResponse.json({ error: "Line not found" }, { status: 404 });

    if (action === "confirm") {
      if (!transaction_id) {
        return NextResponse.json({ error: "transaction_id required for confirm" }, { status: 400 });
      }
      const { data: ownedTransaction } = await supabase
        .from("transactions")
        .select("id")
        .eq("id", transaction_id)
        .eq("user_id", ownerId)
        .maybeSingle();
      if (!ownedTransaction) {
        return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
      }

      // Mark line as matched
      await supabase.from("bank_statement_lines").update({
        status: "matched",
        transaction_id,
        matched_at: new Date().toISOString(),
        matched_by: "manual",
      }).eq("id", line_id).eq("statement_id", line.statement_id);

      // Mark transaction as reconciled
      await supabase.from("transactions").update({
        reconciled: true,
        reconciled_at: new Date().toISOString(),
        bank_line_id: line_id,
        reconciliation_status: "reconciled",
      }).eq("id", transaction_id).eq("user_id", ownerId);

      return NextResponse.json({ ok: true, status: "matched" });
    }

    if (action === "reject") {
      // Un-suggest the line, clear the suggestion
      const prevTxId = line.transaction_id;

      await supabase.from("bank_statement_lines").update({
        status: "unmatched",
        transaction_id: null,
        match_confidence: null,
        match_reason: null,
        matched_at: null,
        matched_by: null,
      }).eq("id", line_id).eq("statement_id", line.statement_id);

      // If the transaction was marked reconciled by suggestion, unmark it
      if (prevTxId) {
        const { data: tx } = await supabase
          .from("transactions")
          .select("reconciled, bank_line_id")
          .eq("id", prevTxId)
          .eq("user_id", ownerId)
          .single();

        if (tx?.bank_line_id === line_id) {
          await supabase.from("transactions").update({
            reconciled: false,
            reconciled_at: null,
            bank_line_id: null,
            reconciliation_status: "unreconciled",
          }).eq("id", prevTxId).eq("user_id", ownerId);
        }
      }

      return NextResponse.json({ ok: true, status: "unmatched" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
