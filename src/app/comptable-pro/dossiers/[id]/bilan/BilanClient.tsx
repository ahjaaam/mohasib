"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { BarChart3, ChevronLeft, ChevronRight, Printer, Mail, Info, CheckCircle2, AlertCircle, Scale } from "lucide-react";
import toast from "react-hot-toast";
import type { DossierEcriture } from "@/types/fiduciaire";
import { FEATURES } from "@/lib/features";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Invoice { id: string; issue_date: string; total: number; status: string; }
interface Tx      { id: string; date: string; amount: number; type: string; category: string | null; }

interface DossierProps {
  id: string; raison_sociale: string; forme_juridique: string;
  ice: string | null; rc: string | null; if_fiscal: string | null;
  capital_social: number; solde_banque_initial: number; solde_caisse_initial: number;
  dettes_fournisseurs_initiales: number; creances_clients_initiales: number;
  date_debut_exercice: string | null; contact_email: string | null;
}
interface CabinetProps {
  nom_cabinet: string | null; ice: string | null; rc: string | null;
  if_fiscal: string | null; email: string | null;
}

interface Props {
  dossier: DossierProps;
  ecritures: DossierEcriture[];
  invoices: Invoice[];
  transactions: Tx[];
  cabinet: CabinetProps | null;
}

// ─── Computed data structure ────────────────────────────────────────────────────

interface CD {
  v7111: number; v7121: number; v7131: number; v7141: number; v7188: number; tot_prod: number;
  c6111: number; c6121: number; c6132: number; c6141: number; c6142: number;
  c6144: number; c6147: number; c6161: number; c6171: number; c6174: number; c6182: number;
  tot_chg: number; res_exp: number;
  prod_fin: number; chg_fin: number; res_fin: number; res_net: number;
  b2340: number; b2350: number; b2410: number; tot_immob: number;
  b3421: number; b3455: number; b3491: number; tot_circ: number;
  b5141: number; b5161: number; tot_treso: number; tot_actif: number;
  capital: number; reserves: number; res_bilan: number; tot_fin_perm: number;
  p4411: number; p4455: number; p4481: number; p4491: number;
  tot_passif_circ: number; tot_passif: number;
}

// ─── Computation helpers ────────────────────────────────────────────────────────

const pos = (n: number) => Math.max(0, n);
function sumCr(ecrs: DossierEcriture[], prefix: string) {
  return ecrs.filter(e => e.compte_cgnc?.startsWith(prefix)).reduce((s, e) => s + e.credit - e.debit, 0);
}
function sumDr(ecrs: DossierEcriture[], prefix: string) {
  return ecrs.filter(e => e.compte_cgnc?.startsWith(prefix)).reduce((s, e) => s + e.debit - e.credit, 0);
}

