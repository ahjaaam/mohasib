export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import DossierDashboard from "./DossierDashboard";
import { resolveAccountOwnerId } from "@/lib/account-owner";
import { getUserAccessProfile } from "@/lib/team";
import type { FinanceChartPoint } from "@/app/(app)/dashboard/RevenueExpenseChart";

export default async function DashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");
  const ownerId = await resolveAccountOwnerId(user.id);
  const access = await getUserAccessProfile(user.id);
  const isClientPortal = access.roleName === "client_portal";

  const now = new Date();
  const chartStartDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const chartStart = `${chartStartDate.getFullYear()}-${String(chartStartDate.getMonth() + 1).padStart(2, "0")}-01`;

  const [dossierRes, invRes, txRes, chartTxRes] = await Promise.all([
    supabase.from("dossiers").select("*").eq("id", id).eq("fiduciaire_user_id", ownerId).single(),
    supabase.from("invoices").select("id, invoice_number, issue_date, due_date, montant_recu, subtotal, tax_amount, total, status, clients(name)").eq("dossier_id", id).order("issue_date", { ascending: false }).limit(50),
    supabase.from("transactions").select("id, date, description, amount, type, category").eq("dossier_id", id).order("date", { ascending: false }).limit(50),
    supabase.from("transactions").select("date, type, amount").eq("dossier_id", id).gte("date", chartStart).order("date", { ascending: true }),
  ]);

  if (!dossierRes.data) notFound();

  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const chartData: FinanceChartPoint[] = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 11 + index, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const monthTx = (chartTxRes.data ?? []).filter(t => t.date.slice(0, 7) === key);
    const revenue = monthTx.filter(t => t.type === "income").reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
    const expenses = monthTx.filter(t => t.type === "expense").reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
    return { key, label: date.toLocaleDateString("fr-MA", { month: "short" }).replace(".", ""), revenue, expenses, net: revenue - expenses };
  });
  const dailyChartData: FinanceChartPoint[] = Array.from({ length: now.getDate() }, (_, index) => {
    const day = index + 1;
    const key = `${monthStart.slice(0, 8)}${String(day).padStart(2, "0")}`;
    const dayTx = (chartTxRes.data ?? []).filter(t => t.date.slice(0, 10) === key);
    const revenue = dayTx.filter(t => t.type === "income").reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
    const expenses = dayTx.filter(t => t.type === "expense").reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
    return { key, label: String(day), revenue, expenses, net: revenue - expenses };
  });

  return (
    <DossierDashboard
      dossier={dossierRes.data}
      invoices={(invRes.data ?? []) as any[]}
      transactions={(txRes.data ?? []) as any[]}
      chartData={chartData}
      dailyChartData={dailyChartData}
      isClientPortal={isClientPortal}
    />
  );
}
