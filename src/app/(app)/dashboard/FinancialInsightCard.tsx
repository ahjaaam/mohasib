import { AlertTriangle, Lightbulb, TrendingUp } from "lucide-react";

function formatAmount(amount: number) {
  return `${amount.toLocaleString("fr-MA", { maximumFractionDigits: 0 })} MAD`;
}

export default function FinancialInsightCard({
  revenue,
  expenses,
  overdueCount,
  periodLabel,
}: {
  revenue: number;
  expenses: number;
  overdueCount: number;
  periodLabel: string;
}) {
  const balance = revenue - expenses;
  const margin = revenue > 0 ? Math.round((balance / revenue) * 100) : null;
  const hasActivity = revenue > 0 || expenses > 0;
  const insight = overdueCount > 0
    ? {
        icon: AlertTriangle,
        iconClass: "bg-[#FEF2F2] text-[#B91C1C]",
        title: "Priorité aux encaissements",
        detail: `${overdueCount} facture${overdueCount > 1 ? "s sont" : " est"} en retard. Relancez les clients concernés pour protéger votre trésorerie.`,
      }
    : !hasActivity
      ? {
          icon: Lightbulb,
          iconClass: "bg-[#FFF7E8] text-[#9A631C]",
          title: "Votre analyse apparaîtra ici",
          detail: "Ajoutez des transactions pour obtenir un aperçu automatique de votre performance financière.",
        }
      : balance >= 0
        ? {
            icon: TrendingUp,
            iconClass: "bg-[#ECFDF5] text-[#047857]",
            title: "Activité excédentaire",
            detail: `Vos revenus couvrent vos dépenses avec un solde positif de ${formatAmount(balance)}.`,
          }
        : {
            icon: AlertTriangle,
            iconClass: "bg-[#FFF7E8] text-[#9A631C]",
            title: "Dépenses à surveiller",
            detail: `Vos dépenses dépassent vos revenus de ${formatAmount(Math.abs(balance))} sur la période.`,
          };
  const InsightIcon = insight.icon;

  return (
    <aside className="flex h-full min-h-[210px] flex-col border border-[#D6E5F2] bg-[#F2F7FC] p-5 text-[#1A1A2E]" aria-labelledby="financial-insight-title">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[9.5px] font-semibold uppercase tracking-[1.2px] text-[#5279A8]">Financial insight</div>
          <h3 id="financial-insight-title" className="mt-1 text-[15px] font-semibold">Analyse financière</h3>
        </div>
        <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${insight.iconClass}`}>
          <InsightIcon size={17} aria-hidden="true" />
        </span>
      </div>
      <div className="mt-4 flex-1">
        <p className="text-[13px] font-semibold leading-snug">{insight.title}</p>
        <p className="mt-1.5 text-[11px] leading-relaxed text-[#6B7280]">{insight.detail}</p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-[#D6E5F2] pt-3">
        <div>
          <div className="text-[9px] uppercase tracking-[0.6px] text-[#9CA3AF]">Solde</div>
          <div className={`mt-1 text-[12px] font-bold ${balance < 0 ? "text-[#B91C1C]" : "text-[#047857]"}`}>
            {balance > 0 ? "+" : ""}{formatAmount(balance)}
          </div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-[0.6px] text-[#9CA3AF]">Marge</div>
          <div className="mt-1 text-[12px] font-bold text-[#1A1A2E]">{margin === null ? "—" : `${margin}%`}</div>
        </div>
      </div>
      <div className="mt-2 truncate text-[9.5px] text-[#9CA3AF]" title={periodLabel}>{periodLabel}</div>
    </aside>
  );
}
