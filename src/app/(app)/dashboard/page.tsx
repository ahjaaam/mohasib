export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { Invoice, Transaction } from "@/types";
import DashboardNews from "./DashboardNews";
import DashboardGreeting from "./DashboardGreeting";
import { getMonthlyUsage } from "@/lib/usage";

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
    <div className="flex items-center gap-2 mb-3">
      <div className="w-[3px] h-4 bg-[#C8924A] rounded-full flex-shrink-0" />
      <span className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-[1px]">{children}</span>
    </div>
  );
}

function supplierTotal(item: any) {
  return Math.abs(Number(item.ocr_data?.amount ?? 0));
}

function supplierPaid(item: any) {
  return Number(item.ocr_data?.montant_paye ?? 0);
}

function isSupplierPaid(item: any) {
  return item.ocr_data?.payment_status === "paid" || item.status === "paid";
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const companyRes = await supabase.from("companies").select("id").eq("user_id", user!.id).single();
  const companyId = companyRes.data?.id ?? null;

  const [invoicesRes, transactionsRes, clientCountRes, profileRes, pendingRes, tvaRes, supplierRes, prefsRes] = await Promise.all([
    supabase.from("invoices").select("*, clients(id,name)").eq("user_id", user!.id).is("dossier_id", null)
      .order("created_at", { ascending: false }).limit(5),
    supabase.from("transactions").select("*").eq("user_id", user!.id).is("dossier_id", null)
      .order("date", { ascending: false }).limit(6),
    supabase.from("clients").select("id", { count: "exact" }).eq("user_id", user!.id).is("dossier_id", null),
    supabase.from("users").select("full_name").eq("id", user!.id).single(),
    supabase.from("invoices").select("total, status, due_date, montant_recu").eq("user_id", user!.id).is("dossier_id", null).in("status", ["sent", "overdue"]),
    supabase.from("invoices").select("tax_amount").eq("user_id", user!.id).is("dossier_id", null).in("status", ["paid", "sent"]),
    supabase.from("receipts").select("id, status, ocr_data").eq("user_id", user!.id).is("dossier_id", null).eq("status", "matched"),
    supabase.from("user_preferences").select("dashboard_deadlines").eq("user_id", user!.id).maybeSingle(),
  ]);

  const usageData = companyId ? await getMonthlyUsage(companyId) : null;
  const showUsageWarning = usageData && usageData.used / usageData.limit >= 0.8;

  const invoices: Invoice[] = invoicesRes.data ?? [];
  const transactions: Transaction[] = transactionsRes.data ?? [];
  const clientCount = clientCountRes.count ?? 0;
  const firstName = profileRes.data?.full_name?.split(" ")[0] ?? "vous";

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  const revenue = transactions.filter((t) => t.type === "income" && t.date >= monthStart)
    .reduce((s, t) => s + Number(t.amount), 0);
  const pendingInvs = pendingRes.data ?? [];
  const pendingTotal = pendingInvs.reduce((s, i) => s + Number(i.total), 0);

  const tvaEstimate = (tvaRes.data ?? []).reduce((s, i) => s + Number(i.tax_amount), 0);

  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 20);

  const todayStr = now.toISOString().slice(0, 10);
  const totalAEncaisser = pendingInvs.reduce((s, i) => s + Math.max(Number(i.total) - Number((i as any).montant_recu ?? 0), 0), 0);
  const overdueInvs = pendingInvs.filter((i: any) => i.due_date && i.due_date < todayStr);
  const overdueCount = overdueInvs.length;
  const supplierItems = (supplierRes.data ?? []).filter((r: any) => {
    if (r.ocr_data?.document_type === "avoir") return false;
    return r.ocr_data?.is_supplier_invoice !== false;
  });
  const unpaidSuppliers = supplierItems.filter((item: any) => !isSupplierPaid(item));
  const totalAPayer = unpaidSuppliers.reduce((s: number, item: any) => {
    return s + Math.max(supplierTotal(item) - supplierPaid(item), 0);
  }, 0);
  const overdueSuppliers = unpaidSuppliers.filter((item: any) => {
    const dueDate = item.ocr_data?.due_date;
    return dueDate && dueDate < todayStr;
  });

  return (
    <div>
      {/* Greeting */}
      <DashboardGreeting firstName={firstName} />

      {/* Usage warning banner */}
      {showUsageWarning && usageData && (
        <div className={`mb-5 rounded-xl px-4 py-3 flex items-center justify-between gap-3 text-[12.5px] ${
          usageData.used >= usageData.limit
            ? "bg-[#FEE2E2] border border-[#FECACA] text-[#DC2626]"
            : "bg-[#FEF3C7] border border-[#FDE68A] text-[#92400E]"
        }`}>
          <span>
            {usageData.used >= usageData.limit
              ? `⛔ Limite mensuelle atteinte (${usageData.used}/${usageData.limit} documents). Imports désactivés jusqu'au ${usageData.resetDate}.`
              : `⚠️ Vous avez utilisé ${usageData.used}/${usageData.limit} documents ce mois (${usageData.remaining} restant${usageData.remaining > 1 ? "s" : ""}).`}
          </span>
          <a href="/settings?tab=abonnement" className="font-semibold whitespace-nowrap hover:underline">Voir l'abonnement →</a>
        </div>
      )}

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
            <Link href="/archive" className="qa-card">
              <div className="text-2xl flex-shrink-0">🗂️</div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-[#1A1A2E] leading-tight">Gérer l&apos;archive</div>
                <div className="text-[11px] text-[#6B7280] leading-snug">Consulter et classer les documents</div>
              </div>
              <ArrowUpRight size={13} className="text-[#0C1526] flex-shrink-0" />
            </Link>
          </div>
        </div>

        {/* Prochaines échéances */}
        <div>
          <SectionLabel>Prochaines échéances</SectionLabel>
          <DashboardNews deadlines={prefsRes.data?.dashboard_deadlines ?? null} />
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

      {/* Suivi des paiements widget */}
      <div className="mb-8">
        <SectionLabel>Suivi des paiements</SectionLabel>
        <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl p-4 flex items-center gap-6 flex-wrap" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div className="flex-1 min-w-[160px]">
            <div className="text-[10.5px] font-semibold text-[#6B7280] uppercase tracking-[0.5px] mb-1">Clients — À encaisser</div>
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
            <div className="text-[18px] font-bold text-[#1A1A2E]">{fmt(totalAPayer)}</div>
            {overdueSuppliers.length > 0 ? (
              <div className="text-[11px] text-[#DC2626] mt-0.5 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#DC2626] inline-block animate-pulse" />
                {overdueSuppliers.length} facture{overdueSuppliers.length > 1 ? "s" : ""} en retard
              </div>
            ) : unpaidSuppliers.length > 0 ? (
              <div className="text-[11px] text-[#D97706] mt-0.5">
                {unpaidSuppliers.length} facture{unpaidSuppliers.length > 1 ? "s" : ""} à payer
              </div>
            ) : (
              <div className="text-[11px] text-[#059669] mt-0.5">Aucun paiement fournisseur</div>
            )}
          </div>
          <Link href="/suivi-paiements" className="btn btn-gold flex-shrink-0 flex items-center gap-1.5">
            Voir le suivi complet <ArrowRight size={12} />
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
                    <td>
                      {(() => {
                        const [bg, color, label] = STATUS_BADGE[inv.status] ?? ["#F3F4F6", "#6B7280", inv.status];
                        return (
                          <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold"
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
