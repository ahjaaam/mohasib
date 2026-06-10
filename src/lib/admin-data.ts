import "server-only";
import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-auth";

export async function adminContext() {
  const user = await requireAdmin();
  return { user, admin: createAdminClient() };
}

export async function authUserMap() {
  const admin = createAdminClient();
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const users = new Map<string, User>();
  const authUsers = (data.users ?? []) as User[];
  authUsers.forEach(user => users.set(user.id, user));
  return users;
}

export function accountStatus(company: Record<string, unknown>) {
  if (company.is_suspended) return "suspended";
  if (company.subscription_status) return String(company.subscription_status);
  const trialEnd = company.trial_ends_at ? new Date(String(company.trial_ends_at)) : null;
  return trialEnd && trialEnd >= new Date() ? "trial" : "expired";
}

export function formatDate(value?: string | null) {
  return value ? new Intl.DateTimeFormat("fr-MA", { dateStyle: "medium" }).format(new Date(value)) : "—";
}

export function formatMoney(value?: number | null) {
  return new Intl.NumberFormat("fr-MA", { style: "currency", currency: "MAD", maximumFractionDigits: 0 }).format(value ?? 0);
}

export function csvResponse(rows: Record<string, unknown>[], filename: string) {
  const headers = [...new Set(rows.flatMap(row => Object.keys(row)))];
  const cell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const csv = [headers.map(cell).join(","), ...rows.map(row => headers.map(header => cell(row[header])).join(","))].join("\n");
  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
