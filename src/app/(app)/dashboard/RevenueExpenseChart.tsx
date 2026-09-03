"use client";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type FinanceChartPoint = {
  key: string;
  label: string;
  revenue: number;
  expenses: number;
  net: number;
};

function compactMad(value: number) {
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000) return `${(value / 1_000_000).toLocaleString("fr-MA", { maximumFractionDigits: 1 })} M`;
  if (absolute >= 1_000) return `${(value / 1_000).toLocaleString("fr-MA", { maximumFractionDigits: 0 })} k`;
  return value.toLocaleString("fr-MA", { maximumFractionDigits: 0 });
}

function exactMad(value: number) {
  return `${value.toLocaleString("fr-MA", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} MAD`;
}

export default function RevenueExpenseChart({
  data,
  periodLabel,
}: {
  data: FinanceChartPoint[];
  periodLabel: string;
}) {
  const highestValue = Math.max(0, ...data.flatMap((point) => [point.revenue, point.expenses]));

  return (
    <div
      className="revenue-expense-chart h-[210px] border border-[rgba(0,0,0,0.08)] bg-white p-3"
      role="region"
      aria-label={`Revenus et dépenses pour ${periodLabel}`}
    >
      <div className="mb-2 flex h-5 items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-[10.5px] font-medium text-[#6B7280]">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 bg-[var(--revenue-chart-color)]" aria-hidden="true" />
            Revenus
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 bg-[var(--expense-chart-color)]" aria-hidden="true" />
            Dépenses
          </span>
        </div>

        <span className="max-w-[130px] truncate text-[10px] font-semibold text-[#8A5E25]">{periodLabel}</span>
      </div>

      <div className="h-[158px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            barCategoryGap="28%"
            barGap={1}
            margin={{ top: 3, right: 4, bottom: 0, left: -13 }}
          >
            <CartesianGrid vertical={false} stroke="#E9E8E3" strokeDasharray="2 4" />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              interval={data.length > 16 ? 2 : data.length > 9 ? 1 : 0}
              tick={{ fill: "#6B7280", fontSize: 10 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              width={46}
              domain={[0, "auto"]}
              tickCount={3}
              tick={{ fill: "#6B7280", fontSize: 10 }}
              tickFormatter={(value: number) => value > highestValue ? "" : compactMad(value)}
            />
            <Tooltip
              cursor={{ fill: "rgba(13,21,38,0.035)" }}
              formatter={(value: number, name: string) => [
                exactMad(Number(value)),
                name === "revenue" ? "Revenus" : "Dépenses",
              ]}
              labelFormatter={(label) => label}
              labelStyle={{ color: "#1A1A2E", fontSize: 11, fontWeight: 600 }}
              contentStyle={{
                border: "1px solid rgba(0,0,0,0.10)",
                background: "#FFFFFF",
                boxShadow: "0 8px 24px rgba(13,21,38,0.10)",
                fontSize: 10.5,
                padding: "7px 9px",
              }}
            />
            <Bar dataKey="revenue" fill="var(--revenue-chart-color)" maxBarSize={14} />
            <Bar dataKey="expenses" fill="var(--expense-chart-color)" maxBarSize={14} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
