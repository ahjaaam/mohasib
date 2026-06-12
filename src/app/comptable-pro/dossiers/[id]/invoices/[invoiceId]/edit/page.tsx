import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import EditInvoiceForm from "@/app/(app)/invoices/[id]/edit/EditInvoiceForm";
import type { Client } from "@/types";
import { resolveAccountOwnerId } from "@/lib/account-owner";

export const dynamic = "force-dynamic";

export default async function DossierEditInvoicePage({
  params,
}: {
  params: Promise<{ id: string; invoiceId: string }>;
}) {
  const { id: dossierId, invoiceId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const ownerId = await resolveAccountOwnerId(user!.id);

  const { data: inv } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .eq("user_id", ownerId)
    .eq("dossier_id", dossierId)
    .single();

  if (!inv) notFound();
  if (inv.status !== "draft") redirect(`/comptable-pro/dossiers/${dossierId}/invoices/${invoiceId}`);

  const { data } = await supabase
    .from("clients")
    .select("id, name, email")
    .eq("dossier_id", dossierId)
    .order("name");

  const clients: Pick<Client, "id" | "name" | "email">[] = data ?? [];
  const backHref = `/comptable-pro/dossiers/${dossierId}/invoices`;

  return <EditInvoiceForm invoice={inv} clients={clients} backHref={backHref} />;
}
