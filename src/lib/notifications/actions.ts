"use server";

import { createClient } from "@/lib/supabase/server";

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  is_dismissed: boolean;
  priority: "high" | "normal";
  unique_key: string | null;
  created_at: string;
}

// ─── Generate + upsert notifications based on current data ────────────────────

export async function generateNotifications() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const now = new Date();
  const today = now.toISOString().split("T")[0];

  // Fetch company
  const { data: company } = await supabase
    .from("companies")
    .select("*")
    .eq("user_id", user.id)
    .single();

  const upserts: any[] = [];

  // ── 1. Welcome notification ────────────────────────────────────────────────
  upserts.push({
    user_id: user.id,
    type: "welcome",
    title: "👋 Bienvenue sur Mohasib !",
    message: "Commencez par configurer votre entreprise et créer votre première facture.",
    link: "/settings",
    priority: "normal",
    unique_key: "welcome",
  });

  // ── 2. Missing company ICE ─────────────────────────────────────────────────
  if (company) {
    const createdAt = new Date(user.created_at ?? now);
    const daysSinceSignup = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
    if (!company.ice && daysSinceSignup >= 3) {
      upserts.push({
        user_id: user.id,
        type: "missing_info",
        title: "⚠️ Complétez votre profil",
        message: "Votre ICE et informations légales sont manquants. Ils sont requis sur vos factures.",
        link: "/settings",
        priority: "normal",
        unique_key: "missing_ice",
      });
    }
  }

  // ── 3. TVA deadline ────────────────────────────────────────────────────────
  const tvaRegime = (company as any)?.tva_regime ?? "Mensuel";
  let tvaDeadline: Date;
  if (tvaRegime === "Trimestriel") {
    const month = now.getMonth(); // 0-indexed
    const quarterEndMonth = Math.floor(month / 3) * 3 + 2; // last month of quarter
    tvaDeadline = new Date(now.getFullYear(), quarterEndMonth + 1, 20);
  } else {
    tvaDeadline = new Date(now.getFullYear(), now.getMonth() + 1, 20);
  }

  const daysUntilTVA = Math.ceil((tvaDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const tvaKey = `tva_${tvaDeadline.toISOString().split("T")[0]}`;

  if (daysUntilTVA <= 30 && daysUntilTVA >= 0) {
    const { data: invoices } = await supabase
      .from("invoices")
      .select("tax_amount, status")
      .eq("user_id", user.id)
      .in("status", ["paid", "sent"]);
    const tvaEstimate = (invoices ?? []).reduce((s: number, i: any) => s + Number(i.tax_amount ?? 0), 0);
    const deadline = tvaDeadline.toLocaleDateString("fr-MA", { day: "numeric", month: "long", year: "numeric" });
    upserts.push({
      user_id: user.id,
      type: "tva_deadline",
      title: `⏰ Déclaration TVA due le ${deadline}`,
      message: `Votre TVA estimée est ~${Math.round(tvaEstimate / 100) * 100} MAD. Ne manquez pas la date limite DGI.`,
      link: "/dashboard",
      priority: daysUntilTVA <= 10 ? "high" : "normal",
      unique_key: tvaKey,
    });
  }

  // ── 4. Monthly summary (1st of month) ─────────────────────────────────────
  if (now.getDate() === 1 || true) { // always check, unique_key prevents dup
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    const prevStart = prevMonth.toISOString().split("T")[0];
    const prevEnd = prevMonthEnd.toISOString().split("T")[0];
    const monthKey = `monthly_summary_${prevMonth.getFullYear()}_${String(prevMonth.getMonth() + 1).padStart(2, "0")}`;
    const monthLabel = prevMonth.toLocaleDateString("fr-MA", { month: "long", year: "numeric" });

    const { data: prevInvoices } = await supabase
      .from("invoices")
      .select("total, tax_amount, status, issue_date")
      .eq("user_id", user.id)
      .gte("issue_date", prevStart)
      .lte("issue_date", prevEnd);

    const { data: prevTxs } = await supabase
      .from("transactions")
      .select("amount, type, date")
      .eq("user_id", user.id)
      .gte("date", prevStart)
      .lte("date", prevEnd);

    if ((prevInvoices ?? []).length > 0 || (prevTxs ?? []).length > 0) {
      const ca = (prevInvoices ?? []).filter((i: any) => i.status !== "draft")
        .reduce((s: number, i: any) => s + Number(i.total), 0);
      const deps = (prevTxs ?? []).filter((t: any) => t.type === "expense")
        .reduce((s: number, t: any) => s + Number(t.amount), 0);
      const net = ca - deps;
      const count = (prevInvoices ?? []).length;
      const fmt = (n: number) => n.toLocaleString("fr-MA", { maximumFractionDigits: 0 });
      upserts.push({
        user_id: user.id,
        type: "monthly_summary",
        title: `📊 Résumé de ${monthLabel}`,
        message: `CA: ${fmt(ca)} MAD | Factures émises: ${count} | Dépenses: ${fmt(deps)} MAD | Résultat net: ${fmt(net)} MAD`,
        link: "/dashboard",
        priority: "normal",
        unique_key: monthKey,
      });
    }
  }

  // ── 5. Overdue invoices ────────────────────────────────────────────────────
  const { data: overdueInvs } = await supabase
    .from("invoices")
    .select("id, invoice_number, total, due_date, clients(name)")
    .eq("user_id", user.id)
    .lt("due_date", today)
    .not("status", "in", '("paid","cancelled","draft")');

  for (const inv of overdueInvs ?? []) {
    const daysOverdue = Math.floor(
      (now.getTime() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24)
    );
    const clientName = (inv as any).clients?.name ?? "Client inconnu";
    const amount = Number((inv as any).total ?? 0).toLocaleString("fr-MA", { maximumFractionDigits: 0 });
    const isLarge = Number((inv as any).total ?? 0) > 10000 && daysOverdue >= 45;

    upserts.push({
      user_id: user.id,
      type: isLarge ? "large_invoice_unpaid" : "invoice_overdue",
      title: isLarge
        ? `🔴 Facture importante en attente`
        : `📌 Facture en retard — ${clientName}`,
      message: isLarge
        ? `${clientName} vous doit ${amount} MAD depuis ${daysOverdue} jours. Pensez à relancer.`
        : `${(inv as any).invoice_number} de ${amount} MAD est en retard de ${daysOverdue} jour${daysOverdue > 1 ? "s" : ""}. Envoyez une relance à votre client.`,
      link: `/invoices/${inv.id}`,
      priority: "high",
      unique_key: `overdue_${inv.id}`,
    });
  }

  // ── CNSS: last day of month ────────────────────────────────────────────────
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  if (now.getDate() >= lastDayOfMonth - 2) {
    const cnssKey = `cnss_${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, "0")}`;
    upserts.push({
      user_id: user.id,
      type: "cnss_reminder",
      title: "📋 Rappel CNSS",
      message: "N'oubliez pas votre déclaration CNSS mensuelle avant la fin du mois.",
      link: "/dashboard",
      priority: "normal",
      unique_key: cnssKey,
    });
  }

  // ── Bulk upsert (unique_key guards duplicates) ─────────────────────────────
  if (upserts.length > 0) {
    await supabase
      .from("notifications")
      .upsert(upserts, {
        onConflict: "user_id,unique_key",
        ignoreDuplicates: true,
      });
  }
}

// ─── Fetch notifications for current user ─────────────────────────────────────

export async function fetchNotifications(limit = 10): Promise<Notification[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_dismissed", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []) as Notification[];
}

export async function fetchAllNotifications(): Promise<Notification[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (data ?? []) as Notification[];
}

export async function markAllRead() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id);
}

export async function markRead(id: string) {
  const supabase = await createClient();
  await supabase.from("notifications").update({ is_read: true }).eq("id", id);
}

export async function dismissNotification(id: string) {
  const supabase = await createClient();
  await supabase.from("notifications").update({ is_dismissed: true, is_read: true }).eq("id", id);
}

export async function deleteReadNotifications() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("notifications").delete().eq("user_id", user.id).eq("is_read", true);
}
