"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { BookOpen, Filter, Download } from "lucide-react";
import { getAccountLabel, getAccountClass, getAccountClassName } from "@/lib/cgnc-mapping";

// ── Types ─────────────────────────────────────────────────────────────────────

interface EcritureRow {
  id: string;
  date_ecriture: string;
  numero_piece: string | null;
  journal: string;
  libelle: string | null;
  debit: number;
  credit: number;
  lettre: string | null;
  is_lettered: boolean;
  compte: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n === 0) return "—";
  return n.toLocaleString("fr-MA", { minimumFractionDigits: 2 }) + " MAD";
}

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("fr-MA", {
    day: "2-digit", month: "2-digit", year: "2-digit",
  });
}

const JOURNALS = ["Tous", "VT", "AC", "BQ", "CA", "OD"];

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  companyId?: string | null;
  dossierId?: string | null;
  title?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function GrandLivreView({ companyId, dossierId, title }: Props) {
  const supabase = createClient();

  const [accounts, setAccounts]     = useState<string[]>([]);
  const [account, setAccount]       = useState<string>("");
  const [entries, setEntries]       = useState<EcritureRow[]>([]);
  const [loading, setLoading]       = useState(false);
  const [loadingAccts, setLoadingAccts] = useState(true);

  // Filters
  const [dateFrom, setDateFrom]           = useState("");
  const [dateTo, setDateTo]               = useState("");
  const [journal, setJournal]             = useState("Tous");
  const [unletteredOnly, setUnlettered]   = useState(false);

  // ── Fetch distinct accounts ─────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      setLoadingAccts(true);

      let data: any[] | null = null;
      if (dossierId) {
        const res = await supabase
          .from("dossier_ecritures")
          .select("compte_cgnc")
          .eq("dossier_id", dossierId)
          .not("compte_cgnc", "is", null);
        data = res.data;
      } else if (companyId) {
        const res = await (supabase.from("ecritures_comptables") as any)
          .select("compte")
          .eq("company_id", companyId);
        data = res.data;
      }

      const field = dossierId ? "compte_cgnc" : "compte";
      const unique = [...new Set((data ?? []).map((r: any) => r[field] as string))].sort();
      setAccounts(unique);
      if (unique.length > 0 && !account) setAccount(unique[0]);
      setLoadingAccts(false);
    })();
  }, [companyId, dossierId]);

  // ── Fetch entries for selected account ─────────────────────────────────────

  const loadEntries = useCallback(async () => {
    if (!account) return;
    setLoading(true);

    let rows: EcritureRow[] = [];

    if (dossierId) {
      let q = supabase
        .from("dossier_ecritures")
        .select("id, date, numero_piece, journal, libelle, debit, credit, compte_cgnc")
        .eq("dossier_id", dossierId)
        .eq("compte_cgnc", account)
        .order("date", { ascending: true });
      if (dateFrom) q = (q as any).gte("date", dateFrom);
      if (dateTo)   q = (q as any).lte("date", dateTo);
      if (journal !== "Tous") q = (q as any).eq("journal", journal);
      const { data } = await q;
      rows = (data ?? []).map((r: any) => ({
        id:            r.id,
        date_ecriture: r.date,
        numero_piece:  r.numero_piece ?? null,
        journal:       r.journal,
        libelle:       r.libelle ?? null,
        debit:         Number(r.debit),
        credit:        Number(r.credit),
        lettre:        null,
        is_lettered:   false,
        compte:        r.compte_cgnc,
      }));
    } else if (companyId) {
      let q = (supabase.from("ecritures_comptables") as any)
        .select("id, date_ecriture, numero_piece, journal, libelle, debit, credit, lettre, is_lettered, compte")
        .eq("company_id", companyId)
        .eq("compte", account)
        .order("date_ecriture", { ascending: true });
      if (dateFrom) q = q.gte("date_ecriture", dateFrom);
      if (dateTo)   q = q.lte("date_ecriture", dateTo);
      if (journal !== "Tous") q = q.eq("journal", journal);
      if (unletteredOnly) q = q.eq("is_lettered", false);
      const { data } = await q;
      rows = (data ?? []) as EcritureRow[];
    }

    setEntries(rows);
    setLoading(false);
  }, [account, companyId, dossierId, dateFrom, dateTo, journal, unletteredOnly]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  // ── Running balance ─────────────────────────────────────────────────────────

  let runningBalance = 0;
  const enriched = entries.map((e) => {
    runningBalance += Number(e.debit) - Number(e.credit);
    return { ...e, solde: runningBalance };
  });

  const totalDebit  = entries.reduce((s, e) => s + Number(e.debit),  0);
  const totalCredit = entries.reduce((s, e) => s + Number(e.credit), 0);

  // ── Export CSV ───────────────────────────────────────────────────────────────

  function exportCSV() {
    const header = "Date;Pièce;Journal;Libellé;Débit;Crédit;Solde;Lettre\n";
    const rows = enriched.map((e) =>
      [
        fmtDate(e.date_ecriture),
        e.numero_piece ?? "",
        e.journal,
        e.libelle ?? "",
        e.debit || "",
        e.credit || "",
        e.solde.toFixed(2),
        e.lettre ?? "",
      ].join(";")
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `grand-livre-${account}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-[rgba(200,146,74,0.12)] flex items-center justify-center flex-shrink-0">
          <BookOpen size={18} className="text-[#C8924A]" />
        </div>
        <div>
          <h1 className="text-[18px] font-bold text-[#1A1A2E] leading-tight">{title ?? "Grand Livre"}</h1>
          <p className="text-[12px] text-[#6B7280]">Journal des écritures comptables par compte</p>
        </div>
        {entries.length > 0 && (
          <button onClick={exportCSV} className="ml-auto btn btn-outline flex items-center gap-1.5">
            <Download size={13} /> Exporter CSV
          </button>
        )}
      </div>

      {/* Account selector + filters */}
      <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl p-4 mb-4"
        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
        <div className="flex flex-wrap items-end gap-3">
          {/* Account */}
          <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
            <label className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-[0.5px]">Compte</label>
            {loadingAccts ? (
              <div className="input animate-pulse bg-[#F3F4F6]" />
            ) : accounts.length === 0 ? (
              <div className="input text-[#9CA3AF] text-[12px]">Aucune écriture</div>
            ) : (
              <select className="input" value={account} onChange={(e) => setAccount(e.target.value)}>
                {accounts.map((a) => (
                  <option key={a} value={a}>
                    {a} — {getAccountLabel(a)}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Date from */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-[0.5px]">Du</label>
            <input type="date" className="input" value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)} />
          </div>

          {/* Date to */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-[0.5px]">Au</label>
            <input type="date" className="input" value={dateTo}
              onChange={(e) => setDateTo(e.target.value)} />
          </div>

          {/* Journal */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-[0.5px]">Journal</label>
            <select className="input" value={journal} onChange={(e) => setJournal(e.target.value)}>
              {JOURNALS.map((j) => <option key={j}>{j}</option>)}
            </select>
          </div>

          {/* Unlettered toggle — only relevant for ecritures_comptables */}
          {!dossierId && (
            <label className="flex items-center gap-2 cursor-pointer pb-2">
              <input type="checkbox" className="w-4 h-4 accent-[#C8924A]"
                checked={unletteredOnly}
                onChange={(e) => setUnlettered(e.target.checked)} />
              <span className="text-[12px] text-[#374151]">Non lettrés seulement</span>
            </label>
          )}

          <button onClick={loadEntries}
            className="btn btn-outline flex items-center gap-1.5 pb-2">
            <Filter size={13} /> Filtrer
          </button>
        </div>
      </div>

      {/* Account title */}
      {account && (
        <div className="flex items-center gap-2 mb-3">
          <div className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-[0.7px] pl-2.5 border-l-[3px] border-[#C8924A]">
            Classe {getAccountClass(account)} — {getAccountClassName(getAccountClass(account))}
          </div>
          <span className="text-[12px] font-semibold text-[#1A1A2E] ml-1">
            {account} — {getAccountLabel(account)}
          </span>
        </div>
      )}

      {/* Table */}
      <div className="tbl">
        {loading ? (
          <div className="py-12 text-center text-[13px] text-[#6B7280]">Chargement...</div>
        ) : entries.length === 0 ? (
          <div className="py-14 text-center">
            <BookOpen size={32} className="text-[#D1D5DB] mx-auto mb-3" />
            <p className="text-[13px] text-[#6B7280]">
              {accounts.length === 0
                ? "Aucune écriture comptable. Créez une facture ou importez un relevé bancaire pour générer des écritures automatiquement."
                : "Aucune écriture pour ce compte avec ces filtres."}
            </p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th className="w-20">Date</th>
                <th className="w-24">Pièce</th>
                <th className="w-12">Jnal</th>
                <th>Libellé</th>
                <th className="text-right w-28">Débit</th>
                <th className="text-right w-28">Crédit</th>
                <th className="text-right w-28">Solde</th>
                <th className="w-20 text-center">Lettrage</th>
              </tr>
            </thead>
            <tbody>
              {enriched.map((e) => (
                <tr key={e.id}>
                  <td className="text-[#6B7280] whitespace-nowrap">{fmtDate(e.date_ecriture)}</td>
                  <td className="text-[11.5px] text-[#6B7280] font-mono">{e.numero_piece ?? "—"}</td>
                  <td>
                    <span className="text-[10.5px] font-semibold px-1.5 py-0.5 rounded bg-[#F3F4F6] text-[#6B7280]">
                      {e.journal}
                    </span>
                  </td>
                  <td className="max-w-[200px] truncate">{e.libelle ?? "—"}</td>
                  <td className="text-right font-medium text-[#059669]">
                    {Number(e.debit) > 0 ? fmt(Number(e.debit)) : ""}
                  </td>
                  <td className="text-right font-medium text-[#DC2626]">
                    {Number(e.credit) > 0 ? fmt(Number(e.credit)) : ""}
                  </td>
                  <td className={`text-right font-semibold ${e.solde >= 0 ? "text-[#1A1A2E]" : "text-[#DC2626]"}`}>
                    {e.solde.toLocaleString("fr-MA", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="text-center">
                    {e.is_lettered && e.lettre ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#065F46] bg-[#D1FAE5] px-2 py-0.5 rounded-full">
                        {e.lettre} ✓
                      </span>
                    ) : (
                      <span className="text-[11px] text-[#D97706]">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            {/* Totals footer */}
            <tfoot>
              <tr className="border-t-2 border-[rgba(0,0,0,0.12)]" style={{ background: "#FAFAF6" }}>
                <td colSpan={4} className="px-3 py-2.5 text-[12px] font-bold text-[#1A1A2E]">
                  TOTAL — {entries.length} écriture{entries.length > 1 ? "s" : ""}
                </td>
                <td className="px-3 py-2.5 text-right text-[12px] font-bold text-[#059669]">
                  {totalDebit.toLocaleString("fr-MA", { minimumFractionDigits: 2 })}
                </td>
                <td className="px-3 py-2.5 text-right text-[12px] font-bold text-[#DC2626]">
                  {totalCredit.toLocaleString("fr-MA", { minimumFractionDigits: 2 })}
                </td>
                <td className={`px-3 py-2.5 text-right text-[12px] font-bold ${(totalDebit - totalCredit) >= 0 ? "text-[#1A1A2E]" : "text-[#DC2626]"}`}>
                  {(totalDebit - totalCredit).toLocaleString("fr-MA", { minimumFractionDigits: 2 })}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
