import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveAccountOwnerId } from "@/lib/account-owner";
import { authorizePermission } from "@/lib/api-permissions";

function finiteNonNegative(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const ownerId = await resolveAccountOwnerId(user.id);
    const body = await request.json();
    const dossierId = typeof body.dossierId === "string" && body.dossierId ? body.dossierId : null;
    const permission = await authorizePermission("accounting", "create", { dossierId });
    if (permission.response) return permission.response;

    let companyId: string | null = null;
    if (dossierId) {
      const { data: dossier } = await supabase.from("dossiers").select("id").eq("id", dossierId).eq("fiduciaire_user_id", ownerId).single();
      if (!dossier) return NextResponse.json({ error: "Dossier introuvable" }, { status: 404 });
    } else {
      const { data: company } = await supabase.from("companies").select("id").eq("user_id", ownerId).single();
      if (!company) return NextResponse.json({ error: "Entreprise introuvable" }, { status: 404 });
      companyId = company.id;
    }
    const scope = { company_id: companyId, dossier_id: dossierId };

    if (body.action === "save_account") {
      const name = String(body.name ?? "").trim();
      const currentBalance = Number(body.currentBalance ?? 0);
      const overdraftLimit = finiteNonNegative(body.overdraftLimit);
      const financingLimit = finiteNonNegative(body.financingLimit);
      const financingUsed = finiteNonNegative(body.financingUsed);
      const annualRate = body.annualRate === "" || body.annualRate == null ? null : finiteNonNegative(body.annualRate);
      if (!name || !Number.isFinite(currentBalance) || overdraftLimit == null || financingLimit == null || financingUsed == null || (body.annualRate !== "" && body.annualRate != null && annualRate == null)) {
        return NextResponse.json({ error: "Informations de compte invalides" }, { status: 400 });
      }
      const payload = {
        ...scope,
        name,
        account_type: ["bank", "cash", "credit", "financing"].includes(body.accountType) ? body.accountType : "bank",
        bank_name: String(body.bankName ?? "").trim() || null,
        current_balance: currentBalance,
        overdraft_limit: overdraftLimit,
        financing_limit: financingLimit,
        financing_used: financingUsed,
        annual_rate: annualRate,
        created_by: user.id,
      };
      const query = body.id
        ? supabase.from("treasury_accounts").update(payload).eq("id", body.id).eq(dossierId ? "dossier_id" : "company_id", dossierId ?? companyId!)
        : supabase.from("treasury_accounts").insert(payload);
      const { data, error } = await query.select().single();
      if (error) throw error;
      return NextResponse.json({ success: true, account: data });
    }

    if (body.action === "save_budget") {
      const inflowBudget = finiteNonNegative(body.inflowBudget);
      const outflowBudget = finiteNonNegative(body.outflowBudget);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(body.weekStart ?? "") || inflowBudget == null || outflowBudget == null) {
        return NextResponse.json({ error: "Budget hebdomadaire invalide" }, { status: 400 });
      }
      const conflict = dossierId ? "dossier_id,week_start" : "company_id,week_start";
      const { data, error } = await supabase.from("treasury_weekly_budgets").upsert({
        ...scope,
        week_start: body.weekStart,
        inflow_budget: inflowBudget,
        outflow_budget: outflowBudget,
        notes: String(body.notes ?? "").trim() || null,
        created_by: user.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: conflict }).select().single();
      if (error) throw error;
      return NextResponse.json({ success: true, budget: data });
    }

    if (body.action === "create_transfer") {
      const amount = Number(body.amount);
      if (!body.fromAccountId || !body.toAccountId || body.fromAccountId === body.toAccountId || !Number.isFinite(amount) || amount <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(body.transferDate ?? "")) {
        return NextResponse.json({ error: "Virement invalide" }, { status: 400 });
      }
      const { data, error } = await supabase.from("treasury_transfers").insert({
        ...scope,
        from_account_id: body.fromAccountId,
        to_account_id: body.toAccountId,
        amount,
        transfer_date: body.transferDate,
        reference: String(body.reference ?? "").trim() || null,
        notes: String(body.notes ?? "").trim() || null,
        created_by: user.id,
      }).select().single();
      if (error) throw error;
      return NextResponse.json({ success: true, transfer: data });
    }

    return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
  } catch (error: any) {
    console.error("Treasury API error", error);
    return NextResponse.json({ error: error?.message || "Erreur lors de l’opération de trésorerie" }, { status: 500 });
  }
}
