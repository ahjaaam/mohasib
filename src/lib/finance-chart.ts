import type { FinanceChartPoint } from "@/app/(app)/dashboard/RevenueExpenseChart";
import type { GlobalPeriod } from "@/lib/global-period";

type ChartTransaction = { date: string; type: string; amount: number | string };

export function buildFinanceChartData(transactions: ChartTransaction[], period: GlobalPeriod): FinanceChartPoint[] {
  const transactionDates = transactions.map((item) => item.date.slice(0, 10)).sort();
  const fallback = new Date();
  const startValue = period.start || transactionDates[0] || `${fallback.getFullYear()}-${String(fallback.getMonth() + 1).padStart(2, "0")}-01`;
  const endValue = period.end || transactionDates.at(-1) || fallback.toISOString().slice(0, 10);
  const start = new Date(`${startValue}T00:00:00`);
  const end = new Date(`${endValue}T00:00:00`);
  const dayCount = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
  const monthCount = (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth() + 1;
  const granularity = dayCount <= 62 ? "day" : monthCount <= 24 ? "month" : "year";
  const buckets = new Map<string, FinanceChartPoint>();

  const addBucket = (date: Date) => {
    const key = granularity === "day"
      ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
      : granularity === "month"
        ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
        : String(date.getFullYear());
    const label = granularity === "day"
      ? date.toLocaleDateString("fr-MA", { day: "2-digit", month: "short" }).replace(".", "")
      : granularity === "month"
        ? date.toLocaleDateString("fr-MA", { month: "short", year: monthCount > 12 ? "2-digit" : undefined }).replace(".", "")
        : String(date.getFullYear());
    if (!buckets.has(key)) buckets.set(key, { key, label, revenue: 0, expenses: 0, net: 0 });
  };

  const cursor = new Date(start);
  while (cursor <= end) {
    addBucket(cursor);
    if (granularity === "day") cursor.setDate(cursor.getDate() + 1);
    else if (granularity === "month") cursor.setMonth(cursor.getMonth() + 1, 1);
    else cursor.setFullYear(cursor.getFullYear() + 1, 0, 1);
  }

  for (const transaction of transactions) {
    const date = new Date(`${transaction.date.slice(0, 10)}T00:00:00`);
    const key = granularity === "day"
      ? transaction.date.slice(0, 10)
      : granularity === "month"
        ? transaction.date.slice(0, 7)
        : String(date.getFullYear());
    const bucket = buckets.get(key);
    if (!bucket) continue;
    const amount = Math.abs(Number(transaction.amount));
    if (transaction.type === "income") bucket.revenue += amount;
    if (transaction.type === "expense") bucket.expenses += amount;
    bucket.net = bucket.revenue - bucket.expenses;
  }

  return Array.from(buckets.values());
}
