import Link from "next/link";
import { Activity, Building2, CreditCard, FileScan, Inbox, Users } from "lucide-react";
import { AccountActions, StatusBadge } from "@/components/admin/AdminUI";
import { adminContext, formatDate, formatMoney } from "@/lib/admin-data";

export default async function AdminDashboard() {
  const { admin } = await adminContext();
  const weekStart = new Date(Date.now() - 7 * 86400000);
  const inSevenDays = new Date(Date.now() + 7 * 86400000);
  const [companies, subscriptions, upgrades, custom, audits, responsables] = await Promise.all([
    admin.from("companies").select("id, raison_sociale, plan, subscription_status, subscription_ends_at, is_suspended, ocr_used_this_month, created_at"),
    admin.from("subscriptions").select("company_id, amount_mad, billing_period, payment_method, starts_at, ends_at, status"),
    admin.from("upgrade_requests").select("id", { count: "exact", head: true }).eq("status", "nouveau"),
    admin.from("custom_requests").select("id", { count: "exact", head: true }).eq("status", "nouveau"),
    admin.from("audit_logs").select("id, action, entity_label, user_email, created_at").or("action.like.ADMIN_%,action.ilike.%signup%").order("created_at", { ascending: false }).limit(20),
    admin.from("user_memberships").select("id", { count: "exact", head: true }).eq("role_name", "manager").neq("status", "revoked"),
  ]);
  const rows = companies.data ?? [];
  const activeSubscriptions = (subscriptions.data ?? []).filter(item => item.status === "active");
  const paidCompanyIds = new Set(activeSubscriptions
    .filter(item => Number(item.amount_mad ?? 0) > 0 && item.payment_method !== "gratuit")
    .map(item => item.company_id));
  const revenue = activeSubscriptions.reduce((sum, item) => sum + Number(item.amount_mad ?? 0) / (item.billing_period === "annual" ? 12 : 1), 0);
  const expiring = rows.filter(item => item.subscription_ends_at && new Date(item.subscription_ends_at) >= new Date() && new Date(item.subscription_ends_at) <= inSevenDays).length;
  const cards = [
    { label: "Comptes", value: rows.length, icon: Building2 },
    { label: "Collaborateurs", value: responsables.count ?? 0, icon: Users },
    { label: "Abonnés payants", value: paidCompanyIds.size, icon: CreditCard },
    { label: "Essais en cours", value: rows.filter(item => item.subscription_status === "trial").length, icon: Users },
    { label: "Comptes suspendus", value: rows.filter(item => item.is_suspended).length, icon: Users },
    { label: "Expirent sous 7 jours", value: expiring, icon: CreditCard },
    { label: "Demandes ouvertes", value: (upgrades.count ?? 0) + (custom.count ?? 0), icon: Inbox },
    { label: "Scans OCR ce mois", value: rows.reduce((sum, item) => sum + Number(item.ocr_used_this_month ?? 0), 0), icon: FileScan },
    { label: "Inscriptions cette semaine", value: rows.filter(item => new Date(item.created_at) >= weekStart).length, icon: Building2 },
    { label: "MRR estimé", value: formatMoney(revenue), icon: Activity },
  ];
  return <div>
    <div className="mb-5 flex items-end justify-between"><div><h1 className="text-xl font-bold">Tableau de bord</h1><p className="mt-1 text-xs text-gray-500">Vue opérationnelle de Mohasib AI</p></div><Link href="/admin/comptes" className="text-xs font-semibold text-[#C8924A]">Gérer les comptes →</Link></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{cards.map(({ label, value, icon: Icon }) => <div key={label} className="rounded-md border border-black/10 bg-white p-4"><Icon size={15} className="text-[#C8924A]" /><div className="mt-3 text-xl font-bold">{value}</div><div className="mt-1 text-[10px] text-gray-500">{label}</div></div>)}</div>
    <section className="mt-5 rounded-md border border-black/10 bg-white">
      <div className="flex items-center justify-between border-b border-black/10 px-4 py-3"><div><h2 className="text-sm font-bold">Gestion rapide des comptes</h2><p className="mt-0.5 text-[10px] text-gray-500">Configurez le tarif ou ouvrez le dossier administratif du compte.</p></div><Link href="/admin/comptes" className="text-[11px] font-semibold text-[#C8924A]">Tous les comptes →</Link></div>
      <div className="overflow-x-auto"><table className="w-full text-left text-[11px]"><thead className="bg-[#F8F8F5] text-gray-500"><tr>{["Société", "Accès", "Actions"].map(value => <th key={value} className="px-4 py-2.5 font-semibold">{value}</th>)}</tr></thead><tbody className="divide-y divide-black/5">{rows.slice(0, 8).map(company => <tr key={company.id}><td className="px-4 py-3 font-bold">{company.raison_sociale || "Sans nom"}</td><td className="px-4 py-3"><StatusBadge status={company.is_suspended ? "suspended" : company.subscription_status} /></td><td className="px-4 py-3"><AccountActions id={company.id} /></td></tr>)}</tbody></table></div>
    </section>
    <section className="mt-5 rounded-md border border-black/10 bg-white">
      <div className="border-b border-black/10 px-4 py-3"><h2 className="text-sm font-bold">Activité administrative récente</h2></div>
      <div className="divide-y divide-black/5">{(audits.data ?? []).map(event => <div key={event.id} className="grid gap-1 px-4 py-3 text-[11px] sm:grid-cols-[180px_1fr_180px]"><span className="font-semibold">{event.action.replace("ADMIN_", "")}</span><span className="text-gray-600">{event.entity_label || "—"}</span><span className="text-gray-400 sm:text-right">{event.user_email} · {formatDate(event.created_at)}</span></div>)}</div>
    </section>
  </div>;
}
