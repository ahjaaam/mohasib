import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import NewInvoiceForm from "@/app/(app)/invoices/new/NewInvoiceForm";
import type { Client } from "@/types";

export const dynamic = "force-dynamic";

export default async function DossierNewInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: dossierId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const [clientsRes, lastInvRes] = await Promise.all([
    supabase
      .from("clients")
      .select("id, name, email")
      .eq("dossier_id", dossierId)
      .order("name"),
    supabase
      .from("invoices")
      .select("invoice_number")
      .eq("dossier_id", dossierId)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const lastNum = lastInvRes.data?.[0]
    ? parseInt(lastInvRes.data[0].invoice_number.split("-").pop() ?? "0", 10)
    : 0;
  const year = new Date().getFullYear();
  const nextNumber = `FAC-${year}-${String(lastNum + 1).padStart(4, "0")}`;
  const backHref = `/comptable-pro/dossiers/${dossierId}/invoices`;

  return (
    <NewInvoiceForm
      clients={(clientsRes.data ?? []) as Pick<Client, "id" | "name" | "email">[]}
      nextNumber={nextNumber}
      userId={user.id}
      dossierId={dossierId}
      backHref={backHref}
    />
  );
}
