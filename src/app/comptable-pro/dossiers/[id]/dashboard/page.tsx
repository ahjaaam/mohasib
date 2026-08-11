export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import DossierDashboard from "./DossierDashboard";
import { resolveAccountOwnerId } from "@/lib/account-owner";
import { getUserAccessProfile } from "@/lib/team";
import { cookies } from "next/headers";
import { GLOBAL_PERIOD_STORAGE_KEY, globalPeriodLabel, parseGlobalPeriod } from "@/lib/global-period";
import { buildFinanceChartData } from "@/lib/finance-chart";

export default async function DashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");
  const ownerId = await resolveAccountOwnerId(user.id);
  const access = await getUserAccessProfile(user.id);
  const isClientPortal = access.roleName === "client_portal";
  const cookieStore = await cookies();
  const selectedPeriod = parseGlobalPeriod(cookieStore.get(GLOBAL_PERIOD_STORAGE_KEY)?.value);
  const selectedPeriodLabel = globalPeriodLabel(selectedPeriod);

  let invoiceQuery = supabase.from("invoices").select("id, invoice_number, issue_date, due_date, montant_recu, subtotal, tax_amount, total, status, clients(name)").eq("dossier_id", id);
  let transactionQuery = supabase.from("transactions").select("id, date, description, amount, type, category").eq("dossier_id", id);
  if (selectedPeriod.start && selectedPeriod.end) {
    invoiceQuery = invoiceQuery.gte("issue_date", selectedPeriod.start).lte("issue_date", selectedPeriod.end);
    transactionQuery = transactionQuery.gte("date", selectedPeriod.start).lte("date", selectedPeriod.end);
  }

  const [dossierRes, invRes, txRes] = await Promise.all([
    supabase.from("dossiers").select("*").eq("id", id).eq("fiduciaire_user_id", ownerId).single(),
    invoiceQuery.order("issue_date", { ascending: false }),
    transactionQuery.order("date", { ascending: false }),
  ]);

  if (!dossierRes.data) notFound();

  const chartData = buildFinanceChartData((txRes.data ?? []) as Array<{ date: string; type: string; amount: number }>, selectedPeriod);

  return (
    <DossierDashboard
      dossier={dossierRes.data}
      invoices={(invRes.data ?? []) as any[]}
      transactions={(txRes.data ?? []) as any[]}
      chartData={chartData}
      periodLabel={selectedPeriodLabel}
      isClientPortal={isClientPortal}
    />
  );
}