function fromEcritures(ecritures: DossierEcriture[], s: string, e: string, d: DossierProps): CD {
  const p   = ecritures.filter(x => x.date >= s && x.date <= e);
  const all = ecritures.filter(x => x.date <= e);

  const v7111 = pos(sumCr(p, "7111")); const v7121 = pos(sumCr(p, "7121"));
  const v7131 = pos(sumCr(p, "7131")); const v7141 = pos(sumCr(p, "7141"));
  const v7188 = pos(sumCr(p, "7") - v7111 - v7121 - v7131 - v7141 - pos(sumCr(p, "731")));
  const tot_prod = v7111 + v7121 + v7131 + v7141 + v7188;

  const c6111 = pos(sumDr(p, "6111")); const c6121 = pos(sumDr(p, "6121"));
  const c6132 = pos(sumDr(p, "6132")); const c6141 = pos(sumDr(p, "6141"));
  const c6142 = pos(sumDr(p, "6142")); const c6144 = pos(sumDr(p, "6144"));
  const c6147 = pos(sumDr(p, "6147")); const c6161 = pos(sumDr(p, "6161"));
  const c6171 = pos(sumDr(p, "6171")); const c6174 = pos(sumDr(p, "6174"));
  const c6182 = pos(sumDr(p, "6") - c6111 - c6121 - c6132 - c6141 - c6142 - c6144 - c6147 - c6161 - c6171 - c6174 - pos(sumDr(p, "631")));
  const tot_chg = c6111 + c6121 + c6132 + c6141 + c6142 + c6144 + c6147 + c6161 + c6171 + c6174 + c6182;

  const res_exp = tot_prod - tot_chg;
  const prod_fin = pos(sumCr(p, "731")); const chg_fin = pos(sumDr(p, "631"));
  const res_fin = prod_fin - chg_fin;
  const res_net = res_exp + res_fin;

  const b2340 = pos(sumDr(all, "2340")); const b2350 = pos(sumDr(all, "2350"));
  const b2410 = pos(sumDr(all, "2410")); const tot_immob = b2340 + b2350 + b2410;
  const b3421 = pos(sumDr(all, "3421")) + (d.creances_clients_initiales ?? 0);
  const b3455 = pos(sumDr(all, "3455")); const b3491 = pos(sumDr(all, "3491"));
  const tot_circ = b3421 + b3455 + b3491;
  const b5141 = pos(sumDr(all, "5141")) + (d.solde_banque_initial ?? 0);
  const b5161 = pos(sumDr(all, "5161")) + (d.solde_caisse_initial ?? 0);
  const tot_treso = b5141 + b5161;
  const tot_actif = tot_immob + tot_circ + tot_treso;

  const reserves = pos(sumCr(all, "111"));
  const tot_fin_perm = (d.capital_social ?? 0) + reserves + res_net;
  const p4411 = pos(sumCr(all, "4411")) + (d.dettes_fournisseurs_initiales ?? 0);
  const p4455 = pos(sumCr(all, "4455")); const p4481 = pos(sumCr(all, "4481"));
  const p4491 = pos(sumCr(all, "4491")); const tot_passif_circ = p4411 + p4455 + p4481 + p4491;

  return {
    v7111, v7121, v7131, v7141, v7188, tot_prod,
    c6111, c6121, c6132, c6141, c6142, c6144, c6147, c6161, c6171, c6174, c6182, tot_chg,
    res_exp, prod_fin, chg_fin, res_fin, res_net,
    b2340, b2350, b2410, tot_immob, b3421, b3455, b3491, tot_circ,
    b5141, b5161, tot_treso, tot_actif,
    capital: d.capital_social ?? 0, reserves, res_bilan: res_net, tot_fin_perm,
    p4411, p4455, p4481, p4491, tot_passif_circ, tot_passif: tot_fin_perm + tot_passif_circ,
  };
}

