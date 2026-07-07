import { Download } from "lucide-react";
import Link from "next/link";
import { adminContext, formatDate } from "@/lib/admin-data";

type ResourceLead = {
  id: string;
  email: string;
  phone: string | null;
  resource_title: string | null;
  resource_slug: string | null;
  source: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  created_at: string | null;
};

export default async function ResourceLeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const filters = await searchParams;
  const { admin } = await adminContext();
  const { data } = await admin
    .from("resource_leads")
    .select("id,email,phone,resource_title,resource_slug,source,utm_source,utm_campaign,created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  const q = (filters.q ?? "").toLowerCase();
  const rows = ((data ?? []) as ResourceLead[]).filter((item) => {
    const searchable = `${item.email ?? ""} ${item.phone ?? ""} ${item.resource_title ?? ""} ${item.resource_slug ?? ""} ${item.source ?? ""}`.toLowerCase();
    return !q || searchable.includes(q);
  });

  const topResources = rows.reduce<Record<string, number>>((acc, item) => {
    const key = item.resource_title || item.resource_slug || item.source || "Document inconnu";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Leads documents</h1>
          <p className="mt-1 text-xs text-gray-500">{rows.length} lead(s) capturé(s) via la bibliothèque de documents</p>
        </div>
        <Link href="/api/admin/export/resource-leads" className="inline-flex items-center gap-1.5 rounded border border-black/10 bg-white px-3 py-2 text-xs font-semibold">
          <Download size={13} /> CSV
        </Link>
      </div>

      <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_320px]">
        <form className="rounded-md border border-black/10 bg-white p-3">
          <input name="q" defaultValue={filters.q} placeholder="Rechercher email, téléphone, document, source..." className="input text-xs" />
        </form>
        <section className="rounded-md border border-black/10 bg-white p-3">
          <h2 className="text-xs font-bold text-[#0D1526]">Top documents</h2>
          <div className="mt-2 space-y-1 text-[11px]">
            {Object.entries(topResources).slice(0, 4).map(([title, count]) => (
              <div key={title} className="flex justify-between gap-3">
                <span className="truncate text-gray-500">{title}</span>
                <b>{count}</b>
              </div>
            ))}
            {Object.keys(topResources).length === 0 && <span className="text-gray-400">Aucun lead pour le moment</span>}
          </div>
        </section>
      </div>

      <div className="overflow-x-auto rounded-md border border-black/10 bg-white">
        <table className="w-full text-left text-[11px]">
          <thead className="bg-[#F8F8F5] text-gray-500">
            <tr>
              {["Email", "Téléphone", "Document", "Source", "UTM", "Date"].map((value) => (
                <th key={value} className="px-3 py-2.5">{value}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {rows.map((item) => (
              <tr key={item.id}>
                <td className="px-3 py-3 font-semibold">{item.email}</td>
                <td className="px-3 py-3 text-gray-600">{item.phone || "—"}</td>
                <td className="px-3 py-3">
                  <div className="font-bold">{item.resource_title || "—"}</div>
                  {item.resource_slug && <div className="mt-0.5 text-gray-400">{item.resource_slug}</div>}
                </td>
                <td className="px-3 py-3">{item.source || "—"}</td>
                <td className="px-3 py-3 text-gray-500">
                  {[item.utm_source, item.utm_campaign].filter(Boolean).join(" / ") || "—"}
                </td>
                <td className="px-3 py-3 text-gray-500">{formatDate(item.created_at)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-xs text-gray-400">Aucun lead document trouvé</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
