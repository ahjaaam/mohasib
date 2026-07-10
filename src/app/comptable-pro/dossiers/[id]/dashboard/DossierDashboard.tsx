"use client";

import Link from "next/link";
import { Calculator, FileText, TrendingUp, Wallet, ArrowLeftRight, PenLine } from "lucide-react";
import type { DossierEcriture } from "@/types/fiduciaire";

function fmt(n: number) {
  return n.toLocaleString("fr-MA", { minimumFractionDigits: 2 }) + " MAD";
}
function fmtDate(d: string) {
  try {
    return new Date(d).toLocaleDateString("fr-MA", { day: "2-digit", month: "short" });
  } catch { return d; }
}

interface Props {
  dossier: {
    id: string;
    raison_sociale: string;
    solde_banque_initial: number;
    solde_caisse_initial: number;
    capital_social: number;
    dettes_fournisseurs_initiales: number;
  };
  ecritures: DossierEcriture[];
  invoices: Array<{
    id: string;
    invoice_number: string;
    issue_date: string;
    total: number;
    status: string;
    clients?: { name: string } | null;
  }>;
  transactions: Array<{
    id: string;
    date: string;
    description: string;
    amount: number;
    type: string;
    category: string | null;
  }>;
}

export default function DossierDashboard({ dossier, ecritures, invoices, transactions }: Props) {
  const base = `/comptable-pro/dossiers/${dossier.id}`;

  // ── KPIs ──────────────────────────────────────────────────────────────────────

  // CA: sum of all client invoices (non-draft)
  const ca = invoices
    .filter(i => i.status !== "draft")
    .reduce((s, i) => s + Number(i.total), 0);

  // Charges: sum of expense transactions
  const charges = transactions
    .filter(t => t.type === "expense" || Number(t.amount) < 0)
    .reduce((s, t) => s + Math.abs(Number(t.amount)), 0);

  // Résultat
  const resultat = ca - charges;

  // Trésorerie: net transactions + initial bank balance
  const txNet = transactions.reduce((s, t) => {
    const amt = Number(t.amount);
    return s + (t.type === "income" ? amt : -Math.abs(amt));
  }, 0);
  const tresorerie = txNet + Number(dossier.solde_banque_initial ?? 0);

  // ── Recent activity (unified timeline) ───────────────────────────────────────

  type ActivityRow = {
    key: string;
    date: string;
    label: string;
    sublabel: string;
    amount: number;
    sign: "+" | "-" | "=";
    source: "invoice" | "transaction" | "ecriture";
    href?: string;
  };

  const activity: ActivityRow[] = [
    ...invoices.slice(0, 15).map(inv => ({
      key: `inv-${inv.id}`,
      date: inv.issue_date,
      label: inv.invoice_number,
      sublabel: inv.clients?.name ?? "Client",
      amount: Number(inv.total),
      sign: "+" as const,
      source: "invoice" as const,
      href: `${base}/invoices/${inv.id}`,
    })),
    ...transactions.slice(0, 15).map(tx => ({
      key: `tx-${tx.id}`,
      date: tx.date,
      label: tx.description || tx.category || "Transaction",
      sublabel: tx.category ?? "",
      amount: Math.abs(Number(tx.amount)),
      sign: (tx.type === "income" ? "+" : "-") as "+" | "-",
      source: "transaction" as const,
    })),
    ...ecritures.slice(0, 10).map(e => ({
      key: `ecr-${e.id}`,
      date: e.date,
      label: e.libelle || "Écriture",
      sublabel: `${e.journal} · ${e.compte_cgnc ?? ""}`,
      amount: e.debit > 0 ? e.debit : e.credit,
      sign: "=" as const,
      source: "ecriture" as const,
    })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 12);

  const isEmpty = invoices.length === 0 && transactions.length === 0 && ecritures.length === 0;

  return (
    <div>
      {/* ── KPIs ─────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-5">
        <div className="kpi">
          <div className="kpi-label">Chiffre d'affaires</div>
          <div className="kpi-value" style={{ color: "#059669" }}>{fmt(ca)}</div>
          <div className="text-[11px] text-[#9CA3AF]">{invoices.filter(i => i.status !== "draft").length} factures</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Charges</div>
          <div className="kpi-value" style={{ color: "#DC2626" }}>{fmt(charges)}</div>
          <div className="text-[11px] text-[#9CA3AF]">{transactions.filter(t => t.type === "expense" || Number(t.amount) < 0).length} dépenses</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Résultat</div>
          <div className="kpi-value" style={{ color: resultat >= 0 ? "#059669" : "#DC2626" }}>{fmt(resultat)}</div>
          <div className="text-[11px] text-[#9CA3AF]">CA — Charges</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Trésorerie</div>
          <div className="kpi-value">{fmt(tresorerie)}</div>
          <div className="text-[11px] text-[#9CA3AF]">{transactions.length} transactions</div>
        </div>
      </div>

      {/* ── Quick actions ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-5">
        {[
          { href: `${base}/saisie`,       icon: PenLine,         label: "Saisie",      color: "#C8924A" },
          { href: `${base}/invoices`,     icon: FileText,        label: "Factures",    color: "#059669" },
          { href: `${base}/transactions`, icon: ArrowLeftRight,  label: "Transactions",color: "#7C3AED" },
          { href: `${base}/tva`,          icon: Calculator,      label: "TVA",         color: "#1D4ED8" },
          { href: `${base}/clients`,      icon: Wallet,          label: "Clients",     color: "#0891B2" },
          { href: `${base}/bilan`,        icon: TrendingUp,      label: "Bilan",       color: "#DB2777" },
        ].map(({ href, icon: Icon, label, color }) => (
          <Link key={href} href={href}
            className="flex flex-col items-center gap-1.5 py-3 px-2 bg-white border border-[rgba(0,0,0,0.07)] rounded-xl hover:border-[#C8924A]/50 hover:shadow-sm transition-all text-center group">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: `${color}18` }}>
              <Icon size={15} style={{ color }} />
            </div>
            <span className="text-[11px] font-medium text-[#374151] group-hover:text-[#C8924A] transition-colors leading-tight">{label}</span>
          </Link>
        ))}
      </div>

      {/* ── Recent activity ──────────────────────────────────────────────────── */}
      {isEmpty ? (
        <div className="text-center py-12 bg-white border border-[rgba(0,0,0,0.07)] rounded-xl">
          <FileText size={32} className="text-[#D1D5DB] mx-auto mb-3" />
          <p className="text-[13px] text-[#6B7280] mb-1">Aucune activité</p>
          <p className="text-[12px] text-[#9CA3AF] mb-4">Commencez par créer des factures ou saisir des transactions</p>
          <div className="flex gap-2 justify-center">
            <Link href={`${base}/invoices/new`} className="btn btn-gold btn-sm">+ Facture</Link>
            <Link href={`${base}/saisie`} className="btn btn-outline btn-sm">Saisie</Link>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-[rgba(0,0,0,0.07)] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[rgba(0,0,0,0.06)] bg-[#F9F9F6]">
            <span className="text-[12.5px] font-semibold text-[#1A1A2E]">Activité récente</span>
            <Link href={`${base}/saisie`} className="text-[11.5px] text-[#C8924A] hover:underline font-medium">
              Saisie comptable →
            </Link>
          </div>
          <div className="divide-y divide-[rgba(0,0,0,0.04)]">
            {activity.map((row) => (
              <div key={row.key} className="flex items-center gap-3 px-4 py-2.5">
                {/* Source badge */}
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  row.source === "invoice" ? "bg-[#059669]"
                  : row.source === "transaction" ? "bg-[#7C3AED]"
                  : "bg-[#C8924A]"
                }`} />

                <div className="flex-1 min-w-0">
                  {row.href ? (
                    <Link href={row.href} className="text-[12.5px] font-medium text-[#1A1A2E] hover:text-[#C8924A] transition-colors truncate block">
                      {row.label}
                    </Link>
                  ) : (
                    <span className="text-[12.5px] font-medium text-[#1A1A2E] truncate block">{row.label}</span>
                  )}
                  {row.sublabel && (
                    <span className="text-[11px] text-[#9CA3AF]">{row.sublabel}</span>
                  )}
                </div>

                <div className="text-right flex-shrink-0">
                  <div className={`text-[12.5px] font-semibold ${
                    row.sign === "+" ? "text-[#059669]"
                    : row.sign === "-" ? "text-[#DC2626]"
                    : "text-[#6B7280]"
                  }`}>
                    {row.sign !== "=" ? row.sign : ""}{row.amount > 0 ? row.amount.toLocaleString("fr-MA", { minimumFractionDigits: 2 }) : "—"}
                  </div>
                  <div className="text-[10.5px] text-[#9CA3AF]">{fmtDate(row.date)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
