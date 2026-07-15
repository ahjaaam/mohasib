import type React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Banknote, Building2, CheckCircle2, CreditCard, Gauge, Inbox, Users } from "lucide-react";
import { AdminDateRangeFilter } from "@/components/admin/AdminDateRangeFilter";
import { adminContext, formatDate, formatMoney } from "@/lib/admin-data";
import { adminDateRange, inAdminDateRange } from "@/lib/admin-date-range";
import { TRIAL_LIMITS, TRIAL_FEATURE_LABELS, TRIAL_USAGE_COLUMNS, type TrialFeature } from "@/lib/trial-limits";

type CompanyRow = {
  id: string;
  user_id: string | null;
  raison_sociale: string | null;
  user_type: string | null;
  plan: string | null;
  subscription_status: string | null;
  subscription_ends_at: string | null;
  trial_ends_at: string | null;
  is_suspended: boolean | null;
  created_at: string | null;
  trial_invoices_used: number | null;
  trial_ocr_used: number | null;
  trial_documents_used: number | null;
  trial_bank_statements_used: number | null;
  trial_employees_used: number | null;
  trial_tva_declarations_used: number | null;
  trial_dossiers_used: number | null;
  trial_clients_used: number | null;
  trial_transactions_used: number | null;
  trial_accounting_entries_used: number | null;
  trial_rapprochement_sessions_used: number | null;
  trial_rapprochement_matches_used: number | null;
};

type SubscriptionRow = {
  id: string;
  company_id: string | null;
  plan: string | null;
  billing_period: string | null;
  amount_mad: number | null;
  status: string | null;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string | null;
};

type CreatedRow = { id: string; created_at: string | null; user_id?: string | null; company_id?: string | null; dossier_id?: string | null; status?: string | null };

const DAY = 86_400_000;
const COMPANY_SELECT = [
  "id",
  "user_id",
  "raison_sociale",
  "user_type",
  "plan",
  "subscription_status",
  "subscription_ends_at",
  "trial_ends_at",
  "is_suspended",
  "created_at",
  "trial_invoices_used",
  "trial_ocr_used",
  "trial_documents_used",
  "trial_bank_statements_used",
  "trial_employees_used",
  "trial_tva_declarations_used",
  "trial_dossiers_used",
  "trial_clients_used",
  "trial_transactions_used",
  "trial_accounting_entries_used",
  "trial_rapprochement_sessions_used",
  "trial_rapprochement_matches_used",
].join(",");

const TRIAL_FEATURES: TrialFeature[] = [
  "invoices",
  "ocr_scans",
  "documents",
  "bank_statements",
  "employees",
  "dossiers",
  "tva_declarations",
  "clients",
  "transactions",
  "accounting_entries",
  "rapprochement_sessions",
  "rapprochement_matches",
];

