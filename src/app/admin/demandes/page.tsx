import { RequestStatus } from "@/components/admin/AdminControls";
import { adminContext, formatDate } from "@/lib/admin-data";

export default async function RequestsPage() {
  const { admin } = await adminContext();
  const [upgrades, custom] = await Promise.all([
    admin.from("upgrade_requests").select("*, companies(raison_sociale)").order("created_at", { ascending: false }),
    admin.from("custom_requests").select("*, companies(raison_sociale)").order("created_at", { ascending: false }),
  ]);
  return <div><h1 className="text-xl font-bold">Demandes</h1><p className="mt-1 text-xs text-gray-500">Montées en gamme et demandes personnalisées</p>
    <section className="mt-5 rounded-md border border-black/10 bg-white"><h2 className="border-b border-black/10 px-4 py-3 text-sm font-bold">Demandes de changement tarifaire</h2><div className="divide-y divide-black/5">{(upgrades.data ?? []).map(item => <div key={item.id} className="grid items-center gap-2 px-4 py-3 text-[11px] sm:grid-cols-[1fr_1fr_140px_130px]"><b>{(item.companies as { raison_sociale?: string } | null)?.raison_sociale || "—"}</b><span>{item.current_plan} → {item.requested_plan}</span><span className="text-gray-500">{formatDate(item.created_at)}</span><RequestStatus id={item.id} current={item.status} /></div>)}</div></section>
    <section className="mt-5 rounded-md border border-black/10 bg-white"><h2 className="border-b border-black/10 px-4 py-3 text-sm font-bold">Demandes personnalisées</h2><div className="divide-y divide-black/5">{(custom.data ?? []).map(item => <div key={item.id} className="grid items-center gap-2 px-4 py-3 text-[11px] sm:grid-cols-[1fr_2fr_140px_130px]"><div><b>{item.name || item.email}</b><div className="text-gray-500">{item.email}</div></div><span>{item.message || "—"}</span><span className="text-gray-500">{formatDate(item.created_at)}</span><RequestStatus id={`custom:${item.id}`} current={item.status} /></div>)}</div></section>
  </div>;
}