function fromRawData(invoices: Invoice[], txs: Tx[], s: string, e: string, d: DossierProps): CD {
  const paidInv = invoices.filter(i =>
    (i.status === "paid" || i.status === "confirmed") && i.issue_date >= s && i.issue_date <= e,
  );
  const v7131 = paidInv.reduce((sum, i) => sum + Number(i.total), 0);
  const filtTx = txs.filter(t => t.date >= s && t.date <= e);
  const v7188 = filtTx.filter(t => t.type === "income" || Number(t.amount) > 0)
    .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
  const tot_prod = v7131 + v7188;
  const c6182 = filtTx.filter(t => t.type === "expense" || Number(t.amount) < 0)
    .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
  const tot_chg = c6182;
  const res_exp = tot_prod - tot_chg;
  const res_net = res_exp;

  const allTx = txs.filter(t => t.date <= e);
  const netTx = allTx.reduce((sum, t) => {
    const a = Number(t.amount);
    return sum + (t.type === "income" || a > 0 ? Math.abs(a) : -Math.abs(a));
  }, 0);
  const b5141 = pos((d.solde_banque_initial ?? 0) + netTx);
  const b5161 = pos(d.solde_caisse_initial ?? 0);
  const tot_treso = b5141 + b5161;
  const unpaid = invoices.filter(i => i.status !== "paid" && i.status !== "cancelled");
  const b3421 = unpaid.reduce((sum, i) => sum + Number(i.total), 0) + (d.creances_clients_initiales ?? 0);
  const tot_circ = b3421;
  const tot_actif = tot_circ + tot_treso;
  const tot_fin_perm = (d.capital_social ?? 0) + res_net;
  const p4411 = d.dettes_fournisseurs_initiales ?? 0;

  return {
    v7111: 0, v7121: 0, v7131, v7141: 0, v7188, tot_prod,
    c6111: 0, c6121: 0, c6132: 0, c6141: 0, c6142: 0, c6144: 0,
    c6147: 0, c6161: 0, c6171: 0, c6174: 0, c6182, tot_chg,
    res_exp, prod_fin: 0, chg_fin: 0, res_fin: 0, res_net,
    b2340: 0, b2350: 0, b2410: 0, tot_immob: 0,
    b3421, b3455: 0, b3491: 0, tot_circ,
    b5141, b5161, tot_treso, tot_actif,
    capital: d.capital_social ?? 0, reserves: 0, res_bilan: res_net, tot_fin_perm,
    p4411, p4455: 0, p4481: 0, p4491: 0, tot_passif_circ: p4411,
    tot_passif: tot_fin_perm + p4411,
  };
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function BilanClient({ dossier, ecritures, invoices, transactions, cabinet }: Props) {
  const now = new Date().getFullYear();
  const [year, setYear]           = useState(now);
  const [tab, setTab]             = useState<"cpc" | "bilan">("cpc");
  const [compareN1, setCompareN1] = useState(false);
  const [sending, setSending]     = useState(false);

  const s0 = `${year}-01-01`;
  const e0 = year === now ? new Date().toISOString().slice(0, 10) : `${year}-12-31`;
  const s1 = `${year - 1}-01-01`;
  const e1 = `${year - 1}-12-31`;

  const hasEcr  = useMemo(() => ecritures.some(e => e.date >= s0 && e.date <= e0), [ecritures, s0, e0]);
  const hasPrev = useMemo(() => ecritures.some(e => e.date >= s1 && e.date <= e1), [ecritures, s1, e1]);

  const cur = useMemo(
    () => hasEcr
      ? fromEcritures(ecritures, s0, e0, dossier)
      : fromRawData(invoices, transactions, s0, e0, dossier),
    [hasEcr, ecritures, invoices, transactions, s0, e0, dossier],
  );

  const prev: CD | null = useMemo(() => {
    if (!compareN1) return null;
    return hasPrev
      ? fromEcritures(ecritures, s1, e1, dossier)
      : fromRawData(invoices, transactions, s1, e1, dossier);
  }, [compareN1, hasPrev, ecritures, invoices, transactions, s1, e1, dossier]);

  // Quality metrics
  const paidCnt = invoices.filter(i =>
    (i.status === "paid" || i.status === "confirmed") && i.issue_date >= s0 && i.issue_date <= e0,
  ).length;
  const txCnt  = transactions.filter(t => t.date >= s0 && t.date <= e0).length;
  const ecrCnt = ecritures.filter(e => e.date >= s0 && e.date <= e0).length;
  const coverage = ecrCnt > 10 ? 95 : ecrCnt > 0 ? 70 : paidCnt > 0 || txCnt > 0 ? 45 : 0;
  const isEmpty = cur.tot_actif === 0 && cur.res_net === 0 && paidCnt === 0 && txCnt === 0 && ecrCnt === 0;

  const showPrev = compareN1 && prev !== null;
  const cols = showPrev ? 4 : 2;

  // ── Formatting
  function fmt(n: number)  { return n === 0 ? "—" : n.toLocaleString("fr-MA", { minimumFractionDigits: 2 }) + " MAD"; }
  function fmtA(n: number) { return n.toLocaleString("fr-MA", { minimumFractionDigits: 2 }) + " MAD"; }

  // ── Table helpers (use closure for showPrev / cols)
  function secHdr(label: string) {
    return (
      <tr className="bg-[#F3F4F6]">
        <td colSpan={cols} className="text-[10.5px] font-bold uppercase tracking-wider py-2 pl-2 text-[#6B7280]">
          {label}
        </td>
      </tr>
    );
  }

  function row(label: string, val: number, pv?: number, indent = false) {
    const pct = showPrev && pv != null && pv !== 0
      ? Math.round(((val - pv) / Math.abs(pv)) * 100) : null;
    return (
      <tr>
        <td className={`text-[12px] text-[#374151] ${indent ? "pl-6" : ""}`}>{label}</td>
        <td className="text-right text-[12.5px] font-medium text-[#1A1A2E] tabular-nums pr-1 w-[130px]">{fmt(val)}</td>
        {showPrev && <td className="text-right text-[12px] text-[#9CA3AF] tabular-nums pr-1 w-[130px]">{pv != null ? fmt(pv) : "—"}</td>}
        {showPrev && (
          <td className="text-right text-[11px] w-[52px] pr-1 text-[#6B7280]">
            {pct != null ? `${pct > 0 ? "+" : ""}${pct}%` : ""}
          </td>
        )}
      </tr>
    );
  }

  function totRow(label: string, val: number, pv?: number) {
    return (
      <tr className="bg-[#F3F4F6]">
        <td className="text-[12.5px] font-bold text-[#1A1A2E] py-1.5">{label}</td>
        <td className="text-right font-bold text-[13px] text-[#1A1A2E] tabular-nums pr-1 py-1.5">{fmtA(val)}</td>
        {showPrev && <td className="text-right font-bold text-[12.5px] text-[#9CA3AF] tabular-nums pr-1">{pv != null ? fmtA(pv) : "—"}</td>}
        {showPrev && <td />}
      </tr>
    );
  }

  function resRow(label: string, val: number, pv?: number) {
    return (
      <tr className="bg-[#EFEFEF]">
        <td className="font-bold text-[13px] text-[#1A1A2E] py-2.5">{label}</td>
        <td className="text-right font-bold text-[14px] text-[#1A1A2E] tabular-nums pr-1 py-2.5">{fmtA(val)}</td>
        {showPrev && <td className="text-right font-bold text-[14px] text-[#9CA3AF] tabular-nums pr-1">{pv != null ? fmtA(pv) : "—"}</td>}
        {showPrev && <td />}
      </tr>
    );
  }

  function tHead() {
    return (
      <thead>
        <tr className="bg-[#F3F4F6]">
          <th className="text-left text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Libellé</th>
          <th className="text-right text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider pr-1 w-[130px]">{year}</th>
          {showPrev && <th className="text-right text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider pr-1 w-[130px]">{year - 1}</th>}
          {showPrev && <th className="text-right text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider pr-1 w-[52px]">Var.</th>}
        </tr>
      </thead>
    );
  }

  // ── Empty state
  if (isEmpty) {
    return (
      <div className="max-w-lg mx-auto mt-10">
        <div className="card p-8 text-center">
          <BarChart3 size={44} className="mx-auto mb-4 text-[#9CA3AF]" aria-hidden="true" />
          <h2 className="text-[17px] font-bold text-[#1A1A2E] mb-2">Aucune donnée pour {year}</h2>
          <p className="text-[13px] text-[#6B7280] mb-5 leading-relaxed">
            Pour générer votre bilan, commencez par alimenter le dossier.
          </p>
          <ul className="text-left text-[12.5px] text-[#374151] space-y-1.5 mb-6">
            <li>→ Importez un relevé bancaire</li>
            <li>→ Confirmez des factures clients</li>
          </ul>
          <div className="flex gap-2 justify-center">
            <Link href={`/comptable-pro/dossiers/${dossier.id}/transactions`} className="btn btn-gold btn-sm">
              Importer un relevé
            </Link>
            <Link
              href={
                FEATURES.SAISIE_ENABLED
                  ? `/comptable-pro/dossiers/${dossier.id}/saisie`
                  : `/comptable-pro/dossiers/${dossier.id}/ecritures`
              }
              className="btn btn-outline btn-sm"
            >
              {FEATURES.SAISIE_ENABLED ? "Saisie comptable" : "Voir les écritures"}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Send to client
  async function sendToClient() {
    if (!dossier.contact_email) {
      toast.error("Aucun email de contact configuré dans le dossier");
      return;
    }
    setSending(true);
    const subj = `Bilan & CPC — ${dossier.raison_sociale} — Exercice ${year}`;
    const body = [
      `Bonjour,`,
      ``,
      `Veuillez trouver ci-joint le Bilan et CPC de ${dossier.raison_sociale} pour l'exercice ${year}.`,
      ``,
      `Résultats clés :`,
      `- Chiffre d'affaires : ${fmtA(cur.tot_prod)}`,
      `- Résultat net       : ${fmtA(cur.res_net)}`,
      `- Trésorerie nette   : ${fmtA(cur.tot_treso)}`,
      ``,
      `Cordialement,`,
      cabinet?.nom_cabinet ?? "Votre cabinet",
    ].join("\n");
    window.open(`mailto:${dossier.contact_email}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`);
    setSending(false);
  }

  // ── Render
  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5 mb-5">
        {/* CPC / Bilan tabs */}
        <div className="flex items-center gap-1 bg-[#F3F4F6] p-1 rounded-xl">
          {(["cpc", "bilan"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${tab === t ? "bg-white text-[#1A1A2E] shadow-sm" : "text-[#6B7280] hover:text-[#1A1A2E]"}`}>
              <span className="inline-flex items-center gap-1.5">{t === "cpc" ? <><BarChart3 size={13} /> CPC</> : <><Scale size={13} /> Bilan</>}</span>
            </button>
          ))}
        </div>

        {/* Year navigator */}
        <div className="flex items-center gap-0.5 bg-white border border-[rgba(0,0,0,0.08)] rounded-xl px-1">
          <button onClick={() => setYear(y => y - 1)}
            className="p-1.5 rounded-lg hover:bg-[#F3F4F6] transition-colors">
            <ChevronLeft size={14} />
          </button>
          <span className="text-[13px] font-semibold text-[#1A1A2E] px-2 select-none">Exercice {year}</span>
          <button onClick={() => setYear(y => Math.min(y + 1, now))} disabled={year >= now}
            className="p-1.5 rounded-lg hover:bg-[#F3F4F6] transition-colors disabled:opacity-30">
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Compare N-1 */}
        <button onClick={() => setCompareN1(v => !v)}
          className={`px-3 py-1.5 rounded-xl text-[12px] font-medium border transition-all ${compareN1 ? "bg-[#0D1526] text-white border-[#0D1526]" : "bg-white text-[#374151] border-[rgba(0,0,0,0.08)] hover:border-[#C8924A]"}`}>
          Comparer N-1
        </button>

        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => window.print()}
            className="btn btn-outline btn-sm flex items-center gap-1.5">
            <Printer size={13} /> PDF
          </button>
          <button onClick={sendToClient} disabled={sending || !dossier.contact_email}
            title={!dossier.contact_email ? "Aucun email de contact dans le dossier" : undefined}
            className="btn btn-gold btn-sm flex items-center gap-1.5 disabled:opacity-40">
            <Mail size={13} /> {sending ? "…" : "Envoyer"}
          </button>
        </div>
      </div>

      {/* Data quality */}
      <div className="card p-4 mb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[10.5px] text-[#9CA3AF] uppercase tracking-wider mb-1.5">Données basées sur</div>
            <div className="flex flex-wrap gap-4">
              <span className={`flex items-center gap-1.5 text-[12px] ${paidCnt > 0 ? "text-[#059669]" : "text-[#9CA3AF]"}`}>
                {paidCnt > 0 ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                {paidCnt} facture{paidCnt !== 1 ? "s" : ""} confirmée{paidCnt !== 1 ? "s" : ""}
              </span>
              <span className={`flex items-center gap-1.5 text-[12px] ${txCnt > 0 ? "text-[#059669]" : "text-[#9CA3AF]"}`}>
                {txCnt > 0 ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                {txCnt} transaction{txCnt !== 1 ? "s" : ""}
              </span>
              <span className={`flex items-center gap-1.5 text-[12px] ${ecrCnt > 0 ? "text-[#059669]" : "text-[#D97706]"}`}>
                {ecrCnt > 0 ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                {ecrCnt} écriture{ecrCnt !== 1 ? "s" : ""} manuelle{ecrCnt !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
          <div className="text-center">
            <div className="text-[10.5px] text-[#9CA3AF] uppercase tracking-wider mb-0.5">Couverture</div>
            <div className={`text-[22px] font-bold leading-none ${coverage >= 80 ? "text-[#059669]" : coverage >= 50 ? "text-[#D97706]" : "text-[#DC2626]"}`}>
              {coverage}%
            </div>
          </div>
        </div>
      </div>

      {/* Accuracy notice — always shown: automatic entries only, no manual OD adjustments */}
      <div className="flex items-start gap-2.5 mb-5 p-3.5 rounded-xl bg-[#FFFBEB] border border-[#FCD34D]">
        <Info size={15} className="text-[#D97706] flex-shrink-0 mt-0.5" />
        <p className="text-[12px] text-[#92400E] leading-relaxed">
          Ces états sont générés à partir des écritures automatiques (ventes, achats, banque).
          Les opérations diverses (amortissements, provisions) sont finalisées par votre comptable dans son logiciel.
        </p>
      </div>

      {/* ── CPC ──────────────────────────────────────────────────────────────── */}
      {tab === "cpc" && (
        <div className="tbl">
          <div className="tbl-header">
            <span className="tbl-title">Compte de Produits et Charges — Exercice {year}</span>
          </div>
          <table>
            {tHead()}
            <tbody>
              {secHdr("Produits d'exploitation")}
              {row("7111 — Ventes de marchandises", cur.v7111, prev?.v7111, true)}
              {row("7121 — Ventes de biens produits", cur.v7121, prev?.v7121, true)}
              {row("7131 — Prestations de services", cur.v7131, prev?.v7131, true)}
              {row("7141 — Travaux facturés", cur.v7141, prev?.v7141, true)}
              {cur.v7188 > 0 && row("7188 — Autres produits d'exploitation", cur.v7188, prev?.v7188, true)}
              {totRow("TOTAL PRODUITS D'EXPLOITATION", cur.tot_prod, prev?.tot_prod)}

              {secHdr("Charges d'exploitation")}
              {cur.c6111 > 0 && row("6111 — Achats revendus de marchandises", cur.c6111, prev?.c6111, true)}
              {cur.c6121 > 0 && row("6121 — Achats consommés de matières", cur.c6121, prev?.c6121, true)}
              {cur.c6132 > 0 && row("6132 — Locations et charges locatives", cur.c6132, prev?.c6132, true)}
              {cur.c6141 > 0 && row("6141 — Études et recherches", cur.c6141, prev?.c6141, true)}
              {cur.c6142 > 0 && row("6142 — Transports", cur.c6142, prev?.c6142, true)}
              {cur.c6144 > 0 && row("6144 — Publicité et marketing", cur.c6144, prev?.c6144, true)}
              {cur.c6147 > 0 && row("6147 — Télécommunications", cur.c6147, prev?.c6147, true)}
              {cur.c6161 > 0 && row("6161 — Impôts et taxes", cur.c6161, prev?.c6161, true)}
              {cur.c6171 > 0 && row("6171 — Rémunérations du personnel", cur.c6171, prev?.c6171, true)}
              {cur.c6174 > 0 && row("6174 — Charges sociales", cur.c6174, prev?.c6174, true)}
              {cur.c6182 > 0 && row("6182 — Charges diverses", cur.c6182, prev?.c6182, true)}
              {totRow("TOTAL CHARGES D'EXPLOITATION", cur.tot_chg, prev?.tot_chg)}

              {resRow("RÉSULTAT D'EXPLOITATION", cur.res_exp, prev?.res_exp)}

              {(cur.prod_fin > 0 || cur.chg_fin > 0) && <>
                {secHdr("Résultat financier")}
                {row("7311 — Intérêts et produits financiers", cur.prod_fin, prev?.prod_fin, true)}
                {row("6311 — Intérêts des emprunts", cur.chg_fin, prev?.chg_fin, true)}
                {totRow("RÉSULTAT FINANCIER", cur.res_fin, prev?.res_fin)}
              </>}

              {resRow("RÉSULTAT NET DE L'EXERCICE", cur.res_net, prev?.res_net)}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Bilan ─────────────────────────────────────────────────────────────── */}
      {tab === "bilan" && (
        <>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* ACTIF */}
          <div className="tbl">
            <div className="tbl-header"><span className="tbl-title">ACTIF — {year}</span></div>
            <table>
              {tHead()}
              <tbody>
                {secHdr("Actif immobilisé")}
                {row("2340 — Matériel de bureau", cur.b2340, prev?.b2340, true)}
                {row("2350 — Matériel informatique", cur.b2350, prev?.b2350, true)}
                {row("2410 — Mobilier et agencements", cur.b2410, prev?.b2410, true)}
                {totRow("Total actif immobilisé", cur.tot_immob, prev?.tot_immob)}

                {secHdr("Actif circulant")}
                {row("3421 — Clients et comptes rattachés", cur.b3421, prev?.b3421, true)}
                {row("3455 — État TVA récupérable", cur.b3455, prev?.b3455, true)}
                {cur.b3491 > 0 && row("3491 — Autres débiteurs", cur.b3491, prev?.b3491, true)}
                {totRow("Total actif circulant", cur.tot_circ, prev?.tot_circ)}

                {secHdr("Trésorerie — Actif")}
                {row("5141 — Banques", cur.b5141, prev?.b5141, true)}
                {row("5161 — Caisse", cur.b5161, prev?.b5161, true)}
                {totRow("Total trésorerie", cur.tot_treso, prev?.tot_treso)}

                {totRow("TOTAL ACTIF", cur.tot_actif, prev?.tot_actif)}
              </tbody>
            </table>
          </div>

          {/* PASSIF */}
          <div className="tbl">
            <div className="tbl-header"><span className="tbl-title">PASSIF — {year}</span></div>
            <table>
              {tHead()}
              <tbody>
                {secHdr("Financement permanent")}
                {row("Capital social", cur.capital, prev?.capital, true)}
                {row("Réserves et report à nouveau (111x)", cur.reserves, prev?.reserves, true)}
                {row(`Résultat net ${year}`, cur.res_bilan, prev?.res_bilan, true)}
                {totRow("Total financement permanent", cur.tot_fin_perm, prev?.tot_fin_perm)}

                {secHdr("Passif circulant")}
                {row("4411 — Fournisseurs", cur.p4411, prev?.p4411, true)}
                {row("4455 — État TVA facturée", cur.p4455, prev?.p4455, true)}
                {cur.p4481 > 0 && row("4481 — Organismes sociaux (CNSS)", cur.p4481, prev?.p4481, true)}
                {cur.p4491 > 0 && row("4491 — Autres créditeurs", cur.p4491, prev?.p4491, true)}
                {totRow("Total passif circulant", cur.tot_passif_circ, prev?.tot_passif_circ)}

                {totRow("TOTAL PASSIF", cur.tot_passif, prev?.tot_passif)}
              </tbody>
            </table>
          </div>
        </div>

        {/* Balance check — below the two-column grid */}
        <div className={`mt-3 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-[12.5px] font-semibold text-center border ${
          Math.abs(cur.tot_actif - cur.tot_passif) < 1
            ? "bg-[#F0FDF4] border-[#BBF7D0] text-[#16A34A]"
            : "bg-[#FFF7ED] border-[#FED7AA] text-[#EA580C]"
        }`}>
          {Math.abs(cur.tot_actif - cur.tot_passif) < 1
            ? <><CheckCircle2 size={15} aria-hidden="true" /> Bilan équilibré — Actif = Passif</>
            : <><AlertCircle size={15} aria-hidden="true" /> Écart de {fmtA(Math.abs(cur.tot_actif - cur.tot_passif))} — Actif ≠ Passif</>}
        </div>
        </>
      )}

      {/* Print styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          aside, nav, header, .btn, button, [class*="toolbar"] { display: none !important; }
          .tbl { box-shadow: none !important; border: 1px solid #e5e7eb !important; break-inside: avoid; }
          body { background: white !important; }
        }
      `}} />
    </div>
  );
}
