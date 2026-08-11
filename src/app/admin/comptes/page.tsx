import { CreateAccountButton } from "@/components/admin/AdminUI";
import { AdminAccountsTable, type AdminAccountRow } from "@/components/admin/AdminAccountsTable";
import { AdminDateRangeFilter } from "@/components/admin/AdminDateRangeFilter";
import { accountStatus, adminContext, authUserMap, formatDate } from "@/lib/admin-data";
import { adminDateRange, inAdminDateRange } from "@/lib/admin-date-range";

export default async function AccountsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const filters = await searchParams;
  const dateRange = adminDateRange(filters);
  const { admin } = await adminContext();
  const [companies, users] = await Promise.all([
    admin.from("companies").select("id, user_id, raison_sociale, email, phone, ice, user_type, plan, subscription_status, subscription_ends_at, trial_ends_at, is_suspended, lifecycle_stage, admin_tags, admin_owner_email, created_at").order("created_at", { ascending: false }),
    authUserMap(),
  ]);
  const search = (filters.q ?? "").toLowerCase();
  const rows = (companies.data ?? []).filter(company => {
    const email = users.get(company.user_id)?.email ?? "";
    const status = accountStatus(company);
    return (!search || `${company.raison_sociale} ${email} ${company.phone ?? ""} ${company.ice ?? ""}`.toLowerCase().includes(search))
      && inAdminDateRange(company.created_at, dateRange)
      && (!filters.status || status === filters.status)
      && (!filters.type || company.user_type === filters.type)
      && (!filters.tag || (company.admin_tags ?? []).includes(filters.tag.toLowerCase()));
  });
  const tableRows: AdminAccountRow[] = rows.map(company => ({
    id: company.id,
    name: company.raison_sociale || "Sans nom",
    email: users.get(company.user_id)?.email || company.email || "—",
    phone: company.phone || users.get(company.user_id)?.user_metadata?.phone || "—",
    type: company.user_type || "—",
    status: accountStatus(company),
    endDate: formatDate(company.subscription_ends_at || company.trial_ends_at),
    createdDate: formatDate(company.created_at),
    tags: company.admin_tags ?? [],
    owner: company.admin_owner_email || "Non assigné",
  }));
  return <div>
    <div className="mb-5 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-xl font-bold">Comptes</h1><p className="mt-1 text-xs text-gray-500">{rows.length} compte(s)</p></div><CreateAccountButton /></div>
    <form className="mb-3 grid gap-2 rounded-md border border-black/10 bg-white p-3 sm:grid-cols-7">
      <input name="q" defaultValue={filters.q} placeholder="Nom, email ou téléphone" className="input text-xs sm:col-span-2" />
      <select name="status" defaultValue={filters.status} className="input text-xs"><option value="">Tous les statuts</option>{["free", "trial", "active", "grace", "expired", "suspended", "archived"].map(value => <option key={value}>{value}</option>)}</select>
      <select name="type" defaultValue={filters.type} className="input text-xs"><option value="">Tous les types</option><option value="entrepreneur">Entrepreneur</option><option value="fiduciaire">Comptable</option></select>
      <input name="tag" defaultValue={filters.tag} placeholder="Tag interne" className="input text-xs" />
      <AdminDateRangeFilter range={dateRange} className="sm:col-span-5" />
      <button className="min-h-10 rounded bg-[#0D1526] px-3 text-xs font-bold text-white">Filtrer</button>
    </form>
    <AdminAccountsTable rows={tableRows} />
  </div>;
}
