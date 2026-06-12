import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import NewAvoirForm from "@/app/(app)/invoices/avoir/new/NewAvoirForm";
import type { Client } from "@/types";
import { resolveAccountOwnerId } from "@/lib/account-owner";

export const dynamic = "force-dynamic";

export default async function DossierNewAvoirPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: dossierId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();
  const ownerId = await resolveAccountOwnerId(user.id);

  const year = new Date().getFullYear();

  const [clientsRes, lastAvRes, linkableRes] = await Promise.all([
    supabase
      .from("clients")
      .select("id, name, email")
      .eq("dossier_id", dossierId)
      .order("name"),
    supabase
      .from("invoices")
      .select("invoice_number")
      .eq("dossier_id", dossierId)
      .eq("invoice_type", "avoir_client")
      .ilike("invoice_number", `AV-${year}-%`)
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("invoices")
      .select("id, invoice_number, issue_date")
      .eq("dossier_id", dossierId)
      .eq("invoice_type", "facture")
      .in("status", ["sent", "paid", "overdue", "partiellement_payee"])
      .order("issue_date", { ascending: false })
      .limit(50),
  ]);

  const lastNum = lastAvRes.data?.[0]
    ? parseInt(lastAvRes.data[0].invoice_number.split("-").pop() ?? "0", 10)
    : 0;
  const nextNumber = `AV-${year}-${String(lastNum + 1).padStart(4, "0")}`;
  const backHref = `/comptable-pro/dossiers/${dossierId}/invoices?mode=avoirs`;

  return (
    <NewAvoirForm
      clients={(clientsRes.data ?? []) as Pick<Client, "id" | "name" | "email">[]}
      nextNumber={nextNumber}
      userId={ownerId}
      dossierId={dossierId}
      backHref={backHref}
      linkableInvoices={linkableRes.data ?? []}
    />
  );
}
