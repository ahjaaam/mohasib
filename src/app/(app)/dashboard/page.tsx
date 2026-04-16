import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { Invoice, Transaction } from "@/types";
import DashboardNews from "./DashboardNews";
import DashboardGreeting from "./DashboardGreeting";

function fmt(n: number) {
  return n.toLocaleString("fr-MA") + " MAD";
}

const STATUS_BADGE: Record<string, string> = {
  paid: '<span class="badge b-paid">Payée</span>',
  sent: '<span class="badge b-pending">En attente</span>',
  overdue: '<span class="badge b-overdue">En retard</span>',
  draft: '<span class="badge b-draft">Brouillon</span>',
  cancelled: '<span class="badge b-draft">Annulée</span>',
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-[3px] h-4 bg-[#C8924A] rounded-full flex-shrink-0" />
      <span className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-[1px]">{children}</span>
    </div>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [invoicesRes, transactionsRes, clientCountRes, profileRes] = await Promise.all([
    supabase.from("invoices").select("*, clients(id,name)").eq("user_id", user!.id)
      .order("created_at", { ascending: false }).limit(5),
    supabase.from("transactions").select("*").eq("user_id", user!.id)
      .order("date", { ascending: false }).limit(6),
    supabase.from("clients").select("id", { count: "exact" }).eq("user_id", user!.id),
    supabase.from("users").select("full_name").eq("id", user!.id).single(),
  ]);

  const invoices: Invoice[] = invoicesRes.data ?? [];
  const transactions: Transaction[] = transactionsRes.data ?? [];
  const clientCount = clientCountRes.count ?? 0;
  const firstName = profileRes.data?.full_name?.split(" ")[0] ?? "vous";

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  const revenue = transactions.filter((t) => t.type === "income" && t.date >= monthStart)
    .reduce((s, t) => s + Number(t.amount), 0);
  const pendingInvs = invoices.filter((i) => i.status === "sent" || i.status === "overdue");
  const pendingTotal = pendingInvs.reduce((s, i) => s + Number(i.total), 0);

  const tvaEstimate = invoices
    .filter((i) => i.status === "paid" || i.status === "sent")
    .reduce((s, i) => s + Number(i.tax_amount), 0);

  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 20);

  return (
    <div>
      {/* Greeting */}
      <DashboardGreeting firstName={firstName} />

      {/* Actions rapides + Prochaines échéances side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-7 mb-8">
        {/* Actions rapides */}
        <div>
          <SectionLabel>Actions rapides</SectionLabel>
          <div className="grid grid-cols-2 gap-2.5">
            <Link href="/invoices/new" className="qa-card">
              <div className="text-2xl flex-shrink-0">🧾</div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-[#1A1A2E] leading-tight">Créer une facture</div>
                <div className="text-[11px] text-[#6B7280] leading-snug">ICE, TVA et WhatsApp intégrés</div>
              </div>
              <ArrowUpRight size={13} className="text-[#0C1526] flex-shrink-0" />
            </Link>
            <Link href="/transactions" className="qa-card">
              <div className="text-2xl flex-shrink-0">💸</div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-[#1A1A2E] leading-tight">Enregistrer une dépense</div>
                <div className="text-[11px] text-[#6B7280] leading-snug">Ajout rapide au journal</div>
              </div>
              <ArrowUpRight size={13} className="text-[#0C1526] flex-shrink-0" />
            </Link>
            <Link href="/chat" className="qa-card">
              <div className="text-2xl flex-shrink-0">💬</div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-[#1A1A2E] leading-tight">Demander à Mohasib Chat</div>
                <div className="text-[11px] text-[#6B7280] leading-snug">Votre comptable 24h/24</div>
              </div>
              <ArrowUpRight size={13} className="text-[#0C1526] flex-shrink-0" />
            </Link>
            <Link href="/invoices" className="qa-card">
              <div className="text-2xl flex-shrink-0">📋</div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-[#1A1A2E] leading-tight">Voir les factures</div>
                <div className="text-[11px] text-[#6B7280] leading-snug">
                  {pendingInvs.length > 0 ? `${pendingInvs.length} en attente de paiement` : "Toutes à jour"}
                </div>
              </div>
              <ArrowUpRight size={13} className="text-[#0C1526] flex-shrink-0" />
            </Link>
          </div>
        </div>

        {/* Prochaines échéances */}
        <div>
          <SectionLabel>Prochaines échéances</SectionLabel>
          <DashboardNews />
        </div>
      </div>

      {/* KPIs */}
      <div className="mb-8">
        <SectionLabel>Vue d&apos;ensemble</SectionLabel>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <div className="kpi">
            <div className="kpi-label">CA ce mois</div>
            <div className="kpi-value">{fmt(revenue)}</div>
            <div className="flex items-center gap-1.5 text-[11px] text-[#6B7280]">
              <span className="tag tag-up">+12%</span> vs mois préc.
            </div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Factures en attente</div>
            <div className="kpi-value">{pendingInvs.length}</div>
            <div className="text-[11px] text-[#6B7280]">
              {pendingInvs.length > 0 ? fmt(pendingTotal) : "Aucune en attente"}
            </div>
          </div>
          <div className="kpi">
            <div className="kpi-label">TVA à déclarer</div>
            <div className="kpi-value">{fmt(Math.round(tvaEstimate))}</div>
            <div className="flex items-center gap-1.5 text-[11px] text-[#6B7280]">
              Échéance <span className="tag tag-warn">20 {nextMonth.toLocaleDateString("fr-MA", { month: "short" })}</span>
            </div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Clients actifs</div>
            <div className="kpi-value">{clientCount}</div>
            <div className="text-[11px] text-[#6B7280]">
              {clientCount === 0 ? "Aucun client" : `${clientCount} client${clientCount > 1 ? "s" : ""} actif${clientCount > 1 ? "s" : ""}`}
            </div>
          </div>
        </div>
      </div>

      {/* Two-column tables */}
      <div>
        <SectionLabel>Activité récente</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-[1.6fr_1fr] gap-3">
          {/* Invoices */}
          <div className="tbl">
            <div className="tbl-header">
              <span className="tbl-title">Factures récentes</span>
              <Link href="/invoices" className="btn btn-outline btn-sm flex items-center gap-1">
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
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="font-medium text-[#6B7280] text-[11.5px]">{inv.invoice_number}</td>
                    <td>{(inv as any).clients?.name ?? "—"}</td>
                    <td className="font-semibold">{fmt(Number(inv.total))}</td>
                    <td dangerouslySetInnerHTML={{ __html: STATUS_BADGE[inv.status] ?? "" }} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Transactions */}
          <div className="tbl">
            <div className="tbl-header">
              <span className="tbl-title">Transactions</span>
              <Link href="/transactions" className="btn btn-outline btn-sm flex items-center gap-1">
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
                {transactions.map((tx) => (
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
