import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import EditInvoiceForm from "./EditInvoiceForm";
import type { Client } from "@/types";

export default async function EditInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: inv } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", id)
    .eq("user_id", user!.id)
    .single();

  if (!inv) notFound();
  if (inv.status !== "draft") redirect(`/invoices/${id}`);

  const { data } = await supabase
    .from("clients")
    .select("id, name, email")
    .eq("user_id", user!.id)
    .order("name");

  const clients: Pick<Client, "id" | "name" | "email">[] = data ?? [];

  return <EditInvoiceForm invoice={inv} clients={clients} />;
}
