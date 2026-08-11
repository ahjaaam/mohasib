import { NotificationComposer, CampaignAction } from "@/components/admin/AdminNotifications";
import { adminContext, authUserMap, formatDate } from "@/lib/admin-data";

export default async function AdminNotificationsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const filters = await searchParams;
  const { admin } = await adminContext();
  const [campaigns, deliveries, companies, users] = await Promise.all([
    admin.from("notification_campaigns").select("*").order("created_at", { ascending: false }).limit(100),
    admin.from("notification_deliveries").select("campaign_id,status,channel,read_at,clicked_at"),
    admin.from("companies").select("id,raison_sociale,email,user_id").order("raison_sociale"),
    authUserMap(),
  ]);
  const deliveryRows = deliveries.data ?? [];
  const userOptions = [...users.values()].filter(user => user.email).map(user => ({ id: user.id, label: `${user.user_metadata?.full_name || user.email} — ${user.email}` }));
  const companyOptions = (companies.data ?? []).map(company => ({ id: company.id, label: `${company.raison_sociale || "Sans nom"} — ${users.get(company.user_id)?.email || company.email || "—"}` }));

  return <div>
    <div className="mb-5"><h1 className="text-xl font-bold">Notifications utilisateurs</h1><p className="mt-1 text-xs text-gray-500">Composez, ciblez, programmez et mesurez les communications.</p></div>
    <section className="rounded-md border border-[#C8924A]/30 bg-white p-4"><h2 className="mb-4 text-sm font-bold">Nouvelle notification</h2><NotificationComposer users={userOptions} companies={companyOptions} initialCompanyIds={(filters.companies || filters.company || "").split(",").filter(Boolean)} initialUserIds={(filters.users || filters.user || "").split(",").filter(Boolean)} /></section>
    <section className="mt-5 overflow-hidden rounded-md border border-black/10 bg-white">
      <h2 className="border-b border-black/10 px-4 py-3 text-sm font-bold">Historique des campagnes</h2>
      <div className="overflow-x-auto"><table className="w-full text-left text-[11px]"><thead className="bg-[#F8F8F5] text-gray-500"><tr>{["Campagne", "Audience", "Canal", "Statut", "Résultats", "Créée", "Actions"].map(label => <th key={label} className="px-3 py-2.5">{label}</th>)}</tr></thead>
      <tbody className="divide-y divide-black/5">{(campaigns.data ?? []).map(campaign => {
        const rows = deliveryRows.filter(item => item.campaign_id === campaign.id);
        const read = rows.filter(item => item.read_at).length;
        const clicked = rows.filter(item => item.clicked_at).length;
        return <tr key={campaign.id}><td className="px-3 py-3"><b>{campaign.title}</b><div className="mt-0.5 max-w-sm truncate text-gray-400">{campaign.message}</div></td><td className="px-3 py-3">{campaign.audience?.type || "all"}</td><td className="px-3 py-3">{campaign.channel}</td><td className="px-3 py-3 font-semibold">{campaign.status}</td><td className="px-3 py-3"><b>{campaign.delivered_count || 0}</b> livrées · {read} lues · {clicked} clics{campaign.failed_count ? <span className="text-red-600"> · {campaign.failed_count} échecs</span> : null}</td><td className="px-3 py-3 text-gray-500">{formatDate(campaign.created_at)}<div>{campaign.created_by_email}</div></td><td className="px-3 py-3"><div className="flex gap-1">{["draft", "scheduled"].includes(campaign.status) && <CampaignAction id={campaign.id} action="send" label="Envoyer" />}{campaign.status === "failed" && <CampaignAction id={campaign.id} action="retry" label="Réessayer" />}{["draft", "scheduled"].includes(campaign.status) && <CampaignAction id={campaign.id} action="cancel" label="Annuler" danger />}</div></td></tr>;
      })}{(campaigns.data ?? []).length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Aucune campagne.</td></tr>}</tbody></table></div>
    </section>
  </div>;
}
