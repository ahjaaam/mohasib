"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeftRight,
  Calculator,
  CheckCircle2,
  FileArchive,
  FileText,
  Landmark,
  Mail,
  PenLine,
  ReceiptText,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type { DossierEcriture } from "@/types/fiduciaire";

function fmt(n: number) {
  return n.toLocaleString("fr-MA", { minimumFractionDigits: 2 }) + " MAD";
}

function fmtShort(n: number) {
  return n.toLocaleString("fr-MA", { maximumFractionDigits: 0 }) + " MAD";
}

function fmtDate(d?: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("fr-MA", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return d;
  }
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <div className="h-4 w-[3px] flex-shrink-0 rounded-full bg-[#C8924A]" />
      <span className="text-[11px] font-semibold uppercase tracking-[1px] text-[#6B7280]">{children}</span>
    </div>
  );
}

interface Props {
  dossier: {
    id: string;
    raison_sociale: string;
    ice?: string | null;
    if_fiscal?: string | null;
    rc?: string | null;
    cnss?: string | null;
    regime_tva?: string | null;
    contact_email?: string | null;
    contact_phone?: string | null;
    date_debut_exercice?: string | null;
    derniere_ecriture?: string | null;
    solde_banque_initial: number;
    solde_caisse_initial: number;
    capital_social: number;
    dettes_fournisseurs_initiales: number;
    creances_clients_initiales?: number | null;
  };
  ecritures: DossierEcriture[];
  invoices: Array<{
    id: string;
    invoice_number: string;
    issue_date: string;
    subtotal?: number | string | null;
    tax_amount?: number | string | null;
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
  const activeInvoices = invoices.filter(i => i.status !== "draft");
  const expenseTx = transactions.filter(t => t.type === "expense" || Number(t.amount) < 0);
  const incomeTx = transactions.filter(t => t.type === "income" || Number(t.amount) > 0);

  const ca = activeInvoices.reduce((s, i) => s + Number(i.total ?? 0), 0);
  const charges = expenseTx.reduce((s, t) => s + Math.abs(Number(t.amount ?? 0)), 0);
  const resultat = ca - charges;
  const txNet = transactions.reduce((s, t) => s + (t.type === "income" ? Number(t.amount) : -Math.abs(Number(t.amount))), 0);
  const tresorerie = txNet + Number(dossier.solde_banque_initial ?? 0) + Number(dossier.solde_caisse_initial ?? 0);
  const tvaCollectee = activeInvoices.reduce((s, i) => s + Number(i.tax_amount ?? 0), 0);
  const fournisseursAPayer = charges + Number(dossier.dettes_fournisseurs_initiales ?? 0);
  const clientsARecevoir = ca + Number(dossier.creances_clients_initiales ?? 0);
  const lastActivity = [dossier.derniere_ecriture, invoices[0]?.issue_date, transactions[0]?.date, ecritures[0]?.date].filter(Boolean).sort().at(-1) ?? null;
  const hasRecentWork = lastActivity ? Date.now() - new Date(lastActivity).getTime() <= 30 * 86_400_000 : false;
  const regimeTva = (dossier.regime_tva ?? "mensuel").toLowerCase();

  const identityItems = [
    { label: "ICE", value: dossier.ice },
    { label: "IF", value: dossier.if_fiscal },
    { label: "RC", value: dossier.rc },
    { label: "CNSS", value: dossier.cnss },
  ];
  const completedIdentity = identityItems.filter(item => item.value).length;
  const setupItems = [
    { label: "Identité légale", done: completedIdentity >= 3 },
    { label: "Régime TVA", done: Boolean(dossier.regime_tva) },
    { label: "Solde initial", done: Number(dossier.solde_banque_initial ?? 0) !== 0 || Number(dossier.solde_caisse_initial ?? 0) !== 0 },
    { label: "Écritures", done: ecritures.length > 0 },
    { label: "Activité récente", done: hasRecentWork },
  ];

  const todoItems = [
    !hasRecentWork ? { title: "Mettre à jour le dossier", detail: "Aucune activité récente détectée", href: `${base}/saisie` } : null,
    tvaCollectee > 0 ? { title: "Préparer la TVA", detail: `${fmtShort(tvaCollectee)} de TVA collectée à vérifier`, href: `${base}/tva` } : null,
    ecritures.length === 0 ? { title: "Démarrer la saisie comptable", detail: "Aucune écriture comptable dans ce dossier", href: `${base}/saisie` } : null,
    completedIdentity < 3 ? { title: "Compléter l’identité légale", detail: "ICE, IF, RC ou CNSS manquant", href: `${base}/edit` } : null,
  ].filter(Boolean).slice(0, 4) as Array<{ title: string; detail: string; href: string }>;

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
      sublabel: inv.clients?.name ?? "Facture client",
      amount: Number(inv.total),
      sign: "+" as const,
      source: "invoice" as const,
      href: `${base}/invoices/${inv.id}`,
    })),
    ...transactions.slice(0, 15).map(tx => ({
      key: `tx-${tx.id}`,
      date: tx.date,
      label: tx.description || tx.category || "Transaction",
      sublabel: tx.category ?? "Transaction bancaire",
      amount: Math.abs(Number(tx.amount)),
      sign: (tx.type === "income" ? "+" : "-") as "+" | "-",
      source: "transaction" as const,
    })),
    ...ecritures.slice(0, 10).map(e => ({
      key: `ecr-${e.id}`,
      date: e.date,
      label: e.libelle || "Écriture comptable",
      sublabel: `${e.journal} · ${e.compte_cgnc ?? "CGNC"}`,
      amount: Number(e.debit) > 0 ? Number(e.debit) : Number(e.credit),
      sign: "=" as const,
      source: "ecriture" as const,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);

  const kpis = [
    { label: "CA dossier", value: fmt(ca), sub: `${activeInvoices.length} facture${activeInvoices.length > 1 ? "s" : ""}`, icon: TrendingUp, tone: "green" },
    { label: "Charges", value: fmt(charges), sub: `${expenseTx.length} dépense${expenseTx.length > 1 ? "s" : ""}`, icon: TrendingDown, tone: "red" },
    { label: "TVA collectée", value: fmt(tvaCollectee), sub: `Régime ${regimeTva}`, icon: Calculator, tone: "blue" },
    { label: "Résultat estimé", value: fmt(resultat), sub: "CA — charges", icon: Landmark, tone: resultat >= 0 ? "green" : "red" },
    { label: "Trésorerie", value: fmt(tresorerie), sub: `${transactions.length} transaction${transactions.length > 1 ? "s" : ""}`, icon: Wallet, tone: "gold" },
    { label: "Clients à encaisser", value: fmt(clientsARecevoir), sub: "Factures + créances initiales", icon: ReceiptText, tone: "purple" },
  ];

  const workflows = [
    { href: `${base}/inbox`, icon: Mail, title: "Boîte de réception", text: "Traiter les factures envoyées à l’adresse dédiée", meta: "OCR & classement" },
    { href: `${base}/saisie`, icon: PenLine, title: "Saisie comptable", text: "Vérifier et compléter les écritures du dossier", meta: `${ecritures.length} écritures` },
    { href: `${base}/tva`, icon: Calculator, title: "Déclaration TVA", text: "Préparer la déclaration et exporter l’EDI XML", meta: fmtShort(tvaCollectee) },
    { href: `${base}/bilan`, icon: TrendingUp, title: "Bilan & CPC", text: "Générer les états financiers du client", meta: "Automatique" },
    { href: `${base}/transactions`, icon: ArrowLeftRight, title: "Transactions", text: "Contrôler les mouvements et le rapprochement", meta: `${incomeTx.length + expenseTx.length} lignes` },
    { href: `${base}/export`, icon: FileArchive, title: "Export CGNC", text: "Préparer le package de travail et les exports", meta: "Cabinet" },
  ];

  const isEmpty = invoices.length === 0 && transactions.length === 0 && ecritures.length === 0;

  return (
    <div>
      <section className="mb-8">
        <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-6">
          {kpis.map(({ label, value, sub, icon: Icon, tone }) => (
            <div key={label} className="kpi p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="kpi-label mb-2">{label}</div>
                  <div className="truncate text-[20px] font-bold leading-none text-[#1A1A2E]">{value}</div>
                </div>
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                  tone === "green" ? "bg-[#D1FAE5] text-[#059669]"
                  : tone === "red" ? "bg-[#FEE2E2] text-[#DC2626]"
                  : tone === "blue" ? "bg-[#DBEAFE] text-[#1D4ED8]"
                  : tone === "purple" ? "bg-[#EDE9FE] text-[#7C3AED]"
                  : "bg-[#FFF7ED] text-[#C8924A]"
                }`}>
                  <Icon size={16} />
                </span>
              </div>
              <p className="mt-2 text-[11px] text-[#6B7280]">{sub}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8 grid gap-7 xl:grid-cols-[1fr_360px]">
        <div>
          <SectionLabel>À faire maintenant</SectionLabel>
          <div className="card p-4">
            {todoItems.length === 0 ? (
              <div className="flex min-h-[88px] items-center justify-center rounded-xl border border-dashed border-[rgba(0,0,0,0.12)] bg-[#FAFAF6] px-4 py-5 text-center">
                <div>
                  <CheckCircle2 size={18} className="mx-auto text-[#059669]" />
                  <p className="mt-2 text-[12.5px] font-semibold text-[#6B7280]">Rien à faire pour le moment</p>
                  <p className="mt-0.5 text-[11px] text-[#9CA3AF]">Aucune action urgente détectée.</p>
                </div>
              </div>
            ) : (
              <div className="grid gap-2 md:grid-cols-2">
                {todoItems.map(item => (
                  <Link key={item.title} href={item.href} className="group rounded-xl border border-[rgba(13,21,38,0.08)] bg-[#FAFAF6] p-4 transition hover:border-[#C8924A]/50 hover:bg-[#FFF7ED]">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-[#FEF3C7] text-[#D97706]">
                        <AlertTriangle size={15} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[13px] font-bold text-[#0D1526] group-hover:text-[#9A672E]">{item.title}</span>
                        <span className="mt-1 block text-[11.5px] leading-5 text-[#6B7280]">{item.detail}</span>
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <SectionLabel>Résumé opérationnel</SectionLabel>
          <div className="card p-3">
            <div className="space-y-1.5">
              <div className="rounded-lg bg-[#FAFAF6] px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.5px] text-[#6B7280]">Fournisseurs à payer</p>
                <p className="mt-0.5 text-[15px] font-bold text-[#DC2626]">{fmt(fournisseursAPayer)}</p>
              </div>
              <div className="rounded-lg bg-[#FAFAF6] px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.5px] text-[#6B7280]">Capital social</p>
                <p className="mt-0.5 text-[15px] font-bold text-[#0D1526]">{fmt(Number(dossier.capital_social ?? 0))}</p>
              </div>
              <div className="rounded-lg bg-[#FAFAF6] px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.5px] text-[#6B7280]">Contact client</p>
                <p className="mt-0.5 truncate text-[12px] font-semibold text-[#0D1526]">{dossier.contact_email || dossier.contact_phone || "À compléter"}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <SectionLabel>Modules de travail</SectionLabel>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {workflows.map(({ href, icon: Icon, title, text, meta }) => (
            <Link key={href} href={href} className="client-card group">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF7ED] text-[#C8924A]">
                  <Icon size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-bold text-[#0D1526] group-hover:text-[#9A672E]">{title}</span>
                  <span className="mt-1 block text-[11.5px] leading-5 text-[#6B7280]">{text}</span>
                  <span className="mt-3 inline-flex rounded-full bg-[#FAFAF6] px-2.5 py-1 text-[10.5px] font-bold text-[#9A672E]">{meta}</span>
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-7 xl:grid-cols-[1fr_360px]">
        <div>
          <div className="flex items-start justify-between gap-3">
            <SectionLabel>Activité récente</SectionLabel>
            <Link href={`${base}/saisie`} className="mt-0.5 text-[11.5px] font-medium text-[#C8924A] hover:underline">Voir la saisie →</Link>
          </div>
          <div className="card overflow-hidden">
            {isEmpty ? (
              <div className="px-4 py-12 text-center">
                <FileText size={30} className="text-[#D1D5DB] mx-auto mb-3" />
                <p className="text-[13px] font-semibold text-[#6B7280]">Aucune activité</p>
                <p className="mt-1 text-[12px] text-[#9CA3AF]">Commencez par créer une facture ou saisir une écriture.</p>
              </div>
            ) : (
              <div className="divide-y divide-[rgba(0,0,0,0.04)]">
                {activity.map((row) => (
                  <div key={row.key} className="flex items-center gap-3 px-4 py-3">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                      row.source === "invoice" ? "bg-[#D1FAE5] text-[#059669]"
                      : row.source === "transaction" ? "bg-[#EDE9FE] text-[#7C3AED]"
                      : "bg-[#FFF7ED] text-[#C8924A]"
                    }`}>
                      {row.source === "invoice" ? <ReceiptText size={14} /> : row.source === "transaction" ? <ArrowLeftRight size={14} /> : <PenLine size={14} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      {row.href ? (
                        <Link href={row.href} className="block truncate text-[12.5px] font-semibold text-[#1A1A2E] hover:text-[#C8924A]">{row.label}</Link>
                      ) : (
                        <span className="block truncate text-[12.5px] font-semibold text-[#1A1A2E]">{row.label}</span>
                      )}
                      <span className="mt-0.5 block truncate text-[11px] text-[#9CA3AF]">{row.sublabel}</span>
                    </div>
                    <div className="text-right">
                      <div className={`text-[12.5px] font-bold ${row.sign === "+" ? "text-[#059669]" : row.sign === "-" ? "text-[#DC2626]" : "text-[#6B7280]"}`}>
                        {row.sign !== "=" ? row.sign : ""}{row.amount > 0 ? row.amount.toLocaleString("fr-MA", { minimumFractionDigits: 2 }) : "—"}
                      </div>
                      <div className="text-[10.5px] text-[#9CA3AF]">{fmtDate(row.date)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <SectionLabel>Santé du dossier</SectionLabel>
          <div className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="kpi-label mb-2">Points complétés</div>
                <p className="text-[24px] font-bold leading-none text-[#0D1526]">{setupItems.filter(item => item.done).length}/{setupItems.length}</p>
              </div>
              <Link href={`${base}/edit`} className="btn btn-outline text-[11px]">
                Configurer
              </Link>
            </div>
            <div className="mt-4 space-y-2">
              {setupItems.map(item => (
                <div key={item.label} className="flex items-center justify-between gap-3 rounded-lg bg-[#FAFAF6] px-3 py-2">
                  <span className="text-[12px] text-[#6B7280]">{item.label}</span>
                  {item.done ? <CheckCircle2 size={15} className="text-[#34D399]" /> : <AlertTriangle size={15} className="text-[#FBBF24]" />}
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-xl bg-[#FFF7ED] px-3 py-2 text-[11.5px] text-[#9A672E]">
              Dernière activité : <span className="font-semibold text-[#0D1526]">{fmtDate(lastActivity)}</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
