import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/PageHeader";
import NewAvoirFournisseurForm from "./NewAvoirFournisseurForm";
import { resolveAccountOwnerId } from "@/lib/account-owner";
import { ReceiptText } from "lucide-react";
import { normalizeAccountingSettings } from "@/lib/accounting-settings";
import { getExpenseAccount } from "@/lib/cgnc-mapping";

export default async function NewAvoirFournisseurPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const ownerId = await resolveAccountOwnerId(user!.id);
  const { data: company } = await supabase
    .from("companies")
    .select("accounting_settings")
    .eq("user_id", ownerId)
    .maybeSingle();
  const accounts = normalizeAccountingSettings(company?.accounting_settings);
  const { data: purchaseRows } = await supabase
    .from("receipts")
    .select("id, ocr_data, created_at")
    .eq("user_id", ownerId)
    .is("dossier_id", null)
    .in("document_area", ["purchase", "legacy"])
    .eq("status", "matched")
    .order("created_at", { ascending: false })
    .limit(100);
  const originalPurchases = (purchaseRows ?? [])
    .filter(row => row.ocr_data?.document_type !== "avoir")
    .map(row => {
      const ocr = row.ocr_data ?? {};
      const category = String(ocr.category ?? "Achats");
      return {
        id: row.id,
        reference: String(ocr.receipt_number ?? ocr.invoice_number ?? row.id.slice(0, 8)),
        supplier: String(ocr.vendor_name ?? ocr.vendor ?? "Fournisseur"),
        date: String(ocr.date ?? row.created_at?.slice(0, 10) ?? ""),
        account: String(ocr.compte ?? getExpenseAccount(category, accounts.expenseCategoryAccounts)),
      };
    });

  // Next AV-FOURN number
  const year = new Date().getFullYear();
  const { data: lastAv } = await supabase
    .from("avoirs_fournisseurs")
    .select("numero_interne")
    .eq("user_id", ownerId)
    .ilike("numero_interne", `AV-FOURN-${year}-%`)
    .order("created_at", { ascending: false })
    .limit(1);

  const lastNum = lastAv?.[0]
    ? parseInt(lastAv[0].numero_interne.split("-").pop() ?? "0", 10)
    : 0;
  const nextNumber = `AV-FOURN-${year}-${String(lastNum + 1).padStart(4, "0")}`;

  return (
    <>
      <PageHeader
        title="Nouvel avoir fournisseur"
        subtitle="Enregistrer un avoir reçu d'un fournisseur"
        icon={<ReceiptText size={18} />}
      />
      <NewAvoirFournisseurForm
        nextNumber={nextNumber}
        userId={ownerId}
        supplierAccount={accounts.supplierAccount}
        accountingSettings={accounts}
        originalPurchases={originalPurchases}
      />
    </>
  );
}
