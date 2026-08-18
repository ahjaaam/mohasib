export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { CreditCard } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { resolveAccountOwnerId } from "@/lib/account-owner";
import PageHeader from "@/components/PageHeader";
import SuiviClient from "@/app/(app)/suivi-paiements/SuiviClient";

export default async function DossierSuiviPaiementsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");
  const ownerId = await resolveAccountOwnerId(user.id);

  const [dossierRes, clientInvoicesRes, supplierItemsRes] = await Promise.all([
    supabase.from("dossiers").select("id,raison_sociale").eq("id", id).eq("fiduciaire_user_id", ownerId).single(),
    supabase.from("invoices")
      .select("*, clients(id, name, email, phone, whatsapp)")
      .eq("user_id", ownerId).eq("dossier_id", id).eq("invoice_type", "facture")
      .neq("status", "draft").neq("status", "cancelled")
      .order("due_date", { ascending: true, nullsFirst: false }),
    supabase.from("receipts").select("*")
      .eq("user_id", ownerId).eq("dossier_id", id).eq("status", "matched"),
  ]);
  if (!dossierRes.data) notFound();

  const supplierItems = (supplierItemsRes.data ?? []).filter((receipt: any) =>
    receipt.ocr_data?.document_type !== "avoir" && receipt.ocr_data?.is_supplier_invoice !== false
  );

  return (
    <>
      <PageHeader
        title="Suivi des échéances"
        subtitle="Encaissements clients et paiements fournisseurs"
        icon={<CreditCard size={20} />}
      />
      <SuiviClient
        clientInvoices={clientInvoicesRes.data ?? []}
        supplierItems={supplierItems}
        companyId={null}
        companyName={dossierRes.data.raison_sociale}
        dossierId={id}
      />
    </>
  );
}
