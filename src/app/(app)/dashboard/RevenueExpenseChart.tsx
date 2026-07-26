"use client";

import { useState } from "react";
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

type ChartRange = "month" | 6 | 12;

export default function RevenueExpenseChart({
  monthlyData,
  dailyData,
}: {
  monthlyData: FinanceChartPoint[];
  dailyData: FinanceChartPoint[];
}) {
  const [range, setRange] = useState<ChartRange>(6);
  const isDailyRange = range === "month";
  const visibleData = isDailyRange ? dailyData : monthlyData.slice(-range);
  const ranges: { value: ChartRange; label: string }[] = [
    { value: "month", label: "Ce mois" },
    { value: 6, label: "6 mois" },
    { value: 12, label: "12 mois" },
  ];

  return (
    <div
      className="h-[142px] border border-[rgba(0,0,0,0.08)] bg-white p-3"
      role="region"
      aria-label={
        isDailyRange
          ? "Évolution quotidienne des revenus et des dépenses pour le mois en cours"
          : `Comparaison mensuelle des revenus et des dépenses sur ${range} mois`
      }
    >
      <div className="mb-2 flex h-5 items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-[10px] font-medium text-[#6B7280]">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 bg-[#C8924A]" aria-hidden="true" />
            Revenus
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 bg-[#0D1526]" aria-hidden="true" />
            Dépenses
          </span>
        </div>

        <div className="flex h-5 items-center border border-[#E5E7EB] bg-[#F7F7F5] p-px">
          {ranges.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setRange(value)}
              className={`h-4 min-h-0 px-2 text-[9px] font-semibold leading-none ${
                range === value ? "bg-[#0D1526] text-white" : "bg-transparent text-[#6B7280]"
              }`}
              aria-pressed={range === value}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[90px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={visibleData}
            barCategoryGap={isDailyRange ? "22%" : "34%"}
            barGap={isDailyRange ? 1 : 2}
            margin={{ top: 3, right: 4, bottom: 0, left: -13 }}
          >
            <CartesianGrid vertical={false} stroke="#E9E8E3" strokeDasharray="2 4" />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              interval={isDailyRange ? 4 : range === 12 ? 1 : 0}
              tick={{ fill: "#6B7280", fontSize: 9 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              width={46}
              domain={[0, "auto"]}
              tickCount={3}
              tick={{ fill: "#9CA3AF", fontSize: 8 }}
              tickFormatter={compactMad}
            />
            <Tooltip
              cursor={{ fill: "rgba(13,21,38,0.035)" }}
              formatter={(value: number, name: string) => [
                exactMad(Number(value)),
                name === "revenue" ? "Revenus" : "Dépenses",
              ]}
              labelFormatter={(label) => (isDailyRange ? `Jour ${label}` : label)}
              labelStyle={{ color: "#1A1A2E", fontSize: 11, fontWeight: 600 }}
              contentStyle={{
                border: "1px solid rgba(0,0,0,0.10)",
                background: "#FFFFFF",
                boxShadow: "0 8px 24px rgba(13,21,38,0.10)",
                fontSize: 10.5,
                padding: "7px 9px",
              }}
            />
            <Bar dataKey="revenue" fill="#C8924A" maxBarSize={isDailyRange ? 8 : 18} />
            <Bar dataKey="expenses" fill="#0D1526" maxBarSize={isDailyRange ? 8 : 18} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
