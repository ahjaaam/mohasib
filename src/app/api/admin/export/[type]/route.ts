import { csvResponse } from "@/lib/admin-data";
import { requireAdminApi } from "@/lib/admin-api";

export async function GET(_: Request, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  const { admin, response } = await requireAdminApi();
  if (response) return response;
  if (type === "subscriptions") {
    const { data } = await admin!.from("subscriptions").select("*, companies(raison_sociale)").order("created_at", { ascending: false });
    return csvResponse((data ?? []).map(item => ({ compte: (item.companies as { raison_sociale?: string } | null)?.raison_sociale, plan: item.plan, periode: item.billing_period, montant_mad: item.amount_mad, debut: item.starts_at, fin: item.ends_at, statut: item.status, reference: item.payment_reference })), "abonnements-mohasib.csv");
  }
  if (type === "waitlist") {
    const { data } = await admin!.from("fiduciaire_waitlist").select("*").order("created_at", { ascending: false });
    return csvResponse(data ?? [], "liste-attente-mohasib.csv");
  }
  return new Response(null, { status: 404 });
}
