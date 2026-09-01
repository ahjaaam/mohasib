import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import NewInvoiceForm from "@/app/(app)/invoices/new/NewInvoiceForm";
import BackIconLink from "@/components/BackIconLink";
import PageHeader from "@/components/PageHeader";
import type { Client } from "@/types";
import { resolveAccountOwnerId } from "@/lib/account-owner";
import { getNextInvoiceDocumentNumber } from "@/lib/document-numbers";

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
  const ownerId = await resolveAccountOwnerId(user.id);

  const [clientsRes, nextNumber] = await Promise.all([
    supabase
      .from("clients")
      .select("id, name, email")
      .eq("dossier_id", dossierId)
      .order("name"),
    getNextInvoiceDocumentNumber(supabase, {
      prefix: "FAC",
      userId: ownerId,
      dossierId,
    }),
  ]);

  const backHref = `/comptable-pro/dossiers/${dossierId}/factures`;

  return (
    <>
      <PageHeader
        title="Nouvelle facture"
        subtitle="Créer et envoyer une facture"
        icon={<BackIconLink href={backHref} label="Retour aux factures" />}
        iconBare
      />
      <NewInvoiceForm
        clients={(clientsRes.data ?? []) as Pick<Client, "id" | "name" | "email">[]}
        nextNumber={nextNumber}
        userId={ownerId}
        dossierId={dossierId}
        backHref={backHref}
      />
    </>
  );
}
