export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/PageHeader";
import { CreditCard } from "lucide-react";
import SuiviClient from "./SuiviClient";

export default async function SuiviPaiementsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [companyRes, clientInvoicesRes, supplierItemsRes] = await Promise.all([
    supabase.from("companies").select("id, raison_sociale").eq("user_id", user!.id).single(),
    supabase
      .from("invoices")
      .select("*, clients(id, name, email, phone, whatsapp)")
      .eq("user_id", user!.id)
      .is("dossier_id", null)
      .eq("invoice_type", "facture")
      .neq("status", "draft")
      .neq("status", "cancelled")
      .order("due_date", { ascending: true, nullsFirst: false }),
    supabase
      .from("receipts")
      .select("*")
      .eq("user_id", user!.id)
      .is("dossier_id", null)
      .eq("status", "matched"),
  ]);

  // Exclude avoirs and explicit non-supplier items
  const filteredSuppliers = (supplierItemsRes.data ?? []).filter((r: any) => {
    if (r.ocr_data?.document_type === "avoir") return false;
    return r.ocr_data?.is_supplier_invoice !== false;
  });

  return (
    <>
      <PageHeader
        title="Suivi des paiements"
        subtitle="Encaissements clients et paiements fournisseurs"
        icon={<CreditCard size={20} />}
      />
      <SuiviClient
        clientInvoices={clientInvoicesRes.data ?? []}
        supplierItems={filteredSuppliers}
        companyId={companyRes.data?.id ?? null}
        companyName={companyRes.data?.raison_sociale ?? null}
      />
    </>
  );
}
