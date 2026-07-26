"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import RevenueExpenseChart, { type FinanceChartPoint } from "@/app/(app)/dashboard/RevenueExpenseChart";
import DashboardNews from "@/app/(app)/dashboard/DashboardNews";

function fmt(n: number) {
  return n.toLocaleString("fr-MA") + " MAD";
}

const STATUS_BADGE: Record<string, [string, string, string]> = {
  paid:                ["#D1FAE5", "#065F46",  "Payée"],
  sent:                ["#EFF6FF", "#1D4ED8",  "En attente"],
  overdue:             ["#FEE2E2", "#991B1B",  "En retard"],
  draft:               ["#F3F4F6", "#6B7280",  "Brouillon"],
  cancelled:           ["#F3F4F6", "#6B7280",  "Annulée"],
  partiellement_payee: ["#FEF3C7", "#92400E",  "Partiel"],
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <div className="h-4 w-[3px] flex-shrink-0 rounded-full bg-[#C8924A]" />
      <span className="text-[11px] font-semibold uppercase tracking-[1px] text-[#6B7280]">{children}</span>
    </div>
  );
}

interface Props {
  dossier: {
    id: string;
    raison_sociale: string;
    regime_tva?: string | null;
    solde_banque_initial: number;
    solde_caisse_initial: number;
    dettes_fournisseurs_initiales: number;
    creances_clients_initiales?: number | null;
  };
  invoices: Array<{
    id: string;
    invoice_number: string;
    issue_date: string;
    due_date?: string | null;
    montant_recu?: number | string | null;
    subtotal?: number | string | null;
    tax_amount?: number | string | null;
    total: number;
    status: string;
    clients?: { name: string } | null;
  }>;
  transactions: Array<{
    id: string;
    date: string;
    description: string;
    amount: number;
    type: string;
    category: string | null;
  }>;
  chartData: FinanceChartPoint[];
  dailyChartData: FinanceChartPoint[];
  isClientPortal?: boolean;
}

