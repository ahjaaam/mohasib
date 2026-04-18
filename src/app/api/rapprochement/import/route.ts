import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface ImportLine {
  date: string;
  description: string;
  reference?: string | null;
  amount: number;
  balance_after?: number | null;
}

interface ImportBody {
  bank_name?: string;
  account_number?: string;
  period_start?: string;
  period_end?: string;
  opening_balance?: number;
  closing_balance?: number;
  file_name?: string;
  company_id?: string | null;
  lines: ImportLine[];
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body: ImportBody = await req.json();

    if (!body.lines?.length) {
      return NextResponse.json({ error: "Aucune ligne à importer" }, { status: 400 });
    }

    // Create statement record
    const { data: stmt, error: stmtErr } = await supabase
      .from("bank_statements")
      .insert({
        user_id: user.id,
        company_id: body.company_id ?? null,
        bank_name: body.bank_name || null,
        account_number: body.account_number || null,
        period_start: body.period_start || null,
        period_end: body.period_end || null,
        opening_balance: body.opening_balance ?? 0,
        closing_balance: body.closing_balance ?? 0,
        file_name: body.file_name || null,
        status: "pending",
      })
      .select()
      .single();

    if (stmtErr || !stmt) {
      return NextResponse.json({ error: stmtErr?.message ?? "Erreur création relevé" }, { status: 500 });
    }

    // Build line records
    const lineRecords = body.lines
      .filter(l => l.date && l.amount !== 0)
      .map(l => ({
        statement_id: stmt.id,
        company_id: body.company_id ?? null,
        date: l.date,
        description: l.description || "Transaction",
        reference: l.reference ?? null,
        amount: l.amount,
        balance_after: l.balance_after ?? null,
        status: "unmatched",
      }));

    if (!lineRecords.length) {
      await supabase.from("bank_statements").delete().eq("id", stmt.id);
      return NextResponse.json({ error: "Aucune ligne valide à importer" }, { status: 400 });
    }

    const { error: linesErr } = await supabase.from("bank_statement_lines").insert(lineRecords);
    if (linesErr) {
      await supabase.from("bank_statements").delete().eq("id", stmt.id);
      return NextResponse.json({ error: linesErr.message }, { status: 500 });
    }

    return NextResponse.json({
      statement_id: stmt.id,
      lines_imported: lineRecords.length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