function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function pct(value: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

function sum(rows: { amount_mad: number | null; billing_period: string | null }[]) {
  return rows.reduce((total, item) => total + Number(item.amount_mad ?? 0) / (item.billing_period === "annual" ? 12 : 1), 0);
}

function uniqueCount(values: Array<string | null | undefined>) {
  return new Set(values.filter(Boolean)).size;
}

function statusOf(company: CompanyRow) {
  if (company.is_suspended) return "suspended";
  return company.subscription_status ?? "unknown";
}

function featureUsage(company: CompanyRow, feature: TrialFeature) {
  return Number(company[TRIAL_USAGE_COLUMNS[feature] as keyof CompanyRow] ?? 0);
}

function KpiCard({ label, value, sub, tone = "default", icon: Icon }: { label: string; value: React.ReactNode; sub?: string; tone?: "default" | "good" | "warn" | "bad"; icon: React.ElementType }) {
  const toneClass = tone === "good" ? "text-emerald-700 bg-emerald-50" : tone === "warn" ? "text-amber-700 bg-amber-50" : tone === "bad" ? "text-red-700 bg-red-50" : "text-[#C8924A] bg-[#C8924A]/10";
  return (
    <div className="rounded-md border border-black/10 bg-white p-4">
      <div className={`flex h-8 w-8 items-center justify-center rounded-md ${toneClass}`}><Icon size={15} /></div>
      <div className="mt-3 text-2xl font-bold">{value}</div>
      <div className="mt-1 text-[11px] font-semibold text-[#0D1526]">{label}</div>
      {sub && <div className="mt-1 text-[10px] leading-4 text-gray-500">{sub}</div>}
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-black/10 bg-white">
      <div className="border-b border-black/10 px-4 py-3">
        <h2 className="text-sm font-bold">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[10.5px] text-gray-500">{subtitle}</p>}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Bar({ value, max, label }: { value: number; max: number; label: string }) {
  const width = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-[11px]"><span className="font-semibold">{label}</span><span className="text-gray-500">{value}</span></div>
      <div className="h-2 overflow-hidden rounded-full bg-black/5">
        <div className="h-full rounded-full bg-[#C8924A]" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export default async function AdminKpisPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const filters = await searchParams;
  const dateRange = adminDateRange(filters);
  const { admin } = await adminContext();
  const now = new Date();
  const today = startOfDay(now);
  const next7 = new Date(today.getTime() + 7 * DAY).toISOString().slice(0, 10);
  const todayDate = today.toISOString().slice(0, 10);
  const [
    companiesRes,
    subscriptionsRes,
    invoicesRes,
    receiptsRes,
    documentsRes,
    bankStatementsRes,
    rapprochementsRes,
    employeesRes,
    dossiersRes,
    upgradeRequestsRes,
    customRequestsRes,
    demoRequestsRes,
    waitlistRes,
  ] = await Promise.all([
    admin.from("companies").select(COMPANY_SELECT).order("created_at", { ascending: false }),
    admin.from("subscriptions").select("id, company_id, plan, billing_period, amount_mad, status, starts_at, ends_at, created_at").order("created_at", { ascending: false }),
    admin.from("invoices").select("id, created_at, user_id, dossier_id"),
    admin.from("receipts").select("id, created_at, user_id, dossier_id, status"),
    admin.from("company_documents").select("id, created_at, user_id, dossier_id"),
    admin.from("bank_statements").select("id, created_at, user_id, company_id"),
    admin.from("rapprochement_sessions").select("id, created_at, company_id, dossier_id, statut"),
    admin.from("employees").select("id, created_at, user_id, company_id, dossier_id"),
    admin.from("dossiers").select("id, created_at"),
    admin.from("upgrade_requests").select("id, created_at, company_id, status"),
    admin.from("custom_requests").select("id, created_at, company_id, status"),
    admin.from("demo_requests").select("id, created_at, status"),
    admin.from("fiduciaire_waitlist").select("id, created_at, status, request_kind"),
  ]);

  const allCompanies = (companiesRes.data ?? []) as unknown as CompanyRow[];
  const companies = allCompanies.filter(row => inAdminDateRange(row.created_at, dateRange));
  const subscriptions = ((subscriptionsRes.data ?? []) as unknown as SubscriptionRow[]).filter(row => inAdminDateRange(row.created_at, dateRange));
  const invoices = (invoicesRes.data ?? []) as unknown as CreatedRow[];
  const receipts = (receiptsRes.data ?? []) as unknown as CreatedRow[];
  const documents = (documentsRes.data ?? []) as unknown as CreatedRow[];
  const bankStatements = (bankStatementsRes.data ?? []) as unknown as CreatedRow[];
  const rapprochements = (rapprochementsRes.data ?? []) as unknown as CreatedRow[];
  const employees = (employeesRes.data ?? []) as unknown as CreatedRow[];
  const dossiers = (dossiersRes.data ?? []) as unknown as CreatedRow[];
  const upgradeRequests = (upgradeRequestsRes.data ?? []) as unknown as CreatedRow[];
  const customRequests = (customRequestsRes.data ?? []) as unknown as CreatedRow[];
  const demoRequests = (demoRequestsRes.data ?? []) as unknown as CreatedRow[];
  const waitlist = (waitlistRes.data ?? []) as unknown as Array<CreatedRow & { request_kind?: string | null }>;

  const totalAccounts = companies.length;
  const trials = companies.filter(c => statusOf(c) === "trial");
  const activePaid = companies.filter(c => statusOf(c) === "active");
  const expired = companies.filter(c => statusOf(c) === "expired");
  const suspended = companies.filter(c => statusOf(c) === "suspended");
  const entrepreneurs = companies.filter(c => c.user_type === "entrepreneur").length;
  const comptables = companies.filter(c => c.user_type === "fiduciaire" || c.user_type === "comptable_pro").length;
  const expiringTrials = trials.filter(c => c.trial_ends_at && c.trial_ends_at.slice(0, 10) >= todayDate && c.trial_ends_at.slice(0, 10) <= next7).length;
  const activeSubs = subscriptions.filter(s => s.status === "active");
  const mrr = sum(activeSubs);
  const paidRevenue = subscriptions.filter(s => s.status === "active").reduce((total, item) => total + Number(item.amount_mad ?? 0), 0);

  const companyByOwner = new Map(allCompanies.map(company => [company.user_id, company.id]));
  const activatedCompanyIds = new Set<string>();
  const touch = (rows: CreatedRow[]) => rows.filter(r => inAdminDateRange(r.created_at, dateRange)).forEach(r => {
    const companyId = r.company_id ?? (r.user_id ? companyByOwner.get(r.user_id) : null);
    if (companyId) activatedCompanyIds.add(companyId);
  });
  touch(invoices);
  touch(receipts);
  touch(documents);
  touch(bankStatements);
  touch(rapprochements);
  touch(employees);

  const activeAccounts = companies.filter(c => activatedCompanyIds.has(c.id)).length;
  const usage = {
    invoices: invoices.filter(r => inAdminDateRange(r.created_at, dateRange)).length,
    receipts: receipts.filter(r => inAdminDateRange(r.created_at, dateRange)).length,
    documents: documents.filter(r => inAdminDateRange(r.created_at, dateRange)).length,
    bankStatements: bankStatements.filter(r => inAdminDateRange(r.created_at, dateRange)).length,
    rapprochements: rapprochements.filter(r => inAdminDateRange(r.created_at, dateRange)).length,
    employees: employees.filter(r => inAdminDateRange(r.created_at, dateRange)).length,
    dossiers: dossiers.filter(r => inAdminDateRange(r.created_at, dateRange)).length,
  };
  const usageMax = Math.max(1, ...Object.values(usage));

  const limitHits = TRIAL_FEATURES.map(feature => {
    const hit = trials.filter(company => featureUsage(company, feature) >= TRIAL_LIMITS[feature]).length;
    const near = trials.filter(company => featureUsage(company, feature) > 0 && featureUsage(company, feature) >= TRIAL_LIMITS[feature] * 0.8 && featureUsage(company, feature) < TRIAL_LIMITS[feature]).length;
    const used = trials.reduce((total, company) => total + featureUsage(company, feature), 0);
    return { feature, hit, near, used };
  }).sort((a, b) => (b.hit - a.hit) || (b.near - a.near) || (b.used - a.used));

  const openUpgrades = upgradeRequests.filter(r => inAdminDateRange(r.created_at, dateRange) && r.status === "nouveau").length;
  const openCustom = customRequests.filter(r => inAdminDateRange(r.created_at, dateRange) && r.status === "nouveau").length;
  const demoCount = demoRequests.filter(r => inAdminDateRange(r.created_at, dateRange)).length;
  const waitlistDemoOpen = waitlist.filter(r => inAdminDateRange(r.created_at, dateRange) && r.request_kind === "demo" && (r.status === "pending" || r.status === "nouveau")).length;

  const planCounts = companies.reduce<Record<string, number>>((acc, company) => {
    const plan = company.plan || "unknown";
    acc[plan] = (acc[plan] ?? 0) + 1;
    return acc;
  }, {});
  const planRows = Object.entries(planCounts).sort((a, b) => b[1] - a[1]);

  const needsAttention = [
    { label: "Demandes upgrade ouvertes", value: openUpgrades, href: "/admin/demandes", tone: openUpgrades ? "warn" : "good" },
    { label: "Demandes personnalisées ouvertes", value: openCustom, href: "/admin/demandes", tone: openCustom ? "warn" : "good" },
    { label: "Démos en attente", value: waitlistDemoOpen, href: "/admin/liste-attente", tone: waitlistDemoOpen ? "warn" : "good" },
    { label: "Essais expirés", value: expired.length, href: "/admin/comptes?status=expired", tone: expired.length ? "warn" : "good" },
    { label: "Comptes suspendus", value: suspended.length, href: "/admin/comptes?status=suspended", tone: suspended.length ? "bad" : "good" },
  ];

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold">KPIs</h1>
          <p className="mt-1 text-xs text-gray-500">Cockpit fondateur — données live depuis Supabase · {formatDate(now.toISOString())}</p>
        </div>
        <Link href="/admin" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#9A672E]">Retour dashboard <ArrowUpRight size={13} /></Link>
      </div>

      <form className="mb-5 flex flex-col gap-2 rounded-md border border-black/10 bg-white p-3 lg:flex-row lg:items-center">
        <AdminDateRangeFilter range={dateRange} className="flex-1" />
        <button className="min-h-10 rounded bg-[#0D1526] px-4 text-xs font-bold text-white">Appliquer</button>
        <span className="px-1 text-[11px] text-gray-500">{dateRange.label}</span>
      </form>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <KpiCard icon={Building2} label="Nouveaux comptes" value={totalAccounts} sub={dateRange.label} />
        <KpiCard icon={Gauge} label="Activation" value={pct(activeAccounts, totalAccounts)} sub={`${activeAccounts}/${totalAccounts} comptes ont créé/chargé quelque chose`} tone={activeAccounts && activeAccounts >= Math.ceil(totalAccounts * 0.5) ? "good" : "warn"} />
        <KpiCard icon={Users} label="Essais actifs" value={trials.length} sub={`${expiringTrials} expirent sous 7 jours`} />
        <KpiCard icon={CreditCard} label="Payants actifs" value={activePaid.length} sub={`${pct(activePaid.length, totalAccounts)} des comptes`} tone={activePaid.length ? "good" : "warn"} />
        <KpiCard icon={Banknote} label="MRR estimé" value={formatMoney(mrr)} sub={`Encaissement sur la période : ${formatMoney(paidRevenue)}`} tone={mrr ? "good" : "warn"} />
        <KpiCard icon={Inbox} label="Demandes ouvertes" value={openUpgrades + openCustom + waitlistDemoOpen} sub={`${demoCount} demandes démo sur la période`} tone={openUpgrades + openCustom + waitlistDemoOpen ? "warn" : "good"} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Section title="Acquisition & comptes" subtitle="Volume, types de comptes et santé du funnel d'entrée.">
          <div className="grid gap-3 text-[12px]">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md bg-[#F8F8F5] p-3"><div className="text-[10px] text-gray-500">Entrepreneurs</div><div className="mt-1 text-lg font-bold">{entrepreneurs}</div></div>
              <div className="rounded-md bg-[#F8F8F5] p-3"><div className="text-[10px] text-gray-500">Comptables Pro</div><div className="mt-1 text-lg font-bold">{comptables}</div></div>
            </div>
            <div className="space-y-2">
              {planRows.map(([plan, count]) => <Bar key={plan} label={plan} value={count} max={totalAccounts} />)}
            </div>
          </div>
        </Section>

        <Section title="Activation produit" subtitle="La vraie valeur : l'utilisateur crée un élément utile.">
          <div className="space-y-3">
            <Bar label="Factures créées" value={usage.invoices} max={usageMax} />
            <Bar label="Documents OCR reçus" value={usage.receipts} max={usageMax} />
            <Bar label="Documents archivés" value={usage.documents} max={usageMax} />
            <Bar label="Relevés importés" value={usage.bankStatements} max={usageMax} />
            <Bar label="Rapprochements" value={usage.rapprochements} max={usageMax} />
            <Bar label="Employés ajoutés" value={usage.employees} max={usageMax} />
            <Bar label="Dossiers créés" value={usage.dossiers} max={usageMax} />
          </div>
        </Section>

        <Section title="À traiter" subtitle="Ce qui demande une action fondateur/support.">
          <div className="divide-y divide-black/5">
            {needsAttention.map(item => (
              <Link key={item.label} href={item.href} className="flex items-center justify-between py-3 text-[12px] hover:text-[#9A672E]">
                <span className="flex items-center gap-2">{item.tone === "good" ? <CheckCircle2 size={14} className="text-emerald-600" /> : <AlertTriangle size={14} className={item.tone === "bad" ? "text-red-600" : "text-amber-600"} />}{item.label}</span>
                <span className="font-bold">{item.value}</span>
              </Link>
            ))}
          </div>
        </Section>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Section title="Essai gratuit — limites atteintes" subtitle="Si beaucoup de comptes touchent une limite sans upgrade, il faut améliorer l'offre, le prix ou le CTA.">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead className="bg-[#F8F8F5] text-gray-500">
                <tr>{["Limite", "Utilisation totale", "Près limite", "Atteinte"].map(header => <th key={header} className="px-3 py-2 font-semibold">{header}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {limitHits.map(({ feature, used, near, hit }) => (
                  <tr key={feature}>
                    <td className="px-3 py-2.5 font-semibold">{TRIAL_FEATURE_LABELS[feature]} <span className="text-gray-400">/{TRIAL_LIMITS[feature]}</span></td>
                    <td className="px-3 py-2.5">{used}</td>
                    <td className="px-3 py-2.5">{near}</td>
                    <td className={`px-3 py-2.5 font-bold ${hit ? "text-amber-700" : "text-emerald-700"}`}>{hit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Comptes récents" subtitle="Derniers comptes créés et premier signal d'activation.">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead className="bg-[#F8F8F5] text-gray-500">
                <tr>{["Compte", "Type", "Statut", "Créé", "Activation"].map(header => <th key={header} className="px-3 py-2 font-semibold">{header}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {companies.slice(0, 10).map(company => {
                  const activated = activatedCompanyIds.has(company.id);
                  return (
                    <tr key={company.id}>
                      <td className="px-3 py-2.5 font-semibold"><Link href={`/admin/comptes/${company.id}`}>{company.raison_sociale || "Sans nom"}</Link></td>
                      <td className="px-3 py-2.5">{company.user_type || "—"}</td>
                      <td className="px-3 py-2.5">{statusOf(company)}</td>
                      <td className="px-3 py-2.5 text-gray-500">{formatDate(company.created_at)}</td>
                      <td className={`px-3 py-2.5 font-semibold ${activated ? "text-emerald-700" : "text-gray-400"}`}>{activated ? "Oui" : "Pas encore"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Section title="Revenu" subtitle="Première lecture financière, basée sur les abonnements actifs.">
          <div className="space-y-3 text-[12px]">
            <div className="flex justify-between"><span className="text-gray-500">MRR estimé</span><b>{formatMoney(mrr)}</b></div>
            <div className="flex justify-between"><span className="text-gray-500">ARPA estimé</span><b>{formatMoney(activePaid.length ? mrr / activePaid.length : 0)}</b></div>
            <div className="flex justify-between"><span className="text-gray-500">Abonnements actifs</span><b>{activeSubs.length}</b></div>
            <div className="flex justify-between"><span className="text-gray-500">Entreprises payantes uniques</span><b>{uniqueCount(activeSubs.map(s => s.company_id))}</b></div>
          </div>
        </Section>

        <Section title="Demandes & leads" subtitle="Signaux commerciaux à suivre chaque semaine.">
          <div className="space-y-3 text-[12px]">
            <div className="flex justify-between"><span className="text-gray-500">Demandes démo</span><b>{demoCount}</b></div>
            <div className="flex justify-between"><span className="text-gray-500">Démos en attente</span><b>{waitlistDemoOpen}</b></div>
            <div className="flex justify-between"><span className="text-gray-500">Upgrade requests ouvertes</span><b>{openUpgrades}</b></div>
            <div className="flex justify-between"><span className="text-gray-500">Demandes custom ouvertes</span><b>{openCustom}</b></div>
          </div>
        </Section>

        <Section title="Qualité du tracking" subtitle="Ce dashboard couvre les KPIs business. Sentry/PostHog/Better Stack restent nécessaires.">
          <div className="space-y-2 text-[11px] leading-5 text-gray-600">
            <p><b className="text-[#0D1526]">Ici :</b> comptes, essais, revenue, usage produit, demandes.</p>
            <p><b className="text-[#0D1526]">Sentry :</b> erreurs, cron, performance, régressions.</p>
            <p><b className="text-[#0D1526]">Better Stack :</b> uptime externe et statut public.</p>
            <p><b className="text-[#0D1526]">PostHog :</b> funnels détaillés et parcours utilisateur.</p>
          </div>
        </Section>
      </div>

      {(companiesRes.error || subscriptionsRes.error) && (
        <div className="mt-5 rounded-md border border-red-200 bg-red-50 p-4 text-[12px] text-red-800">
          Certaines données KPI n&apos;ont pas pu être chargées. Vérifiez les logs Supabase/admin.
        </div>
      )}
    </div>
  );
}