export default function DossierDashboard({ dossier, invoices, transactions, chartData, dailyChartData, isClientPortal = false }: Props) {
  const base = `/comptable-pro/dossiers/${dossier.id}`;
  const activeInvoices = invoices.filter(i => i.status !== "draft");
  const expenseTx = transactions.filter(t => t.type === "expense" || Number(t.amount) < 0);

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const revenue = transactions
    .filter(t => t.type === "income" && t.date >= monthStart)
    .reduce((s, t) => s + Number(t.amount), 0);

  const pendingInvs = activeInvoices.filter(i => ["sent", "overdue"].includes(i.status));
  const pendingTotal = pendingInvs.reduce((s, i) => s + Number(i.total), 0);
  const todayStr = now.toISOString().slice(0, 10);
  const totalAEncaisser = pendingInvs.reduce((s, i) => s + Math.max(Number(i.total) - Number(i.montant_recu ?? 0), 0), 0);
  const overdueCount = pendingInvs.filter(i => i.due_date && i.due_date < todayStr).length;

  const charges = expenseTx.reduce((s, t) => s + Math.abs(Number(t.amount ?? 0)), 0);
  const txNet = transactions.reduce((s, t) => s + (t.type === "income" ? Number(t.amount) : -Math.abs(Number(t.amount))), 0);
  const tresorerie = txNet + Number(dossier.solde_banque_initial ?? 0) + Number(dossier.solde_caisse_initial ?? 0);
  const tvaCollectee = activeInvoices.reduce((s, i) => s + Number(i.tax_amount ?? 0), 0);
  const fournisseursAPayer = charges + Number(dossier.dettes_fournisseurs_initiales ?? 0);
  const regimeTva = (dossier.regime_tva ?? "mensuel").toLowerCase();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 20);

  return (
    <div>
      {/* Revenus/dépenses + Prochaines échéances side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-7 mb-8">
        <div>
          <SectionLabel>Revenus et dépenses</SectionLabel>
          <RevenueExpenseChart monthlyData={chartData} dailyData={dailyChartData} />
        </div>
        <div>
          <SectionLabel>Prochaines échéances</SectionLabel>
          <DashboardNews deadlines={null} tvaRegime={dossier.regime_tva} tvaAssujetti={true} />
        </div>
      </div>

      {/* KPIs */}
      <div className="mb-8">
        <SectionLabel>Vue d&apos;ensemble</SectionLabel>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <div className="kpi">
            <div className="kpi-label">CA ce mois</div>
            <div className="kpi-value">{fmt(revenue)}</div>
            <div className="text-[11px] text-[#6B7280]">
              {activeInvoices.length} facture{activeInvoices.length > 1 ? "s" : ""}
            </div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Factures en attente</div>
            <div className="kpi-value">{pendingInvs.length}</div>
            <div className="text-[11px] text-[#6B7280]">
              {pendingInvs.length > 0 ? fmt(pendingTotal) : "Aucune en attente"}
            </div>
          </div>
          {isClientPortal ? (
            <div className="kpi">
              <div className="kpi-label">Trésorerie</div>
              <div className="kpi-value">{fmt(tresorerie)}</div>
              <div className="text-[11px] text-[#6B7280]">{transactions.length} transaction{transactions.length > 1 ? "s" : ""}</div>
            </div>
          ) : (
            <div className="kpi">
              <div className="kpi-label">TVA à déclarer</div>
              <div className="kpi-value">{fmt(Math.round(tvaCollectee))}</div>
              <div className="flex items-center gap-1.5 text-[11px] text-[#6B7280]">
                Échéance <span className="tag tag-warn">20 {nextMonth.toLocaleDateString("fr-MA", { month: "short" })}</span>
              </div>
            </div>
          )}
          <div className="kpi">
            <div className="kpi-label">Fournisseurs à payer</div>
            <div className="kpi-value">{fmt(fournisseursAPayer)}</div>
            <div className="text-[11px] text-[#6B7280]">
              Régime {regimeTva}
            </div>
          </div>
        </div>
      </div>

      {/* Suivi des paiements widget */}
      <div className="mb-8">
        <SectionLabel>Suivi des paiements</SectionLabel>
        <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl p-4 flex items-center gap-6 flex-wrap" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div className="flex-1 min-w-[160px]">
            <div className="text-[10.5px] font-semibold text-[#6B7280] uppercase tracking-[0.5px] mb-1">À encaisser</div>
            <div className="text-[18px] font-bold text-[#1A1A2E]">{fmt(totalAEncaisser)}</div>
            {overdueCount > 0 ? (
              <div className="text-[11px] text-[#DC2626] mt-0.5 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#DC2626] inline-block animate-pulse" />
                {overdueCount} facture{overdueCount > 1 ? "s" : ""} en retard
              </div>
            ) : (
              <div className="text-[11px] text-[#059669] mt-0.5">Aucun retard</div>
            )}
          </div>
          <div className="w-px h-10 bg-[rgba(0,0,0,0.08)] hidden md:block" />
          <div className="flex-1 min-w-[160px]">
            <div className="text-[10.5px] font-semibold text-[#6B7280] uppercase tracking-[0.5px] mb-1">Fournisseurs — À payer</div>
            <div className="text-[18px] font-bold text-[#1A1A2E]">{fmt(fournisseursAPayer)}</div>
            <div className="text-[11px] text-[#6B7280] mt-0.5">{expenseTx.length} dépense{expenseTx.length > 1 ? "s" : ""}</div>
          </div>
          <Link href={`${base}/transactions`} className="btn btn-gold flex-shrink-0 flex items-center gap-1.5">
            Voir les transactions <ArrowRight size={12} />
          </Link>
        </div>
      </div>

      {/* Two-column tables */}
      <div>
        <SectionLabel>Factures récentes</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-[1.6fr_1fr] gap-3">
          {/* Invoices */}
          <div className="tbl">
            <div className="tbl-header">
              <span className="tbl-title">Factures récentes</span>
              <Link href={`${base}/invoices`} className="btn btn-outline btn-sm flex items-center gap-1">
                Voir tout <ArrowRight size={11} />
              </Link>
            </div>
            <table>
              <thead>
                <tr>
                  <th>N°</th>
                  <th>Client</th>
                  <th>TTC</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-6 text-[#6B7280] text-[12px]">Aucune facture</td></tr>
                )}
                {invoices.slice(0, 5).map((inv) => (
                  <tr key={inv.id}>
                    <td className="font-medium text-[#6B7280] text-[11.5px]">{inv.invoice_number}</td>
                    <td>{inv.clients?.name ?? "—"}</td>
                    <td className="font-semibold">{fmt(Number(inv.total))}</td>
                    <td>
                      {(() => {
                        const [bg, color, label] = STATUS_BADGE[inv.status] ?? ["#F3F4F6", "#6B7280", inv.status];
                        return (
                          <span className="inline-block px-2 py-0.5 text-[11px] font-semibold"
                            style={{ backgroundColor: bg, color }}>
                            {label}
                          </span>
                        );
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Transactions */}
          <div className="tbl">
            <div className="tbl-header">
              <span className="tbl-title">Transactions</span>
              <Link href={`${base}/transactions`} className="btn btn-outline btn-sm flex items-center gap-1">
                Voir tout <ArrowRight size={11} />
              </Link>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Date</th>
                  <th>Montant</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 && (
                  <tr><td colSpan={3} className="text-center py-6 text-[#6B7280] text-[12px]">Aucune transaction</td></tr>
                )}
                {transactions.slice(0, 6).map((tx) => (
                  <tr key={tx.id}>
                    <td className="max-w-[120px] truncate">{tx.description}</td>
                    <td className="text-[11px] text-[#6B7280] whitespace-nowrap w-[1%]">
                      {new Date(tx.date).toLocaleDateString("fr-MA", { day: "numeric", month: "short" })}
                    </td>
                    <td className={`font-semibold whitespace-nowrap w-[1%] ${tx.type === "income" ? "text-[#059669]" : "text-[#DC2626]"}`}>
                      {tx.type === "income" ? "+" : "-"}{fmt(Math.abs(Number(tx.amount)))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
