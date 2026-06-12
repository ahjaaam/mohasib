import { createClient } from "@/lib/supabase/server";
import { resolveAccountOwnerId } from "@/lib/account-owner";
import PageHeader from "@/components/PageHeader";
import NewAvoirForm from "./NewAvoirForm";
import type { Client } from "@/types";

export default async function NewAvoirClientPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const ownerId = await resolveAccountOwnerId(user!.id);

  const { data: clientsData } = await supabase
    .from("clients")
    .select("id, name, email")
    .eq("user_id", ownerId)
    .is("dossier_id", null)
    .order("name");

  const clients: Pick<Client, "id" | "name" | "email">[] = clientsData ?? [];

  // Get next avoir number: AV-YYYY-NNNN
  const year = new Date().getFullYear();
  const { data: lastAv } = await supabase
    .from("invoices")
    .select("invoice_number")
    .eq("user_id", ownerId)
    .is("dossier_id", null)
    .eq("invoice_type", "avoir_client")
    .ilike("invoice_number", `AV-${year}-%`)
    .order("created_at", { ascending: false })
    .limit(1);

  const lastNum = lastAv?.[0]
    ? parseInt(lastAv[0].invoice_number.split("-").pop() ?? "0", 10)
    : 0;
  const nextNumber = `AV-${year}-${String(lastNum + 1).padStart(4, "0")}`;

  // Recent sent/paid invoices for linking
  const { data: invoicesData } = await supabase
    .from("invoices")
    .select("id, invoice_number, issue_date")
    .eq("user_id", ownerId)
    .is("dossier_id", null)
    .eq("invoice_type", "facture")
    .in("status", ["sent", "paid", "overdue", "partiellement_payee"])
    .order("issue_date", { ascending: false })
    .limit(50);

  const linkableInvoices = invoicesData ?? [];

  return (
    <>
      <PageHeader title="Nouvel avoir client" subtitle="Émettre un avoir sur facture client" />
      <NewAvoirForm
        clients={clients}
        nextNumber={nextNumber}
        userId={ownerId}
        linkableInvoices={linkableInvoices}
      />
    </>
  );
}
