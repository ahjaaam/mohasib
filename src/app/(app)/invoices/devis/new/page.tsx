import { createClient } from "@/lib/supabase/server";
import { resolveAccountOwnerId } from "@/lib/account-owner";
import PageHeader from "@/components/PageHeader";
import BackIconLink from "@/components/BackIconLink";
import NewDevisForm from "./NewDevisForm";
import type { Client } from "@/types";
import { getNextInvoiceDocumentNumber } from "@/lib/document-numbers";

export default async function NewDevisPage() {
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
    prefix: "DEV",
    userId: ownerId,
  });

  return (
    <>
      <PageHeader title="Nouveau devis" subtitle="Créez un devis commercial pour votre client" icon={<BackIconLink href="/invoices?mode=devis" label="Retour aux devis" />} />
      <NewDevisForm clients={clients} nextNumber={nextNumber} userId={ownerId} />
    </>
  );
}
