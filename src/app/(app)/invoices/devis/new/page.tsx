import { createClient } from "@/lib/supabase/server";
import { resolveAccountOwnerId } from "@/lib/account-owner";
import PageHeader from "@/components/PageHeader";
import NewDevisForm from "./NewDevisForm";
import type { Client } from "@/types";

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

  const { data: lastDevis } = await supabase
    .from("invoices")
    .select("invoice_number")
    .eq("user_id", ownerId)
    .is("dossier_id", null)
    .eq("invoice_type", "devis")
    .order("created_at", { ascending: false })
    .limit(1);

  const lastNum = lastDevis?.[0]
    ? parseInt(lastDevis[0].invoice_number.split("-").pop() ?? "0", 10)
    : 0;
  const year = new Date().getFullYear();
  const nextNumber = `DEV-${year}-${String(lastNum + 1).padStart(4, "0")}`;

  return (
    <>
      <PageHeader title="Nouveau devis" subtitle="Créez un devis commercial pour votre client" />
      <NewDevisForm clients={clients} nextNumber={nextNumber} userId={ownerId} />
    </>
  );
}
