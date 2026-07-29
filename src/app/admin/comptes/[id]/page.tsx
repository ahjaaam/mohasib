import { notFound } from "next/navigation";
import { AccountControls, DeleteAccountControl, MemberAccessScopeSelect, MemberToggle, WorkspaceControls } from "@/components/admin/AdminControls";
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
  const qualification = owner?.user_metadata ?? {};
  const selectedNeeds = Array.isArray(qualification.needs) ? qualification.needs.filter((need: string) => need !== "Autre") : [];
  const needs = [
    ...(selectedNeeds as string[]),
    ...(qualification.other_need ? [`Autre : ${qualification.other_need}`] : []),
  ].join(", ") || qualification.needs;
  const plan = (limits.data ?? []).find(item => item.plan === company.plan);
  const effectiveLimits = { ...(plan ?? {}), ...(override.data ?? {}) };
  const { data: workspaces } = await admin.from("dossiers").select("*").eq("fiduciaire_user_id", company.user_id).order("raison_sociale");
  const workspaceIds = (workspaces ?? []).map(workspace => workspace.id);
  const [workspaceDocuments, workspaceInvoices, workspaceEmployees, workspaceTransactions] = workspaceIds.length ? await Promise.all([
    admin.from("company_documents").select("dossier_id").in("dossier_id", workspaceIds),
    admin.from("invoices").select("dossier_id").in("dossier_id", workspaceIds),
    admin.from("employees").select("dossier_id").in("dossier_id", workspaceIds),
    admin.from("transactions").select("dossier_id").in("dossier_id", workspaceIds),
  ]) : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];
  const countFor = (rows: Array<{ dossier_id?: string | null }> | null | undefined, dossierId: string) =>
    (rows ?? []).filter(row => row.dossier_id === dossierId).length;
  const staffMembers = (members.data ?? []).filter(member => member.role_name !== "client_portal");
  const portalMembers = (members.data ?? []).filter(member => member.role_name === "client_portal");
  return <div>
    <div className="mb-5"><div className="flex items-center gap-2"><h1 className="text-xl font-bold">{company.raison_sociale || "Compte sans nom"}</h1><StatusBadge status={accountStatus(company)} /></div><p className="mt-1 text-xs text-gray-500">{owner?.email || "—"} · {company.user_type || "—"} · créé {formatDate(company.created_at)}</p></div>
    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{[
      ["Accès", company.subscription_status === "trial" ? "Version gratuite" : "Sur mesure"],
      ["Fin abonnement", formatDate(company.subscription_ends_at || company.trial_ends_at)],
      ["OCR", `${company.ocr_used_this_month ?? 0} / ${override.data?.ocr_limit ?? plan?.ocr_limit ?? "—"}`],
      ["Utilisateurs", `${(members.data ?? []).filter(item => item.status === "active").length} / ${override.data?.users_limit ?? plan?.users_limit ?? "—"}`],
      ["Revenu cumulé", formatMoney((subscriptions.data ?? []).reduce((sum, item) => sum + Number(item.amount_mad ?? 0), 0))],
    ].map(([label, value]) => <div key={label} className="rounded-md border border-black/10 bg-white p-4"><div className="text-[10px] text-gray-500">{label}</div><div className="mt-2 text-sm font-bold">{value}</div></div>)}</div>
    <section className="mb-5 rounded-md border border-black/10 bg-white p-4"><h2 className="text-sm font-bold">Identité</h2><div className="mt-3 grid gap-3 text-[11px] sm:grid-cols-3 xl:grid-cols-7">{[["Email", owner?.email], ["Téléphone", company.phone || owner?.user_metadata?.phone], ["ICE", company.ice], ["IF", company.if_number], ["Ville", company.city], ["Type", company.user_type], ["Dernière connexion", formatDate(owner?.last_sign_in_at)]].map(([label, value]) => <div key={label}><div className="text-gray-400">{label}</div><div className="mt-1 font-semibold">{value || "—"}</div></div>)}</div></section>
    {(qualification.role || qualification.organization_size || qualification.monthly_volume || needs) && (
      <section className="mb-5 rounded-md border border-[#C8924A]/30 bg-[#FFF9F0] p-4">
        <h2 className="text-sm font-bold">Profil et besoins déclarés à l’inscription</h2>
        <div className="mt-3 grid gap-3 text-[11px] sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Rôle", qualification.role],
            [company.user_type === "fiduciaire" ? "Collaborateurs" : "Taille de l’entreprise", qualification.organization_size],
            [company.user_type === "fiduciaire" ? "Dossiers clients" : "Documents par mois", qualification.monthly_volume],
            ["Besoins", needs],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <div className="text-gray-500">{String(label)}</div>
              <div className="mt-1 font-semibold">{String(value || "—")}</div>
            </div>
          ))}
        </div>
      </section>
    )}
    {company.subscription_status === "trial" && (
      <section className="mb-5 rounded-md border border-amber-200 bg-amber-50 p-4">
        <h2 className="text-sm font-bold">Utilisation essai</h2>
        <p className="mt-2 text-[12px] text-amber-900">
          Factures {company.trial_invoices_used ?? 0}/{TRIAL_LIMITS.invoices} · Scans {company.trial_ocr_used ?? 0}/{TRIAL_LIMITS.ocr_scans} · Documents {company.trial_documents_used ?? 0}/{TRIAL_LIMITS.documents} · Relevés {company.trial_bank_statements_used ?? 0}/{TRIAL_LIMITS.bank_statements} · Employés {company.trial_employees_used ?? 0}/{TRIAL_LIMITS.employees} · Dossiers {company.trial_dossiers_used ?? 0}/{TRIAL_LIMITS.dossiers} · TVA {company.trial_tva_declarations_used ?? 0}/{TRIAL_LIMITS.tva_declarations} · Clients {company.trial_clients_used ?? 0}/{TRIAL_LIMITS.clients} · Transactions {company.trial_transactions_used ?? 0}/{TRIAL_LIMITS.transactions} · Écritures {company.trial_accounting_entries_used ?? 0}/{TRIAL_LIMITS.accounting_entries} · Rapprochements {company.trial_rapprochement_sessions_used ?? 0}/{TRIAL_LIMITS.rapprochement_sessions} · Lignes rapprochées {company.trial_rapprochement_matches_used ?? 0}/{TRIAL_LIMITS.rapprochement_matches}
        </p>
      </section>
    )}
    <AccountControls company={company} override={override.data} effectiveLimits={effectiveLimits} />
    <section className="mt-5 rounded-md border border-black/10 bg-white">
      <div className="border-b border-black/10 px-4 py-3">
        <h2 className="text-sm font-bold">Sous-comptes et espaces clients</h2>
        <p className="mt-1 text-[11px] text-gray-500">{(workspaces ?? []).length} espace(s). Les droits globaux configurés plus haut s’appliquent à tous ces espaces.</p>
      </div>
      {(workspaces ?? []).length === 0 ? (
        <p className="px-4 py-6 text-[11px] text-gray-500">Ce compte ne possède aucun espace client.</p>
      ) : (
        <div className="divide-y divide-black/5">
          {(workspaces ?? []).map(workspace => {
            const clients = portalMembers.filter(member => member.dossier_id === workspace.id);
            return (
              <div key={workspace.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2"><b className="text-[12px]">{workspace.raison_sociale}</b><StatusBadge status={workspace.statut} /></div>
                    <p className="mt-1 text-[10.5px] text-gray-500">{workspace.ice || "ICE non renseigné"} · {workspace.regime_tva || "TVA non définie"} · créé {formatDate(workspace.created_at)}</p>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center text-[10px]">
                    {[
                      ["Documents", countFor(workspaceDocuments.data, workspace.id)],
                      ["Factures", countFor(workspaceInvoices.data, workspace.id)],
                      ["Employés", countFor(workspaceEmployees.data, workspace.id)],
                      ["Transactions", countFor(workspaceTransactions.data, workspace.id)],
                    ].map(([label, value]) => <div key={String(label)} className="min-w-16 rounded bg-[#F8F8F5] px-2 py-1.5"><div className="font-bold">{value}</div><div className="text-gray-400">{label}</div></div>)}
                  </div>
                </div>
                <div className="mt-3">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Accès clients</p>
                  {clients.length === 0 ? <p className="text-[10.5px] text-gray-500">Aucun utilisateur client connecté.</p> : (
                    <div className="flex flex-wrap gap-2">
                      {clients.map(member => (
                        <div key={member.id} className="flex items-center gap-2 rounded border border-black/10 px-2.5 py-1.5 text-[10.5px]">
                          <span><b>{member.user_email}</b> · {member.status}</span>
                          <MemberToggle id={member.id} suspended={member.status === "suspended"} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="mt-3"><WorkspaceControls workspace={workspace} /></div>
              </div>
            );
          })}
        </div>
      )}
    </section>
    <div className="mt-5 grid gap-5 xl:grid-cols-2">
      <section className="rounded-md border border-black/10 bg-white"><h2 className="border-b border-black/10 px-4 py-3 text-sm font-bold">Collaborateurs</h2><div className="divide-y divide-black/5">{staffMembers.map(member => <div key={member.id} className="flex items-center justify-between gap-3 px-4 py-3 text-[11px]"><div><b>{`${member.first_name ?? ""} ${member.last_name ?? ""}`.trim() || member.user_email || "Invitation"}</b><div className="text-gray-500">{member.user_email} · Collaborateur · {member.status}</div></div><div className="flex flex-wrap items-center justify-end gap-2"><MemberAccessScopeSelect id={member.id} current={member.access_scope} /><MemberToggle id={member.id} suspended={member.status === "suspended"} /></div></div>)}</div></section>
      <section className="rounded-md border border-black/10 bg-white"><h2 className="border-b border-black/10 px-4 py-3 text-sm font-bold">Historique d’abonnement</h2><div className="divide-y divide-black/5">{(subscriptions.data ?? []).map(item => <div key={item.id} className="grid gap-1 px-4 py-3 text-[11px] sm:grid-cols-3 sm:gap-0"><b>{item.plan}</b><span>{formatMoney(item.amount_mad)}</span><span className="text-gray-500 sm:text-right">{formatDate(item.starts_at)} → {formatDate(item.ends_at)}</span></div>)}</div></section>
    </div>
    <section className="mt-5 rounded-md border border-black/10 bg-white"><h2 className="border-b border-black/10 px-4 py-3 text-sm font-bold">Journal d’audit</h2><div className="divide-y divide-black/5">{(audits.data ?? []).map(item => <div key={item.id} className="grid gap-1 px-4 py-3 text-[11px] sm:grid-cols-[180px_1fr_180px]"><b>{item.action}</b><span>{item.entity_label || item.entity_type}</span><span className="text-gray-500 sm:text-right">{item.user_email} · {formatDate(item.created_at)}</span></div>)}</div></section>
    <DeleteAccountControl companyId={company.id} companyName={company.raison_sociale || "Compte sans nom"} />
  </div>;
}
