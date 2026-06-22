import { Download } from "lucide-react";
import Link from "next/link";
import { CreateAccountButton, StatusBadge } from "@/components/admin/AdminUI";
import { adminContext, formatDate } from "@/lib/admin-data";

export default async function WaitlistPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const filters = await searchParams;
  const { admin } = await adminContext();
  const { data } = await admin
    .from("fiduciaire_waitlist")
    .select("*")
    .eq("request_kind", "demo")
    .order("created_at", { ascending: false });
  const q = (filters.q ?? "").toLowerCase();
  const rows = (data ?? []).filter((item) => {
    const searchable = `${item.nom ?? ""} ${item.email ?? ""} ${item.telephone ?? ""} ${item.entreprise ?? ""}`.toLowerCase();
    return (!q || searchable.includes(q))
      && (!filters.status || item.status === filters.status);
  });

  return (
    <div>
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold">Liste d’attente</h1>
          <p className="mt-1 text-xs text-gray-500">{rows.length} demande(s)</p>
        </div>
        <Link href="/api/admin/export/waitlist" className="inline-flex items-center gap-1.5 rounded border border-black/10 bg-white px-3 py-2 text-xs font-semibold">
          <Download size={13} /> CSV
        </Link>
      </div>

      <form className="mb-3 grid gap-2 rounded-md border border-black/10 bg-white p-3 lg:grid-cols-[1fr_170px_90px]">
        <input name="q" defaultValue={filters.q} placeholder="Nom, email, entreprise" className="input text-xs" />
        <select name="status" defaultValue={filters.status} className="input text-xs">
          <option value="">Tous les statuts</option>
          <option value="pending">En attente</option>
          <option value="approved">Approuvés</option>
          <option value="rejected">Refusés</option>
        </select>
        <button className="rounded bg-[#0D1526] text-xs font-bold text-white">Filtrer</button>
      </form>

      <div className="overflow-x-auto rounded-md border border-black/10 bg-white">
        <table className="w-full text-left text-[11px]">
          <thead className="bg-[#F8F8F5] text-gray-500">
            <tr>
              {["Nom / entreprise", "Email", "Téléphone", "Origine", "Statut", "Date", "Action"].map((value) => (
                <th key={value} className="px-3 py-2.5">{value}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {rows.map((item) => (
              <tr key={item.id}>
                <td className="px-3 py-3">
                  <div className="font-bold">{item.nom || "—"}</div>
                  {item.entreprise && <div className="mt-0.5 text-gray-400">{item.entreprise}</div>}
                </td>
                <td className="px-3 py-3">{item.email}</td>
                <td className="px-3 py-3">{item.telephone || "—"}</td>
                <td className="px-3 py-3">Démo</td>
                <td className="px-3 py-3"><StatusBadge status={item.status || "pending"} /></td>
                <td className="px-3 py-3">{formatDate(item.created_at)}</td>
                <td className="px-3 py-3">
                  {item.status === "approved" ? (
                    <span className="font-semibold text-emerald-700">Activé</span>
                  ) : (
                    <CreateAccountButton
                      waitlistId={item.id}
                      prefill={{ email: item.email, name: item.nom, company: item.entreprise }}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
