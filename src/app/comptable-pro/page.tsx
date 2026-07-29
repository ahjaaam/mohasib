export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeftRight, FileText, FolderOpen, PenLine, TrendingUp } from "lucide-react";
import type { Dossier } from "@/types/fiduciaire";
import { resolveAccountOwnerId } from "@/lib/account-owner";
import { FEATURES } from "@/lib/features";
import { resolveClientPortalRedirect } from "@/lib/team";

function daysSince(dateStr: string | null): number {
  if (!dateStr) return 999;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function DossierStatus({ lastActivity }: { lastActivity: string | null }) {
  const days = daysSince(lastActivity);
  if (days <= 7)  return <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#059669]"><span className="w-2 h-2 rounded-full bg-[#059669]" />À jour</span>;
  if (days <= 30) return <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#D97706]"><span className="w-2 h-2 rounded-full bg-[#D97706]" />{days}j sans saisie</span>;
  return <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#DC2626]"><span className="w-2 h-2 rounded-full bg-[#DC2626]" />{lastActivity ? `${days}j sans saisie` : "Aucune saisie"}</span>;
}

function fmtActivityDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("fr-MA", { day: "numeric", month: "short" });
}

export default async function FiduciaireOverviewPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");
  const clientRedirect = await resolveClientPortalRedirect(user.id);
  if (clientRedirect) redirect(clientRedirect);
  const ownerId = await resolveAccountOwnerId(user.id);

  const { data: dossiersData } = await supabase
    .from("dossiers").select("*").eq("fiduciaire_user_id", ownerId).order("raison_sociale");
  const dossiers: Dossier[] = dossiersData ?? [];
  const dossierIds = dossiers.map(d => d.id);
  const dossierById = new Map(dossiers.map(d => [d.id, d]));

  const now = new Date();
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const periodeLabel = now.toLocaleDateString("fr-MA", { month: "long", year: "numeric" });
  const nextDeadline = new Date(now.getFullYear(), now.getMonth() + 1, 20)
    .toLocaleDateString("fr-MA", { day: "numeric", month: "short" });

  // ── Fetch actual activity + deposited TVA in parallel ────────────────────────
  const [invRes, txRes, ecrRes, depositedRes] = dossierIds.length > 0
    ? await Promise.all([
        supabase.from("invoices").select("id, dossier_id, invoice_number, issue_date, total, status, clients(name)")
          .in("dossier_id", dossierIds).order("issue_date", { ascending: false }),
        supabase.from("transactions").select("id, dossier_id, date, description, amount, type, category")
          .in("dossier_id", dossierIds).order("date", { ascending: false }),
        supabase.from("dossier_ecritures").select("id, dossier_id, date, libelle, journal, compte_cgnc, debit, credit")
          .in("dossier_id", dossierIds).order("date", { ascending: false }),
        supabase.from("dossier_tva").select("dossier_id")
          .eq("fiduciaire_user_id", ownerId).eq("periode", currentPeriod).eq("statut", "deposee"),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];

  // ── Latest activity per dossier (max across invoices, transactions, ecritures) ─
  const latestByDossier: Record<string, string> = {};
  const updateLatest = (id: string, date: string) => {
    if (!latestByDossier[id] || date > latestByDossier[id]) latestByDossier[id] = date;
  };
  for (const r of (invRes.data ?? []) as any[]) updateLatest(r.dossier_id, r.issue_date);
  for (const r of (txRes.data  ?? []) as any[]) updateLatest(r.dossier_id, r.date);
  for (const r of (ecrRes.data ?? []) as any[]) updateLatest(r.dossier_id, r.date);

  type ActivityRow = {
    key: string;
    date: string;
    dossierId: string;
    dossierName: string;
    label: string;
    sublabel: string;
    amount?: number;
    sign?: "+" | "-";
    href: string;
    source: "invoice" | "transaction" | "ecriture";
  };

  const activity: ActivityRow[] = [
    ...((invRes.data ?? []) as any[]).map(inv => {
      const dossier = dossierById.get(inv.dossier_id);
      return {
        key: `inv-${inv.id}`,
        date: inv.issue_date,
        dossierId: inv.dossier_id,
        dossierName: dossier?.raison_sociale ?? "Dossier",
        label: `Facture ${inv.invoice_number}`,
        sublabel: (inv.clients as any)?.name ?? "Client",
        amount: Number(inv.total ?? 0),
        sign: "+" as const,
        href: `/comptable-pro/dossiers/${inv.dossier_id}/invoices/${inv.id}`,
        source: "invoice" as const,
      };
    }),
    ...((txRes.data ?? []) as any[]).map(tx => {
      const dossier = dossierById.get(tx.dossier_id);
      const isIncome = tx.type === "income" || Number(tx.amount) > 0;
      return {
        key: `tx-${tx.id}`,
        date: tx.date,
        dossierId: tx.dossier_id,
        dossierName: dossier?.raison_sociale ?? "Dossier",
        label: tx.description || tx.category || "Transaction",
        sublabel: tx.category ?? "Transaction",
        amount: Math.abs(Number(tx.amount ?? 0)),
        sign: isIncome ? "+" as const : "-" as const,
        href: `/comptable-pro/dossiers/${tx.dossier_id}/transactions`,
        source: "transaction" as const,
      };
    }),
    ...((ecrRes.data ?? []) as any[]).map(ecr => {
      const dossier = dossierById.get(ecr.dossier_id);
      return {
        key: `ecr-${ecr.id}`,
        date: ecr.date,
        dossierId: ecr.dossier_id,
        dossierName: dossier?.raison_sociale ?? "Dossier",
        label: ecr.libelle || "Écriture comptable",
        sublabel: [ecr.journal, ecr.compte_cgnc].filter(Boolean).join(" · "),
        amount: Number(ecr.debit || ecr.credit || 0),
        href: `/comptable-pro/dossiers/${ecr.dossier_id}/${FEATURES.SAISIE_ENABLED ? "saisie" : "ecritures"}`,
        source: "ecriture" as const,
      };
    }),
  ]
    .filter(row => row.date)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 20);

  // Falls back to derniere_ecriture if nothing found in source tables
  function effectiveActivity(d: Dossier): string | null {
    return latestByDossier[d.id] ?? d.derniere_ecriture;
  }

  // ── TVA: count active non-exonéré dossiers without a deposee for current period ─
  const depositedIds = new Set((depositedRes.data ?? []).map((r: any) => r.dossier_id));
  const pendingTvaCount = dossiers.filter(
    d => d.statut === "actif" && d.regime_tva !== "exonere" && !depositedIds.has(d.id)
  ).length;

  // ── KPIs ─────────────────────────────────────────────────────────────────────
  const actifs  = dossiers.filter(d => d.statut === "actif");
  const alertes = dossiers.filter(d => daysSince(effectiveActivity(d)) > 30);

  return (
    <div>
      {/* Header */}
      <div className="mb-5 flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(200,146,74,0.12)" }}>
            <TrendingUp size={18} className="text-[#C8924A]" />
          </div>
          <div>
            <h1 className="text-[18px] font-bold text-[#1A1A2E] leading-none">Vue d'ensemble</h1>
            <p className="text-[11px] text-[#9CA3AF] mt-0.5">Tous vos dossiers clients — {periodeLabel}</p>
          </div>
        </div>
        <Link href="/comptable-pro/dossiers/new" className="btn btn-gold">
          + Nouveau dossier
        </Link>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-8">
        <div className="kpi">
          <div className="kpi-label">Dossiers actifs</div>
          <div className="kpi-value">{actifs.length}</div>
          <div className="text-[11px] text-[#6B7280]">{dossiers.length} au total</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Déclarations TVA</div>
          <div className="kpi-value" style={{ color: pendingTvaCount > 0 ? "#D97706" : "#059669" }}>
            {pendingTvaCount}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-[#6B7280]">
            en attente <span className="tag tag-warn">{nextDeadline}</span>
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">CA total géré (YTD)</div>
          <div className="kpi-value text-[20px]">—</div>
          <div className="text-[11px] text-[#6B7280]">Saisissez des écritures</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Alertes</div>
          <div className="kpi-value" style={{ color: alertes.length > 0 ? "#DC2626" : "#059669" }}>
            {alertes.length}
          </div>
          <div className="text-[11px] text-[#6B7280]">
            {alertes.length === 0 ? "Tous à jour" : `dossier${alertes.length > 1 ? "s" : ""} sans activité`}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4 items-start">
        {/* Dossiers table */}
        <div className="tbl min-w-0">
          <div className="tbl-header">
            <span className="tbl-title">Dossiers clients</span>
            <Link href="/comptable-pro/dossiers" className="btn btn-outline btn-sm">
              Voir la grille →
            </Link>
          </div>
          {dossiers.length === 0 ? (
            <div className="py-14 text-center">
              <FolderOpen size={32} className="text-[#D1D5DB] mx-auto mb-3" />
              <p className="text-[13px] text-[#6B7280] mb-1">Aucun dossier client</p>
              <p className="text-[12px] text-[#9CA3AF] mb-4">Créez votre premier dossier pour commencer</p>
              <Link href="/comptable-pro/dossiers/new" className="btn btn-gold btn-sm">
                + Nouveau dossier
              </Link>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Régime</th>
                  <th>Dernière activité</th>
                  <th>TVA</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {dossiers.map((d) => {
                  const activity = effectiveActivity(d);
                  const tvaDeposee = depositedIds.has(d.id);
                  const tvaActive = d.statut === "actif" && d.regime_tva !== "exonere";
                  return (
                    <tr key={d.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color || "#C8924A" }} />
                          <span className="font-medium text-[#1A1A2E]">{d.raison_sociale}</span>
                          <span className="text-[11px] text-[#9CA3AF]">{d.forme_juridique}</span>
                        </div>
                      </td>
                      <td>
                        <span className="text-[12px] capitalize">{d.regime_tva}</span>
                      </td>
                      <td>
                        <span className="text-[12px] text-[#6B7280]">
                          {activity
                            ? new Date(activity).toLocaleDateString("fr-MA", { day: "numeric", month: "short" })
                            : "—"}
                        </span>
                      </td>
                      <td>
                        {!tvaActive
                          ? <span className="text-[12px] text-[#9CA3AF]">Exonéré</span>
                          : tvaDeposee
                            ? <span className="tag !rounded-none" style={{ background: "#D1FAE5", color: "#065F46" }}>Déposée</span>
                            : <span className="tag tag-warn !rounded-none">À déposer</span>}
                      </td>
                      <td>
                        <DossierStatus lastActivity={activity} />
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <Link href={`/comptable-pro/dossiers/${d.id}`}
                            className="btn btn-outline btn-sm">
                            Ouvrir
                          </Link>
                          <Link href={`/comptable-pro/dossiers/${d.id}/edit`}
                            className="btn btn-outline btn-sm">
                            Modifier
                          </Link>
                          <Link href={`/comptable-pro/dossiers/${d.id}/tva`}
                            className="btn btn-outline btn-sm">
                            TVA
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Activity history */}
        <div className="tbl min-w-0">
          <div className="tbl-header">
            <span className="tbl-title">Historique d'activité</span>
          </div>
          {activity.length === 0 ? (
            <div className="py-14 text-center px-4">
              <TrendingUp size={32} className="text-[#D1D5DB] mx-auto mb-3" />
              <p className="text-[13px] text-[#6B7280] mb-1">Aucune activité</p>
              <p className="text-[12px] text-[#9CA3AF]">Les actions des dossiers apparaîtront ici.</p>
            </div>
          ) : (
            <div className="divide-y divide-[rgba(0,0,0,0.05)] max-h-[560px] overflow-y-auto">
              {activity.map((row) => {
                const Icon =
                  row.source === "invoice" ? FileText :
                  row.source === "transaction" ? ArrowLeftRight :
                  PenLine;
                const color =
                  row.source === "invoice" ? "#059669" :
                  row.source === "transaction" ? "#7C3AED" :
                  "#C8924A";

                return (
                  <Link
                    key={row.key}
                    href={row.href}
                    className="flex items-start gap-2.5 px-4 py-3 hover:bg-[#FAFAF6] transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: `${color}18` }}>
                      <Icon size={14} style={{ color }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[12.5px] font-semibold text-[#1A1A2E] truncate">{row.label}</p>
                        <span className="text-[10.5px] text-[#9CA3AF] flex-shrink-0">{fmtActivityDate(row.date)}</span>
                      </div>
                      <p className="text-[11px] text-[#6B7280] truncate">{row.dossierName}</p>
                      {row.sublabel && (
                        <p className="text-[10.5px] text-[#9CA3AF] truncate mt-0.5">{row.sublabel}</p>
                      )}
                    </div>
                    {row.amount != null && row.amount > 0 && (
                      <div className={`text-[11.5px] font-semibold flex-shrink-0 mt-0.5 ${
                        row.sign === "+" ? "text-[#059669]" :
                        row.sign === "-" ? "text-[#DC2626]" :
                        "text-[#6B7280]"
                      }`}>
                        {row.sign ?? ""}{row.amount.toLocaleString("fr-MA")}
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
