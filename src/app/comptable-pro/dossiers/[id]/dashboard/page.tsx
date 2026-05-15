export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import DossierDashboard from "./DossierDashboard";

export default async function DashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [dossierRes, ecrRes, invRes, txRes] = await Promise.all([
    supabase.from("dossiers").select("*").eq("id", id).eq("fiduciaire_user_id", user.id).single(),
    supabase.from("dossier_ecritures").select("*").eq("dossier_id", id).order("date", { ascending: false }).limit(50),
    supabase.from("invoices").select("id, invoice_number, issue_date, total, status, clients(name)").eq("dossier_id", id).order("issue_date", { ascending: false }).limit(50),
    supabase.from("transactions").select("id, date, description, amount, type, category").eq("dossier_id", id).order("date", { ascending: false }).limit(50),
  ]);

  if (!dossierRes.data) notFound();

  return (
    <DossierDashboard
      dossier={dossierRes.data}
      ecritures={ecrRes.data ?? []}
      invoices={(invRes.data ?? []) as any[]}
      transactions={(txRes.data ?? []) as any[]}
    />
  );
}
