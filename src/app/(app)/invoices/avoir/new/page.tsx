import { createClient } from "@/lib/supabase/server";
import { resolveAccountOwnerId } from "@/lib/account-owner";
import PageHeader from "@/components/PageHeader";
import BackIconLink from "@/components/BackIconLink";
import NewAvoirForm from "./NewAvoirForm";
import type { Client } from "@/types";
import { getNextInvoiceDocumentNumber } from "@/lib/document-numbers";

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

  const nextNumber = await getNextInvoiceDocumentNumber(supabase, {
    prefix: "AV",
    userId: ownerId,
  });

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
      <PageHeader title="Nouvel avoir client" subtitle="Émettre un avoir sur facture client" icon={<BackIconLink href="/invoices?mode=avoirs" label="Retour aux avoirs" />} />
      <NewAvoirForm
        clients={clients}
        nextNumber={nextNumber}
        userId={ownerId}
        linkableInvoices={linkableInvoices}
      />
    </>
  );
}
