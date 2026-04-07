import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/PageHeader";
import NewInvoiceForm from "./NewInvoiceForm";
import type { Client } from "@/types";

export default async function NewInvoicePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data } = await supabase
    .from("clients")
    .select("id, name, email")
    .eq("user_id", user!.id)
    .order("name");

  const clients: Pick<Client, "id" | "name" | "email">[] = data ?? [];

  // Get last invoice number
  const { data: lastInv } = await supabase
    .from("invoices")
    .select("invoice_number")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })
    .limit(1);

  const lastNum = lastInv?.[0]
    ? parseInt(lastInv[0].invoice_number.split("-").pop() ?? "0", 10)
    : 0;
  const year = new Date().getFullYear();
  const nextNumber = `FAC-${year}-${String(lastNum + 1).padStart(4, "0")}`;

  return (
    <>
      <PageHeader title="Nouvelle facture" subtitle="Créer et envoyer une facture" />
      <NewInvoiceForm clients={clients} nextNumber={nextNumber} userId={user!.id} />
    </>
  );
}
