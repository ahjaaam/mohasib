/** Returns the same UTC calendar day in the next billing period, clamped at month-end. */
export function nextSubscriptionEnd(period: unknown, now = new Date()) {
  const monthsToAdd = period === "annual" ? 12 : 1;
  const absoluteMonth = now.getUTCFullYear() * 12 + now.getUTCMonth() + monthsToAdd;
  const targetYear = Math.floor(absoluteMonth / 12);
  const targetMonth = absoluteMonth % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const targetDay = Math.min(now.getUTCDate(), lastDay);
  return new Date(Date.UTC(targetYear, targetMonth, targetDay)).toISOString().slice(0, 10);
}
