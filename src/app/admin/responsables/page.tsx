import Link from "next/link";
import { AuthUnbanButton, MemberAccessScopeSelect, MemberToggle } from "@/components/admin/AdminControls";
import { StatusBadge } from "@/components/admin/AdminUI";
import ResponsibleInviteButton from "@/components/admin/ResponsibleInviteButton";
import { adminContext, authUserMap, formatDate } from "@/lib/admin-data";

export default async function ResponsablesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const filters = await searchParams;
  const { admin } = await adminContext();
  const [memberships, users, companiesRes] = await Promise.all([
    admin.from("user_memberships")
      .select("id,user_id,user_email,first_name,last_name,company_id,role_name,access_scope,status,invited_at,accepted_at,created_at,companies(raison_sociale)")
      .neq("status", "revoked")
      .order("created_at", { ascending: false }),
    authUserMap(),
    admin.from("companies").select("id,raison_sociale,email").order("raison_sociale"),
  ]);
  const companies = (companiesRes.data ?? []).map(company => ({
    id: company.id,
    name: company.raison_sociale || company.email || "Compte sans nom",
  }));
  const q = (filters.q ?? "").toLowerCase();
  const rows = (memberships.data ?? []).filter(member => {
    const company = Array.isArray(member.companies) ? member.companies[0] : member.companies;
    return !["owner", "cabinet_owner"].includes(member.role_name)
      && (!q || `${member.first_name ?? ""} ${member.last_name ?? ""} ${member.user_email ?? ""} ${company?.raison_sociale ?? ""}`.toLowerCase().includes(q));
  });
  const usersByEmail = new Map([...users.values()].filter(user => user.email).map(user => [user.email!.toLowerCase(), user]));

  return <div>
    <div className="mb-5 flex flex-col items-stretch gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h1 className="text-xl font-bold">Collaborateurs</h1><p className="mt-1 text-xs text-gray-500">{rows.length} collaborateur(s), invitations incluses</p></div><ResponsibleInviteButton companies={companies} /></div>
    <form className="mb-3 grid gap-2 rounded-md border border-black/10 bg-white p-3 sm:grid-cols-[1fr_100px]">
      <input name="q" defaultValue={filters.q} placeholder="Nom, email ou société" className="input text-xs" />
      <button className="rounded bg-[#0D1526] text-xs font-bold text-white">Filtrer</button>
    </form>
    <div className="overflow-x-auto rounded-md border border-black/10 bg-white"><table className="w-full text-left text-[11px]"><thead className="bg-[#F8F8F5] text-gray-500"><tr>{["Collaborateur", "Compte", "Rôle", "Périmètre", "Statut", "Dernière connexion", "Depuis", "Actions"].map(value => <th key={value} className="px-3 py-2.5 font-semibold">{value}</th>)}</tr></thead><tbody className="divide-y divide-black/5">{rows.map(member => {
      const company = Array.isArray(member.companies) ? member.companies[0] : member.companies;
      const authUser = (member.user_id ? users.get(member.user_id) : null) ?? (member.user_email ? usersByEmail.get(member.user_email.toLowerCase()) : null);
      const authBanned = !!authUser?.banned_until && new Date(authUser.banned_until) > new Date();
      return <tr key={member.id}><td className="px-3 py-3"><b>{`${member.first_name ?? ""} ${member.last_name ?? ""}`.trim() || member.user_email || "Invitation"}</b>{member.first_name && <div className="text-gray-400">{member.user_email}</div>}</td><td className="px-3 py-3 font-semibold"><Link href={`/admin/comptes/${member.company_id}`}>{company?.raison_sociale || "—"}</Link></td><td className="px-3 py-3">Collaborateur</td><td className="px-3 py-3"><MemberAccessScopeSelect id={member.id} current={member.access_scope} /></td><td className="px-3 py-3"><StatusBadge status={authBanned ? "banned" : member.status} /></td><td className="px-3 py-3 text-gray-500">{formatDate(authUser?.last_sign_in_at)}</td><td className="px-3 py-3 text-gray-500">{formatDate(member.accepted_at || member.invited_at || member.created_at)}</td><td className="px-3 py-3"><div className="flex gap-1.5"><MemberToggle id={member.id} suspended={member.status === "suspended"} authBanned={authBanned} /><AuthUnbanButton id={member.id} /></div></td></tr>;
    })}</tbody></table></div>
  </div>;
}
