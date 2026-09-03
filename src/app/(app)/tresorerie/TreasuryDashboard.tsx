"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  CircleDollarSign,
  Landmark,
  ReceiptText,
  WalletCards,
} from "lucide-react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import PageHeader from "@/components/PageHeader";
import type { CustomerPaymentBehavior, ReceivableRecommendation, RecurringExpense, TreasuryFlow, TreasurySnapshot } from "@/lib/treasury";
import TreasuryPlanningPanels from "./TreasuryPlanningPanels";

function mad(value: number, compact = false) {
  if (compact && Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toLocaleString("fr-MA", { maximumFractionDigits: 1 })} M`;
  if (compact && Math.abs(value) >= 1_000) return `${(value / 1_000).toLocaleString("fr-MA", { maximumFractionDigits: 0 })} k`;
  return `${value.toLocaleString("fr-MA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} MAD`;
}

function flowIcon(flow: TreasuryFlow) {
  if (flow.source === "payroll") return <WalletCards size={15} />;
  if (flow.source === "recurring") return <CalendarClock size={15} />;
  if (flow.direction === "in") return <ArrowDownLeft size={15} />;
  return <ArrowUpRight size={15} />;
}

function MetricCard({ label, value, note, tone = "neutral" }: { label: string; value: number; note: string; tone?: "neutral" | "positive" | "negative" }) {
  const color = tone === "positive" ? "text-[#047857]" : tone === "negative" ? "text-[#B91C1C]" : "text-[#1A1A2E]";
  return (
    <div className="border border-black/[0.08] bg-white p-4">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#8A8F98]">{label}</p>
      <p className={`mt-2 text-[21px] font-bold tracking-[-0.02em] ${color}`}>{mad(value)}</p>
      <p className="mt-1 text-[10.5px] text-[#8A8F98]">{note}</p>
    </div>
  );
}

export default function TreasuryDashboard({
  snapshots,
  basePath = "",
  dossierId,
  lastMovementDate,
  accounts,
  budgets,
  transfers,
  recurringExpenses,
  paymentBehaviors,
  recommendations,
}: {
  snapshots: Record<30 | 90, TreasurySnapshot>;
  basePath?: string;
  dossierId?: string;
  lastMovementDate: string | null;
  accounts: any[];
  budgets: any[];
  transfers: any[];
  recurringExpenses: RecurringExpense[];
  paymentBehaviors: CustomerPaymentBehavior[];
  recommendations: ReceivableRecommendation[];
}) {
  const [horizon, setHorizon] = useState<30 | 90>(30);
  const [flowFilter, setFlowFilter] = useState<"all" | "in" | "out">("all");
  const snapshot = snapshots[horizon];
  const horizonEnd = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + horizon);
    return date.toISOString().slice(0, 10);
  }, [horizon]);
  const visibleFlows = snapshot.flows
    .filter((flow) => flow.date <= horizonEnd && (flowFilter === "all" || flow.direction === flowFilter))
    .slice(0, 8);
  const lowIsNegative = snapshot.lowPoint.balance < 0;

  return (
    <div>
      <PageHeader
        title="Trésorerie"
        subtitle="Position enregistrée et prévisions à court terme"
        icon={<Landmark size={19} />}
        action={(
          <div className="inline-flex border border-black/[0.09] bg-white p-0.5" aria-label="Horizon de prévision">
            {([30, 90] as const).map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setHorizon(days)}
                className={`px-3 py-1.5 text-[11px] font-semibold transition-colors ${horizon === days ? "bg-[#1A1A2E] text-white" : "text-[#6B7280] hover:text-[#1A1A2E]"}`}
              >
                {days} jours
              </button>
            ))}
          </div>
        )}
      />

      <div className="mb-4 flex items-start gap-2.5 border border-[#E8D8BE] bg-[#FFFBF4] px-3.5 py-3 text-[11px] text-[#76572F]">
        <CircleDollarSign size={15} className="mt-0.5 shrink-0 text-[#C8924A]" />
        <p>
          {accounts.length ? "La position utilise les soldes des comptes de trésorerie configurés." : "La position enregistrée correspond au solde net des mouvements saisis ou importés. Elle ne remplace pas le solde officiel de votre banque."}
          {lastMovementDate ? ` Dernier mouvement : ${new Date(`${lastMovementDate}T12:00:00`).toLocaleDateString("fr-MA")}.` : " Aucun mouvement bancaire enregistré."}
        </p>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label={accounts.length ? "Position des comptes" : "Position enregistrée"} value={snapshot.position} note={accounts.length ? `${accounts.length} compte${accounts.length > 1 ? "s" : ""} actif${accounts.length > 1 ? "s" : ""}` : "Mouvements comptabilisés à ce jour"} tone={snapshot.position < 0 ? "negative" : "neutral"} />
        <MetricCard label={`Prévision à ${horizon} jours`} value={snapshot.projectedPosition} note={`Après ${snapshot.flows.filter((flow) => flow.date <= horizonEnd).length} flux attendus`} tone={snapshot.projectedPosition < 0 ? "negative" : "positive"} />
        <MetricCard label="Encaissements attendus" value={snapshot.expectedInflows} note="Factures clients non soldées" tone="positive" />
        <MetricCard label="Décaissements prévus" value={snapshot.expectedOutflows} note="Fournisseurs et salaires identifiés" tone={snapshot.expectedOutflows > snapshot.expectedInflows ? "negative" : "neutral"} />
      </div>

      {(lowIsNegative || snapshot.overdueCount > 0) && (
        <div className="mb-5 grid grid-cols-1 gap-2.5 md:grid-cols-2">
          {lowIsNegative && (
            <div className="flex gap-3 border-l-2 border-[#DC2626] bg-[#FEF2F2] px-4 py-3">
              <AlertTriangle size={17} className="mt-0.5 shrink-0 text-[#DC2626]" />
              <div>
                <p className="text-[12px] font-semibold text-[#991B1B]">Tension de trésorerie prévue</p>
                <p className="mt-0.5 text-[10.5px] text-[#B45353]">Point bas estimé à {mad(snapshot.lowPoint.balance)} vers le {new Date(`${snapshot.lowPoint.date}T12:00:00`).toLocaleDateString("fr-MA")}.</p>
              </div>
            </div>
          )}
          {snapshot.overdueCount > 0 && (
            <div className="flex gap-3 border-l-2 border-[#C8924A] bg-[#FFFBEB] px-4 py-3">
              <CalendarClock size={17} className="mt-0.5 shrink-0 text-[#B7791F]" />
              <div>
                <p className="text-[12px] font-semibold text-[#8A5E25]">{snapshot.overdueCount} échéance{snapshot.overdueCount > 1 ? "s" : ""} en retard</p>
                <Link href={`${basePath}/suivi-paiements`} className="mt-0.5 inline-flex items-center gap-1 text-[10.5px] font-semibold text-[#8A5E25] hover:underline">Ouvrir le suivi <ArrowRight size={10} /></Link>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(270px,0.75fr)]">
        <section className="border border-black/[0.08] bg-white p-4" aria-label="Prévision de trésorerie">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-[13px] font-bold text-[#1A1A2E]">Prévision glissante</h2>
              <p className="text-[10.5px] text-[#9CA3AF]">Solde projeté par semaine selon les échéances et comportements observés</p>
            </div>
            <div className="flex items-center gap-3 text-[9.5px] font-medium text-[#6B7280]">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 bg-[#C8924A]" />Solde</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 bg-[#B9E5D1]" />Entrées</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 bg-[#F2C6C2]" />Sorties</span>
            </div>
          </div>
          <div className="h-[270px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={snapshot.chart} margin={{ top: 8, right: 7, left: -14, bottom: 0 }}>
                <defs>
                  <linearGradient id="treasuryBalance" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#C8924A" stopOpacity={0.24} /><stop offset="100%" stopColor="#C8924A" stopOpacity={0.02} /></linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#ECEAE5" strokeDasharray="2 4" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} interval={horizon === 90 ? 1 : 0} tick={{ fill: "#8A8F98", fontSize: 9 }} />
                <YAxis axisLine={false} tickLine={false} width={52} tick={{ fill: "#9CA3AF", fontSize: 8 }} tickFormatter={(value) => mad(Number(value), true).replace(" MAD", "")} />
                <ReferenceLine y={0} stroke="#DC2626" strokeDasharray="3 3" strokeOpacity={0.5} />
                <Tooltip formatter={(value: number, name: string) => [mad(Number(value)), name === "balance" ? "Solde projeté" : name === "inflows" ? "Entrées" : "Sorties"]} contentStyle={{ border: "1px solid rgba(0,0,0,.10)", fontSize: 10.5, boxShadow: "0 8px 24px rgba(13,21,38,.10)" }} />
                <Bar dataKey="inflows" fill="#B9E5D1" maxBarSize={10} />
                <Bar dataKey="outflows" fill="#F2C6C2" maxBarSize={10} />
                <Area type="monotone" dataKey="balance" stroke="#C8924A" strokeWidth={2} fill="url(#treasuryBalance)" dot={false} activeDot={{ r: 3, fill: "#C8924A" }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </section>

        <aside className="border border-black/[0.08] bg-[#111621] p-4 text-white">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/45">Point bas prévu</p>
          <p className={`mt-2 text-[25px] font-bold ${lowIsNegative ? "text-[#F7A7A0]" : "text-white"}`}>{mad(snapshot.lowPoint.balance)}</p>
          <p className="mt-1 text-[10.5px] text-white/50">Semaine du {new Date(`${snapshot.lowPoint.date}T12:00:00`).toLocaleDateString("fr-MA")}</p>
          <div className="my-5 h-px bg-white/10" />
          <p className="text-[11px] leading-5 text-white/65">
            Cette projection suppose que les factures seront encaissées ou payées à leur date d’échéance. Les retards existants sont positionnés aujourd’hui.
          </p>
          <div className="mt-5 space-y-2">
            <Link href={`${basePath}/transactions`} className="flex items-center justify-between border border-white/10 px-3 py-2.5 text-[11px] font-semibold hover:bg-white/5"><span className="flex items-center gap-2"><ReceiptText size={14} />Transactions</span><ArrowRight size={12} /></Link>
          </div>
        </aside>
      </div>

      <section className="border border-black/[0.08] bg-white">
        <div className="flex flex-col gap-3 border-b border-black/[0.07] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-[13px] font-bold text-[#1A1A2E]">Flux à venir</h2>
            <p className="text-[10.5px] text-[#9CA3AF]">Échéances identifiées dans les données Mohasib</p>
          </div>
          <div className="flex gap-1">
            {([['all', 'Tous'], ['in', 'Entrées'], ['out', 'Sorties']] as const).map(([value, label]) => (
              <button key={value} type="button" onClick={() => setFlowFilter(value)} className={`px-2.5 py-1.5 text-[10.5px] font-semibold ${flowFilter === value ? "bg-[#F3EADF] text-[#8A5E25]" : "text-[#8A8F98] hover:bg-[#F7F7F5]"}`}>{label}</button>
            ))}
          </div>
        </div>
        {visibleFlows.length ? (
          <div className="divide-y divide-black/[0.06]">
            {visibleFlows.map((flow) => (
              <div key={flow.id} className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:grid-cols-[32px_minmax(160px,1fr)_minmax(130px,.7fr)_110px_130px]">
                <div className={`flex h-8 w-8 items-center justify-center ${flow.direction === "in" ? "bg-[#ECFDF5] text-[#047857]" : "bg-[#FEF2F2] text-[#B91C1C]"}`}>{flowIcon(flow)}</div>
                <div className="min-w-0"><p className="truncate text-[11.5px] font-semibold text-[#242836]">{flow.counterparty}</p><p className="truncate text-[10px] text-[#9CA3AF]">{flow.label}</p></div>
                <span className="hidden truncate text-[10.5px] text-[#6B7280] sm:block" title={flow.assumption}>{flow.source === "client" ? "Client" : flow.source === "supplier" ? "Fournisseur" : flow.source === "payroll" ? "Paie" : "Récurrent"}</span>
                <div className="hidden sm:block"><span className={`text-[10px] font-semibold ${flow.overdue ? "bg-[#FEF3C7] px-2 py-1 text-[#92400E]" : "text-[#6B7280]"}`}>{flow.overdue ? "En retard" : new Date(`${flow.date}T12:00:00`).toLocaleDateString("fr-MA")}</span></div>
                <p className={`text-right text-[11.5px] font-bold ${flow.direction === "in" ? "text-[#047857]" : "text-[#B91C1C]"}`}>{flow.direction === "in" ? "+" : "−"}{mad(flow.amount)}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 py-10 text-center"><CalendarClock size={22} className="mx-auto text-[#C8CBD0]" /><p className="mt-2 text-[11.5px] font-semibold text-[#6B7280]">Aucun flux prévu sur cet horizon</p><p className="mt-0.5 text-[10.5px] text-[#9CA3AF]">Les factures et échéances apparaîtront ici automatiquement.</p></div>
        )}
      </section>

      <TreasuryPlanningPanels
        snapshot={snapshot}
        basePath={basePath}
        dossierId={dossierId}
        accounts={accounts}
        budgets={budgets}
        transfers={transfers}
        recurringExpenses={recurringExpenses}
        paymentBehaviors={paymentBehaviors}
        recommendations={recommendations}
      />
    </div>
  );
}
