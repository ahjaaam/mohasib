export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveAccountOwnerId } from "@/lib/account-owner";
import { FEATURES } from "@/lib/features";
import { analyzeCustomerPaymentBehavior, buildTreasurySnapshot, detectRecurringExpenses, prioritizeReceivables } from "@/lib/treasury";
import TreasuryDashboard from "./TreasuryDashboard";

export async function TreasuryWorkspace({ dossierId }: { dossierId?: string }) {
  if (!FEATURES.TREASURY_ENABLED) notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");
  const ownerId = await resolveAccountOwnerId(user.id);

  let companyId: string | null = null;
  if (dossierId) {
    const { data: dossier } = await supabase.from("dossiers").select("id").eq("id", dossierId).eq("fiduciaire_user_id", ownerId).single();
    if (!dossier) notFound();
  } else {
    const { data: company } = await supabase.from("companies").select("id").eq("user_id", ownerId).maybeSingle();
    companyId = company?.id ?? null;
  }

  let transactionQuery = supabase.from("transactions").select("id,date,type,amount,description,category").eq("user_id", ownerId);
  let invoiceQuery = supabase.from("invoices").select("id,client_id,invoice_number,issue_date,due_date,total,montant_recu,status,updated_at,paiements,clients(name)").eq("user_id", ownerId).or("invoice_type.is.null,invoice_type.eq.facture");
  let supplierQuery = supabase.from("receipts").select("id,ocr_data").eq("user_id", ownerId).eq("status", "matched");
  if (dossierId) {
    transactionQuery = transactionQuery.eq("dossier_id", dossierId);
    invoiceQuery = invoiceQuery.eq("dossier_id", dossierId);
    supplierQuery = supplierQuery.eq("dossier_id", dossierId);
  } else {
    transactionQuery = transactionQuery.is("dossier_id", null);
    invoiceQuery = invoiceQuery.is("dossier_id", null);
    supplierQuery = supplierQuery.is("dossier_id", null);
  }

  let accountQuery = supabase.from("treasury_accounts").select("*").eq("is_active", true);
  let budgetQuery = supabase.from("treasury_weekly_budgets").select("*").order("week_start", { ascending: true });
  let transferQuery = supabase.from("treasury_transfers").select("*,from_account:treasury_accounts!treasury_transfers_from_account_id_fkey(name),to_account:treasury_accounts!treasury_transfers_to_account_id_fkey(name)").order("transfer_date", { ascending: false }).limit(8);
  if (dossierId) {
    accountQuery = accountQuery.eq("dossier_id", dossierId);
    budgetQuery = budgetQuery.eq("dossier_id", dossierId);
    transferQuery = transferQuery.eq("dossier_id", dossierId);
  } else {
    accountQuery = accountQuery.eq("company_id", companyId!);
    budgetQuery = budgetQuery.eq("company_id", companyId!);
    transferQuery = transferQuery.eq("company_id", companyId!);
  }

  const [transactionsRes, invoicesRes, suppliersRes, payrollRes, accountsRes, budgetsRes, transfersRes] = await Promise.all([
    transactionQuery.order("date", { ascending: true }),
    invoiceQuery,
    supplierQuery,
    companyId
      ? supabase.from("bulletins_paie").select("id,mois,annee,salaire_net_payer,statut").eq("company_id", companyId).neq("statut", "payé")
      : Promise.resolve({ data: [] }),
    accountQuery,
    budgetQuery,
    transferQuery,
  ]);

  const suppliers = (suppliersRes.data ?? []).filter((item: any) =>
    item.ocr_data?.document_type !== "avoir" && item.ocr_data?.is_supplier_invoice !== false
  );
  const transactions = (transactionsRes.data ?? []) as any[];
  const invoices = (invoicesRes.data ?? []) as any[];
  const accounts = (accountsRes.data ?? []) as any[];
  const recurringExpenses = detectRecurringExpenses(transactions);
  const paymentBehaviors = analyzeCustomerPaymentBehavior(invoices);
  const recommendations = prioritizeReceivables(invoices, paymentBehaviors);
  const accountPosition = accounts.length
    ? accounts.reduce((sum, account) => sum + Number(account.current_balance ?? 0), 0)
    : undefined;
  const input = {
    transactions,
    invoices,
    suppliers: suppliers as any[],
    payroll: (payrollRes.data ?? []) as any[],
    recurringExpenses,
    paymentBehaviors,
    accountPosition,
  };
  const snapshots = {
    30: buildTreasurySnapshot({ ...input, horizonDays: 30 }),
    90: buildTreasurySnapshot({ ...input, horizonDays: 90 }),
  } as const;
  const lastMovementDate = input.transactions.at(-1)?.date ?? null;

  return <TreasuryDashboard
    snapshots={snapshots}
    basePath={dossierId ? `/comptable-pro/dossiers/${dossierId}` : ""}
    dossierId={dossierId}
    lastMovementDate={lastMovementDate}
    accounts={accounts}
    budgets={(budgetsRes.data ?? []) as any[]}
    transfers={(transfersRes.data ?? []) as any[]}
    recurringExpenses={recurringExpenses}
    paymentBehaviors={paymentBehaviors}
    recommendations={recommendations}
  />;
}

export default async function TreasuryPage() {
  return <TreasuryWorkspace />;
}
