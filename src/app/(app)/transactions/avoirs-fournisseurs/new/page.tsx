import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/PageHeader";
import NewAvoirFournisseurForm from "./NewAvoirFournisseurForm";
import { resolveAccountOwnerId } from "@/lib/account-owner";
import { ReceiptText } from "lucide-react";

export default async function NewAvoirFournisseurPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const ownerId = await resolveAccountOwnerId(user!.id);

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
      <NewAvoirFournisseurForm nextNumber={nextNumber} userId={ownerId} />
    </>
  );
}
