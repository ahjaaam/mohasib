export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { FolderOpen, TrendingUp, Inbox } from "lucide-react";
import type { Dossier } from "@/types/fiduciaire";

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

export default async function FiduciaireOverviewPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: dossiersData } = await supabase
    .from("dossiers").select("*").eq("fiduciaire_user_id", user!.id).order("raison_sociale");
  const dossiers: Dossier[] = dossiersData ?? [];
  const dossierIds = dossiers.map(d => d.id);

  const now = new Date();
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const periodeLabel = now.toLocaleDateString("fr-MA", { month: "long", year: "numeric" });
  const nextDeadline = new Date(now.getFullYear(), now.getMonth() + 1, 20)
    .toLocaleDateString("fr-MA", { day: "numeric", month: "short" });

  // ── Fetch actual activity + deposited TVA in parallel ────────────────────────
  const [invRes, txRes, ecrRes, depositedRes, unassignedRes] = dossierIds.length > 0
    ? await Promise.all([
        supabase.from("invoices").select("dossier_id, issue_date")
          .in("dossier_id", dossierIds).order("issue_date", { ascending: false }),
        supabase.from("transactions").select("dossier_id, date")
          .in("dossier_id", dossierIds).order("date", { ascending: false }),
        supabase.from("dossier_ecritures").select("dossier_id, date")
          .in("dossier_id", dossierIds).order("date", { ascending: false }),
        supabase.from("dossier_tva").select("dossier_id")
          .eq("fiduciaire_user_id", user!.id).eq("periode", currentPeriod).eq("statut", "deposee"),
        supabase.from("inbox_global").select("id", { count: "exact", head: true })
          .eq("fiduciaire_user_id", user!.id).eq("status", "unassigned"),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }, { count: 0 }];

  const unassignedCount = (unassignedRes as { count: number | null }).count ?? 0;

  // ── Latest activity per dossier (max across invoices, transactions, ecritures) ─
  const latestByDossier: Record<string, string> = {};
  const updateLatest = (id: string, date: string) => {
    if (!latestByDossier[id] || date > latestByDossier[id]) latestByDossier[id] = date;
  };
  for (const r of (invRes.data ?? []) as any[]) updateLatest(r.dossier_id, r.issue_date);
  for (const r of (txRes.data  ?? []) as any[]) updateLatest(r.dossier_id, r.date);
  for (const r of (ecrRes.data ?? []) as any[]) updateLatest(r.dossier_id, r.date);

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
      <div className="flex items-center gap-4 mb-7">
        <div className="w-11 h-11 rounded-xl bg-[rgba(200,146,74,0.12)] flex items-center justify-center flex-shrink-0">
          <TrendingUp size={20} className="text-[#C8924A]" />
        </div>
        <div>
          <h1 className="text-[20px] font-bold text-[#1A1A2E] leading-tight">Vue d'ensemble</h1>
          <p className="text-[12.5px] text-[#6B7280]">Tous vos dossiers clients — {periodeLabel}</p>
        </div>
        <div className="ml-auto">
          <Link href="/comptable-pro/dossiers/new" className="btn btn-gold">
            + Nouveau dossier
          </Link>
        </div>
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

      {/* Unassigned emails banner */}
      {unassignedCount > 0 && (
        <Link
          href="/comptable-pro/inbox-global"
          className="flex items-center gap-2.5 mb-5 px-4 py-3 rounded-xl bg-[#FEF3C7] border border-[#FCD34D] hover:bg-[#FDE68A] transition-colors"
        >
          <Inbox size={15} className="text-[#D97706] flex-shrink-0" />
          <span className="text-[13px] font-semibold text-[#D97706]">
            {unassignedCount} email{unassignedCount > 1 ? "s" : ""} non assigné{unassignedCount > 1 ? "s" : ""} — vérification requise
          </span>
          <span className="ml-auto text-[12px] text-[#D97706] font-medium">Voir l'inbox →</span>
        </Link>
      )}

      {/* Dossiers table */}
      <div className="tbl">
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
                          ? <span className="tag" style={{ background: "#D1FAE5", color: "#065F46" }}>Déposée</span>
                          : <span className="tag tag-warn">À déposer</span>}
                    </td>
                    <td>
                      <DossierStatus lastActivity={activity} />
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <Link href={`/comptable-pro/dossiers/${d.id}`} className="btn btn-outline btn-sm">
                          Ouvrir
                        </Link>
                        <Link href={`/comptable-pro/dossiers/${d.id}/edit`} className="btn btn-outline btn-sm">
                          Modifier
                        </Link>
                        <Link href={`/comptable-pro/dossiers/${d.id}/tva`} className="btn btn-outline btn-sm">
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
    </div>
  );
}
