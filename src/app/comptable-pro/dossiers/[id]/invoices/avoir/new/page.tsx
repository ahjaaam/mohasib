import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import NewAvoirForm from "@/app/(app)/invoices/avoir/new/NewAvoirForm";
import BackIconLink from "@/components/BackIconLink";
import type { Client } from "@/types";
import { resolveAccountOwnerId } from "@/lib/account-owner";
import { getNextInvoiceDocumentNumber } from "@/lib/document-numbers";

export const dynamic = "force-dynamic";

export default async function DossierNewAvoirPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: dossierId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();
  const ownerId = await resolveAccountOwnerId(user.id);

  const [clientsRes, nextNumber, linkableRes] = await Promise.all([
    supabase
      .from("clients")
      .select("id, name, email")
      .eq("dossier_id", dossierId)
      .order("name"),
    getNextInvoiceDocumentNumber(supabase, {
      prefix: "AV",
      userId: ownerId,
      dossierId,
    }),
    supabase
      .from("invoices")
      .select("id, invoice_number, issue_date")
      .eq("dossier_id", dossierId)
      .eq("invoice_type", "facture")
      .in("status", ["sent", "paid", "overdue", "partiellement_payee"])
      .order("issue_date", { ascending: false })
      .limit(50),
  ]);

  const backHref = `/comptable-pro/dossiers/${dossierId}/invoices?mode=avoirs`;

  return (
    <>
      <div className="mb-5 flex items-start gap-3">
        <BackIconLink href={backHref} label="Retour aux avoirs" />
        <div>
          <h1 className="text-[18px] font-semibold leading-tight text-[#1A1A2E]">Nouvel avoir client</h1>
          <p className="mt-0.5 text-[13px] text-[#6B7280]">Émettre un avoir sur facture client</p>
        </div>
      </div>
      <NewAvoirForm
        clients={(clientsRes.data ?? []) as Pick<Client, "id" | "name" | "email">[]}
        nextNumber={nextNumber}
        userId={ownerId}
        dossierId={dossierId}
        backHref={backHref}
        linkableInvoices={linkableRes.data ?? []}
      />
    </>
  );
}
