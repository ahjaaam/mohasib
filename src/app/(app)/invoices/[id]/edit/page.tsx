import { createClient } from "@/lib/supabase/server";
import { resolveAccountOwnerId } from "@/lib/account-owner";
import { notFound, redirect } from "next/navigation";
import EditInvoiceForm from "./EditInvoiceForm";
import type { Client } from "@/types";
import PageHeader from "@/components/PageHeader";
import BackIconLink from "@/components/BackIconLink";

export default async function EditInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const ownerId = await resolveAccountOwnerId(user!.id);

  const { data: inv } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", id)
    .eq("user_id", ownerId)
    .is("dossier_id", null)
    .single();

  if (!inv) notFound();
  if (inv.status !== "draft") redirect(`/invoices/${id}`);

  const { data } = await supabase
    .from("clients")
    .select("id, name, email")
    .eq("user_id", ownerId)
    .is("dossier_id", null)
    .order("name");

  const clients: Pick<Client, "id" | "name" | "email">[] = data ?? [];

  return (
    <>
      <PageHeader
        title={`Modifier ${inv.invoice_number}`}
        subtitle="Mettez à jour les informations et les lignes de la facture"
        icon={<BackIconLink href={`/invoices/${id}`} label="Retour à la facture" />}
        iconBare
      />
      <EditInvoiceForm invoice={inv} clients={clients} />
    </>
  );
}
