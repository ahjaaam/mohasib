import { Download } from "lucide-react";
import Link from "next/link";
import { StatusBadge } from "@/components/admin/AdminUI";
import { adminContext, formatDate, formatMoney } from "@/lib/admin-data";
import { pricingPlanLabel } from "@/lib/pricing";

export default async function SubscriptionsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const filters = await searchParams;
  const { admin } = await adminContext();
  const { data } = await admin.from("subscriptions").select("*, companies(raison_sociale)").order("created_at", { ascending: false });
  const allRows = data ?? [];
  const availablePlans = [...new Set(allRows.map(item => item.plan).filter(Boolean))] as string[];
  const rows = allRows.filter(item => (!filters.status || item.status === filters.status) && (!filters.plan || item.plan === filters.plan) && (!filters.period || item.billing_period === filters.period));
  const now = new Date();
  const total = allRows.filter(item => item.starts_at && new Date(item.starts_at).getMonth() === now.getMonth() && new Date(item.starts_at).getFullYear() === now.getFullYear()).reduce((sum, item) => sum + Number(item.amount_mad ?? 0), 0);
  return <div><div className="mb-5 flex items-end justify-between"><div><h1 className="text-xl font-bold">Abonnements</h1><p className="mt-1 text-xs text-gray-500">Encaissé ce mois : {formatMoney(total)}</p></div><Link href="/api/admin/export/subscriptions" className="inline-flex items-center gap-1.5 rounded border border-black/20 bg-[#FAFAF6] px-3 py-2 text-xs font-semibold shadow-sm hover:bg-[#F0EDE5]"><Download size={13} /> CSV</Link></div>
    <form className="mb-3 grid gap-2 rounded-md border border-black/10 bg-white p-3 sm:grid-cols-4"><select name="status" defaultValue={filters.status} className="input text-xs"><option value="">Tous les statuts</option>{["active", "scheduled", "expired", "cancelled"].map(value => <option key={value}>{value}</option>)}</select><select name="plan" defaultValue={filters.plan} className="input text-xs"><option value="">Tous les tarifs</option>{availablePlans.map(value => <option key={value} value={value}>{pricingPlanLabel(value)}</option>)}</select><select name="period" defaultValue={filters.period} className="input text-xs"><option value="">Toutes les périodes</option><option value="monthly">Mensuel</option><option value="annual">Annuel</option></select><button className="rounded bg-[#0D1526] text-xs font-bold text-white">Filtrer</button></form>
    <div className="overflow-x-auto rounded-md border border-black/10 bg-white"><table className="w-full text-left text-[11px]"><thead className="bg-[#F8F8F5] text-gray-500"><tr>{["Compte", "Tarif", "Période", "Montant", "Début", "Fin", "Statut"].map(value => <th key={value} className="px-3 py-2.5">{value}</th>)}</tr></thead><tbody className="divide-y divide-black/5">{rows.map(item => <tr key={item.id}><td className="px-3 py-3 font-bold">{(item.companies as { raison_sociale?: string } | null)?.raison_sociale || "—"}</td><td className="px-3 py-3">{pricingPlanLabel(item.plan)}</td><td className="px-3 py-3">{item.billing_period}</td><td className="px-3 py-3">{formatMoney(item.amount_mad)}</td><td className="px-3 py-3">{formatDate(item.starts_at)}</td><td className="px-3 py-3">{formatDate(item.ends_at)}</td><td className="px-3 py-3"><StatusBadge status={item.status} /></td></tr>)}</tbody></table></div>
  </div>;
}
