import { notFound } from "next/navigation";
import { AccountControls, MemberAccessScopeSelect, MemberToggle } from "@/components/admin/AdminControls";
import { StatusBadge } from "@/components/admin/AdminUI";
import { accountStatus, adminContext, authUserMap, formatDate, formatMoney } from "@/lib/admin-data";
import { TRIAL_LIMITS } from "@/lib/trial-limits";

export default async function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { admin } = await adminContext();
  const [companyRes, subscriptions, override, members, audits, limits, users] = await Promise.all([
    admin.from("companies").select("*").eq("id", id).maybeSingle(),
    admin.from("subscriptions").select("*").eq("company_id", id).order("created_at", { ascending: false }),
    admin.from("company_limit_overrides").select("*").eq("company_id", id).maybeSingle(),
    admin.from("user_memberships").select("*").eq("company_id", id).order("created_at", { ascending: false }),
    admin.from("audit_logs").select("*").eq("company_id", id).order("created_at", { ascending: false }).limit(30),
    admin.from("plan_limits").select("*"),
    authUserMap(),
  ]);
  const company = companyRes.data;
  if (!company) notFound();
  const owner = users.get(company.user_id);
  const plan = (limits.data ?? []).find(item => item.plan === company.plan);
  return <div>
    <div className="mb-5"><div className="flex items-center gap-2"><h1 className="text-xl font-bold">{company.raison_sociale || "Compte sans nom"}</h1><StatusBadge status={accountStatus(company)} /></div><p className="mt-1 text-xs text-gray-500">{owner?.email || "—"} · {company.user_type || "—"} · créé {formatDate(company.created_at)}</p></div>
    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{[
      ["Plan", company.plan || "trial"],
      ["Fin abonnement", formatDate(company.subscription_ends_at || company.trial_ends_at)],
      ["OCR", `${company.ocr_used_this_month ?? 0} / ${override.data?.ocr_limit ?? plan?.ocr_limit ?? "—"}`],
      ["Utilisateurs", `${(members.data ?? []).filter(item => item.status === "active").length} / ${override.data?.users_limit ?? plan?.users_limit ?? "—"}`],
      ["Revenu cumulé", formatMoney((subscriptions.data ?? []).reduce((sum, item) => sum + Number(item.amount_mad ?? 0), 0))],
    ].map(([label, value]) => <div key={label} className="rounded-md border border-black/10 bg-white p-4"><div className="text-[10px] text-gray-500">{label}</div><div className="mt-2 text-sm font-bold">{value}</div></div>)}</div>
    <section className="mb-5 rounded-md border border-black/10 bg-white p-4"><h2 className="text-sm font-bold">Identité</h2><div className="mt-3 grid gap-3 text-[11px] sm:grid-cols-3 xl:grid-cols-6">{[["Email", owner?.email], ["ICE", company.ice], ["IF", company.if_number], ["Ville", company.city], ["Type", company.user_type], ["Dernière connexion", formatDate(owner?.last_sign_in_at)]].map(([label, value]) => <div key={label}><div className="text-gray-400">{label}</div><div className="mt-1 font-semibold">{value || "—"}</div></div>)}</div></section>
    {company.subscription_status === "trial" && (
      <section className="mb-5 rounded-md border border-amber-200 bg-amber-50 p-4">
        <h2 className="text-sm font-bold">Utilisation essai</h2>
        <p className="mt-2 text-[12px] text-amber-900">
          Factures {company.trial_invoices_used ?? 0}/{TRIAL_LIMITS.invoices} · Scans {company.trial_ocr_used ?? 0}/{TRIAL_LIMITS.ocr_scans} · Documents {company.trial_documents_used ?? 0}/{TRIAL_LIMITS.documents} · Relevés {company.trial_bank_statements_used ?? 0}/{TRIAL_LIMITS.bank_statements} · Employés {company.trial_employees_used ?? 0}/{TRIAL_LIMITS.employees} · Dossiers {company.trial_dossiers_used ?? 0}/{TRIAL_LIMITS.dossiers} · TVA {company.trial_tva_declarations_used ?? 0}/{TRIAL_LIMITS.tva_declarations}
        </p>
      </section>
    )}
    <AccountControls company={company} />
    <div className="mt-5 grid gap-5 xl:grid-cols-2">
      <section className="rounded-md border border-black/10 bg-white"><h2 className="border-b border-black/10 px-4 py-3 text-sm font-bold">Collaborateurs</h2><div className="divide-y divide-black/5">{(members.data ?? []).map(member => <div key={member.id} className="flex items-center justify-between gap-3 px-4 py-3 text-[11px]"><div><b>{`${member.first_name ?? ""} ${member.last_name ?? ""}`.trim() || member.user_email || "Invitation"}</b><div className="text-gray-500">{member.user_email} · Collaborateur · {member.status}</div></div><div className="flex flex-wrap items-center justify-end gap-2"><MemberAccessScopeSelect id={member.id} current={member.access_scope} /><MemberToggle id={member.id} suspended={member.status === "suspended"} /></div></div>)}</div></section>
      <section className="rounded-md border border-black/10 bg-white"><h2 className="border-b border-black/10 px-4 py-3 text-sm font-bold">Historique d’abonnement</h2><div className="divide-y divide-black/5">{(subscriptions.data ?? []).map(item => <div key={item.id} className="grid grid-cols-3 px-4 py-3 text-[11px]"><b>{item.plan}</b><span>{formatMoney(item.amount_mad)}</span><span className="text-right text-gray-500">{formatDate(item.starts_at)} → {formatDate(item.ends_at)}</span></div>)}</div></section>
    </div>
    <section className="mt-5 rounded-md border border-black/10 bg-white"><h2 className="border-b border-black/10 px-4 py-3 text-sm font-bold">Journal d’audit</h2><div className="divide-y divide-black/5">{(audits.data ?? []).map(item => <div key={item.id} className="grid gap-1 px-4 py-3 text-[11px] sm:grid-cols-[180px_1fr_180px]"><b>{item.action}</b><span>{item.entity_label || item.entity_type}</span><span className="text-gray-500 sm:text-right">{item.user_email} · {formatDate(item.created_at)}</span></div>)}</div></section>
  </div>;
}
