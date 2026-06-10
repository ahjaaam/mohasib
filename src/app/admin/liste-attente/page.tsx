import { Download } from "lucide-react";
import Link from "next/link";
import { CreateAccountButton } from "@/components/admin/AdminUI";
import { adminContext, formatDate } from "@/lib/admin-data";

export default async function WaitlistPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const filters = await searchParams;
  const { admin } = await adminContext();
  const { data } = await admin.from("fiduciaire_waitlist").select("*").order("created_at", { ascending: false });
  const q = (filters.q ?? "").toLowerCase();
  const rows = (data ?? []).filter(item => (!q || `${item.nom} ${item.email} ${item.telephone}`.toLowerCase().includes(q)) && (!filters.type || item.track === filters.type));
  return <div><div className="mb-5 flex items-end justify-between"><div><h1 className="text-xl font-bold">Liste d’attente</h1><p className="mt-1 text-xs text-gray-500">{rows.length} inscription(s)</p></div><Link href="/api/admin/export/waitlist" className="inline-flex items-center gap-1.5 rounded border border-black/10 bg-white px-3 py-2 text-xs font-semibold"><Download size={13} /> CSV</Link></div>
    <form className="mb-3 grid gap-2 rounded-md border border-black/10 bg-white p-3 sm:grid-cols-[1fr_220px_100px]"><input name="q" defaultValue={filters.q} placeholder="Nom, email ou téléphone" className="input text-xs" /><select name="type" defaultValue={filters.type} className="input text-xs"><option value="">Tous les types</option><option value="comptable">Comptable</option><option value="entrepreneur">Entrepreneur</option></select><button className="rounded bg-[#0D1526] text-xs font-bold text-white">Filtrer</button></form>
    <div className="overflow-x-auto rounded-md border border-black/10 bg-white"><table className="w-full text-left text-[11px]"><thead className="bg-[#F8F8F5] text-gray-500"><tr>{["Nom", "Email", "Téléphone", "Source", "Date", ""].map(value => <th key={value} className="px-3 py-2.5">{value}</th>)}</tr></thead><tbody className="divide-y divide-black/5">{rows.map(item => <tr key={item.id}><td className="px-3 py-3 font-bold">{item.nom || "—"}</td><td className="px-3 py-3">{item.email}</td><td className="px-3 py-3">{item.telephone || "—"}</td><td className="px-3 py-3">{item.source || item.track || "—"}</td><td className="px-3 py-3">{formatDate(item.created_at)}</td><td className="px-3 py-3"><CreateAccountButton prefill={{ email: item.email, name: item.nom }} /></td></tr>)}</tbody></table></div>
  </div>;
}
