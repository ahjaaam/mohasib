import type { User } from "@supabase/supabase-js";
import { AdminUsersTable, type AdminUserRow } from "@/components/admin/AdminUsersTable";
import { adminContext, formatDate } from "@/lib/admin-data";

const DAY = 86_400_000;

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const filters = await searchParams;
  const { admin } = await adminContext();
  const nowDate = new Date();
  const now = nowDate.getTime();
  const activityCutoff = new Date(now - 30 * DAY).toISOString();
  const authResult = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const [companiesRes, membershipsRes, invoicesRes, documentsRes, receiptsRes, ticketsRes, notificationsRes] = await Promise.all([
    admin.from("companies").select("id,user_id,raison_sociale,email,user_type,subscription_status,is_suspended,created_at"),
    admin.from("user_memberships").select("user_id,user_email,company_id,role_name,status,created_at,accepted_at").neq("status", "revoked"),
    admin.from("invoices").select("user_id,created_at").gte("created_at", activityCutoff).limit(10000),
    admin.from("company_documents").select("user_id,created_at").gte("created_at", activityCutoff).limit(10000),
    admin.from("receipts").select("user_id,created_at").gte("created_at", activityCutoff).limit(10000),
    admin.from("support_tickets").select("user_id,status,created_at").neq("status", "finalisé"),
    admin.from("notifications").select("user_id,is_read,is_dismissed,created_at").eq("is_read", false).eq("is_dismissed", false),
  ]);
  const users = (authResult.data.users ?? []) as User[];
  const companies = companiesRes.data ?? [];
  const memberships = membershipsRes.data ?? [];
  const companyByOwner = new Map(companies.map(company => [company.user_id, company]));
  const membershipByUser = new Map(memberships.filter(item => item.user_id).map(item => [item.user_id, item]));
  const companyById = new Map(companies.map(company => [company.id, company]));
  const activity = [...(invoicesRes.data ?? []), ...(documentsRes.data ?? []), ...(receiptsRes.data ?? [])];
  const q = (filters.q ?? "").trim().toLowerCase();
  const rows: AdminUserRow[] = users.map(user => {
    const ownedCompany = companyByOwner.get(user.id);
    const membership = membershipByUser.get(user.id);
    const company = ownedCompany ?? companyById.get(membership?.company_id);
    const userActivity = activity.filter(item => item.user_id === user.id);
    const latestActivity = userActivity.map(item => item.created_at).filter(Boolean).sort().at(-1) ?? user.last_sign_in_at ?? user.created_at;
    const banned = !!user.banned_until && new Date(user.banned_until).getTime() > now;
    const status = banned || membership?.status === "suspended" ? "suspended" : !user.email_confirmed_at ? "unverified" : user.last_sign_in_at ? "active" : "invited";
    const activityCount = userActivity.length;
    const daysSinceActivity = latestActivity ? Math.max(0, Math.floor((now - new Date(latestActivity).getTime()) / DAY)) : 999;
    const setupPoints = company ? 25 : 0;
    const activityPoints = Math.min(45, activityCount * 5);
    const recencyPoints = daysSinceActivity <= 7 ? 30 : daysSinceActivity <= 30 ? 15 : 0;
    return {
      id: user.id,
      name: String(user.user_metadata?.full_name ?? ""),
      email: user.email ?? membership?.user_email ?? "—",
      phone: String(user.phone || user.user_metadata?.phone || "—"),
      companyId: company?.id ?? null,
      company: company?.raison_sociale || "Sans compte",
      role: ownedCompany ? "Propriétaire" : membership?.role_name || "Utilisateur",
      status,
      createdAt: formatDate(user.created_at),
      lastSignIn: formatDate(user.last_sign_in_at),
      lastActivity: formatDate(latestActivity),
      lastActivityAt: latestActivity ? new Date(latestActivity).getTime() : 0,
      activityCount,
      unreadCount: (notificationsRes.data ?? []).filter(item => item.user_id === user.id).length,
      ticketCount: (ticketsRes.data ?? []).filter(item => item.user_id === user.id && !["finalisé", "cancelled"].includes(item.status)).length,
      health: Math.min(100, setupPoints + activityPoints + recencyPoints),
    };
  }).filter(row => (!q || `${row.name} ${row.email} ${row.phone} ${row.company}`.toLowerCase().includes(q)) && (!filters.status || row.status === filters.status) && (!filters.role || row.role === filters.role) && (!filters.inactive || row.lastActivityAt <= now - Number(filters.inactive) * DAY));

  return <div><div className="mb-5"><h1 className="text-xl font-bold">Utilisateurs</h1><p className="mt-1 text-xs text-gray-500">{rows.length} utilisateur(s) · propriétaires, collaborateurs et accès clients</p></div>
    <form className="mb-3 grid gap-2 rounded-md border border-black/10 bg-white p-3 sm:grid-cols-5"><input name="q" defaultValue={filters.q} placeholder="Nom, email, téléphone, compte" className="input text-xs sm:col-span-2" /><select name="status" defaultValue={filters.status} className="input text-xs"><option value="">Tous les états</option>{["active", "invited", "unverified", "suspended"].map(value => <option key={value}>{value}</option>)}</select><select name="role" defaultValue={filters.role} className="input text-xs"><option value="">Tous les rôles</option><option>Propriétaire</option><option value="manager">Collaborateur</option><option value="client_portal">Client</option></select><div className="flex gap-2"><input name="inactive" type="number" min="1" defaultValue={filters.inactive} placeholder="Inactif jours" className="input min-w-0 text-xs" /><button className="rounded bg-[#0D1526] px-3 text-xs font-bold text-white">Filtrer</button></div></form>
    <AdminUsersTable rows={rows} />
  </div>;
}
