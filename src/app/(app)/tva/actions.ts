"use server";

import { createClient } from "@/lib/supabase/server";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TVARateRow {
  rate: number;
  baseHT: number;
  tvaAmount: number;
}

export interface TVAExpenseRow {
  category: string;
  baseHT: number;
  rate: number;
  tvaAmount: number;
}

export interface TVAInvoiceDetail {
  id: string;
  invoice_number: string;
  client_name: string;
  issue_date: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
}

export interface TVAExpenseDetail {
  id: string;
  description: string;
  category: string;
  date: string;
  amount: number;
  tva_rate: number;
  tva_amount: number;
}

export interface TVAData {
  collectee: TVARateRow[];
  deductible: TVAExpenseRow[];
  totalCollectee: number;
  totalDeductible: number;
  totalNette: number;
  invoices: TVAInvoiceDetail[];
  expenses: TVAExpenseDetail[];
}

export interface TVADeclaration {
  id: string;
  period_label: string;
  period_start: string;
  period_end: string;
  regime: string;
  tva_collectee: number;
  tva_deductible: number;
  tva_nette: number;
  status: string;
  filed_at: string | null;
  created_at: string;
}

// ─── Fetch TVA data for a period ─────────────────────────────────────────────

export async function fetchTVAData(
  periodStart: string,
  periodEnd: string
): Promise<{ data?: TVAData; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié" };

  const [invRes, expRes] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, invoice_number, subtotal, tax_rate, tax_amount, total, issue_date, items, clients(name)")
      .eq("user_id", user.id)
      .not("status", "in", '("draft","cancelled")')
      .gte("issue_date", periodStart)
      .lte("issue_date", periodEnd)
      .order("issue_date", { ascending: true }),
    supabase
      .from("transactions")
      .select("id, description, category, date, amount, tva_rate")
      .eq("user_id", user.id)
      .eq("type", "expense")
      .neq("category", "Charges sociales")
      .gte("date", periodStart)
      .lte("date", periodEnd)
      .order("date", { ascending: true }),
  ]);

  if (invRes.error) return { error: invRes.error.message };

  // ── TVA Collectée ──────────────────────────────────────────────────────────
  const collecteeMap = new Map<number, { baseHT: number; tvaAmount: number }>();
  const invoiceDetails: TVAInvoiceDetail[] = [];

  for (const inv of invRes.data ?? []) {
    const items = (inv.items ?? []) as any[];
    const hasItemRates = items.some((it: any) => it.tva_rate != null);

    if (hasItemRates && items.length > 0) {
      for (const it of items) {
        const rate = Number(it.tva_rate ?? inv.tax_rate ?? 20);
        const baseHT = Number(it.amount ?? 0);
        const tva = baseHT * rate / 100;
        const prev = collecteeMap.get(rate) ?? { baseHT: 0, tvaAmount: 0 };
        collecteeMap.set(rate, { baseHT: prev.baseHT + baseHT, tvaAmount: prev.tvaAmount + tva });
      }
    } else {
      const rate = Number(inv.tax_rate ?? 20);
      const baseHT = Number(inv.subtotal ?? 0);
      const tva = Number(inv.tax_amount ?? 0);
      const prev = collecteeMap.get(rate) ?? { baseHT: 0, tvaAmount: 0 };
      collecteeMap.set(rate, { baseHT: prev.baseHT + baseHT, tvaAmount: prev.tvaAmount + tva });
    }

    invoiceDetails.push({
      id: inv.id,
      invoice_number: inv.invoice_number,
      client_name: (inv as any).clients?.name ?? "—",
      issue_date: inv.issue_date,
      subtotal: Number(inv.subtotal),
      tax_rate: Number(inv.tax_rate),
      tax_amount: Number(inv.tax_amount),
      total: Number(inv.total),
    });
  }

  const collectee: TVARateRow[] = Array.from(collecteeMap.entries())
    .map(([rate, v]) => ({ rate, baseHT: v.baseHT, tvaAmount: v.tvaAmount }))
    .sort((a, b) => b.rate - a.rate);

  // ── TVA Déductible ─────────────────────────────────────────────────────────
  const deductibleMap = new Map<string, { baseHT: number; rate: number; tvaAmount: number }>();
  const expenseDetails: TVAExpenseDetail[] = [];

  for (const exp of expRes.data ?? []) {
    const rate = Number((exp as any).tva_rate ?? 20);
    const baseHT = Number(exp.amount ?? 0);
    const tva = baseHT * rate / 100;
    const cat = exp.category || "Charges d'exploitation";
    const prev = deductibleMap.get(cat);
    if (prev) {
      deductibleMap.set(cat, { baseHT: prev.baseHT + baseHT, rate, tvaAmount: prev.tvaAmount + tva });
    } else {
      deductibleMap.set(cat, { baseHT, rate, tvaAmount: tva });
    }
    expenseDetails.push({
      id: exp.id,
      description: exp.description || "—",
      category: cat,
      date: exp.date,
      amount: baseHT,
      tva_rate: rate,
      tva_amount: tva,
    });
  }

  const deductible: TVAExpenseRow[] = Array.from(deductibleMap.entries()).map(
    ([category, v]) => ({ category, baseHT: v.baseHT, rate: v.rate, tvaAmount: v.tvaAmount })
  );

  const totalCollectee = collectee.reduce((s, r) => s + r.tvaAmount, 0);
  const totalDeductible = deductible.reduce((s, r) => s + r.tvaAmount, 0);
  const totalNette = totalCollectee - totalDeductible;

  return {
    data: { collectee, deductible, totalCollectee, totalDeductible, totalNette, invoices: invoiceDetails, expenses: expenseDetails },
  };
}

// ─── Mark declaration as filed ───────────────────────────────────────────────

export async function markAsFiled(params: {
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  regime: string;
  tvaCollectee: number;
  tvaDeductible: number;
  tvaNette: number;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié" };

  const { data: company } = await supabase
    .from("companies")
    .select("id")
    .eq("user_id", user.id)
    .single();

  try {
    await supabase.from("tva_declarations").upsert(
      {
        company_id: company?.id,
        user_id: user.id,
        period_start: params.periodStart,
        period_end: params.periodEnd,
        period_label: params.periodLabel,
        regime: params.regime,
        tva_collectee: params.tvaCollectee,
        tva_deductible: params.tvaDeductible,
        tva_nette: params.tvaNette,
        status: "filed",
        filed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,period_start,period_end", ignoreDuplicates: false }
    );
  } catch {
    // table may not exist yet
  }
  return {};
}

// ─── Fetch declaration history ────────────────────────────────────────────────

export async function fetchDeclarationHistory(): Promise<TVADeclaration[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  try {
    const { data } = await supabase
      .from("tva_declarations")
      .select("*")
      .eq("user_id", user.id)
      .order("period_start", { ascending: false })
      .limit(12);
    return (data ?? []) as TVADeclaration[];
  } catch {
    return [];
  }
}
