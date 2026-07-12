import { createClient } from "@/lib/supabase/server";
import { resolveAccountOwnerId } from "@/lib/account-owner";
import PageHeader from "@/components/PageHeader";
import BackIconLink from "@/components/BackIconLink";
import NewInvoiceForm from "./NewInvoiceForm";
import type { Client } from "@/types";
import { getNextInvoiceDocumentNumber } from "@/lib/document-numbers";

export default async function NewInvoicePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const ownerId = await resolveAccountOwnerId(user!.id);

  const { data } = await supabase
    .from("clients")
    .select("id, name, email")
    .eq("user_id", ownerId)
    .is("dossier_id", null)
    .order("name");

  const clients: Pick<Client, "id" | "name" | "email">[] = data ?? [];

  const nextNumber = await getNextInvoiceDocumentNumber(supabase, {
    prefix: "FAC",
    userId: ownerId,
  });

  return (
    <>
      <PageHeader title="Nouvelle facture" subtitle="Créer et envoyer une facture" icon={<BackIconLink href="/invoices" label="Retour aux factures" />} />
      <NewInvoiceForm clients={clients} nextNumber={nextNumber} userId={ownerId} />
    </>
  );
}
