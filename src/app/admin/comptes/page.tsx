import Link from "next/link";
import { AccountActions, CreateAccountButton, StatusBadge } from "@/components/admin/AdminUI";
import { accountStatus, adminContext, authUserMap, formatDate } from "@/lib/admin-data";

export default async function AccountsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const filters = await searchParams;
  const { admin } = await adminContext();
  const [companies, users] = await Promise.all([
    admin.from("companies").select("id, user_id, raison_sociale, ice, user_type, plan, subscription_status, subscription_ends_at, trial_ends_at, is_suspended, created_at").order("created_at", { ascending: false }),
    authUserMap(),
  ]);
  const search = (filters.q ?? "").toLowerCase();
  const rows = (companies.data ?? []).filter(company => {
    const email = users.get(company.user_id)?.email ?? "";
    const status = accountStatus(company);
    return (!search || `${company.raison_sociale} ${email} ${company.ice ?? ""}`.toLowerCase().includes(search))
      && (!filters.plan || company.plan === filters.plan)
      && (!filters.status || status === filters.status)
      && (!filters.type || company.user_type === filters.type);
  });
  return <div>
    <div className="mb-5 flex items-center justify-between"><div><h1 className="text-xl font-bold">Comptes</h1><p className="mt-1 text-xs text-gray-500">{rows.length} compte(s)</p></div><CreateAccountButton /></div>
    <form className="mb-3 grid gap-2 rounded-md border border-black/10 bg-white p-3 sm:grid-cols-6">
      <input name="q" defaultValue={filters.q} placeholder="Nom ou email" className="input text-xs sm:col-span-2" />
      <select name="plan" defaultValue={filters.plan} className="input text-xs"><option value="">Tous les plans</option>{["trial", "starter", "business", "business_pro", "comptable_s", "comptable_pro", "comptable_inf"].map(value => <option key={value}>{value}</option>)}</select>
      <select name="status" defaultValue={filters.status} className="input text-xs"><option value="">Tous les statuts</option>{["trial", "active", "grace", "expired", "suspended"].map(value => <option key={value}>{value}</option>)}</select>
      <select name="type" defaultValue={filters.type} className="input text-xs"><option value="">Tous les types</option><option value="entrepreneur">Entrepreneur</option><option value="fiduciaire">Comptable</option></select>
      <button className="rounded bg-[#0D1526] px-3 text-xs font-bold text-white">Filtrer</button>
    </form>
    <div className="overflow-x-auto rounded-md border border-black/10 bg-white"><table className="w-full text-left text-[11px]"><thead className="bg-[#F8F8F5] text-gray-500"><tr>{["Compte", "Email propriétaire", "Type", "Plan", "Statut", "Fin", "Créé", "Actions"].map(value => <th key={value} className="px-3 py-2.5 font-semibold">{value}</th>)}</tr></thead><tbody className="divide-y divide-black/5">{rows.map(company => <tr key={company.id} className="hover:bg-black/[.015]"><td className="px-3 py-3 font-bold"><Link href={`/admin/comptes/${company.id}`}>{company.raison_sociale || "Sans nom"}</Link></td><td className="px-3 py-3 text-gray-500">{users.get(company.user_id)?.email || "—"}</td><td className="px-3 py-3">{company.user_type || "—"}</td><td className="px-3 py-3 font-semibold">{company.plan || "trial"}</td><td className="px-3 py-3"><StatusBadge status={accountStatus(company)} /></td><td className="px-3 py-3">{formatDate(company.subscription_ends_at || company.trial_ends_at)}</td><td className="px-3 py-3 text-gray-500">{formatDate(company.created_at)}</td><td className="px-3 py-3"><AccountActions id={company.id} name={company.raison_sociale} currentPlan={company.plan} /></td></tr>)}</tbody></table></div>
  </div>;
}
