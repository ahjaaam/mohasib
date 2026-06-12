"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import {
  Save, Plus, Trash2, CheckCircle, AlertTriangle, Lock,
  PenLine, Search, Archive, X, Zap,
} from "lucide-react";
import type { DossierEcriture, JournalCode } from "@/types/fiduciaire";
import { CGNC_ACCOUNTS as CGNC } from "@/types/fiduciaire";
import { useAccountOwnerId } from "@/hooks/useAccountOwner";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString("fr-MA", { minimumFractionDigits: 2 });
}

// ─── CGNC maps ────────────────────────────────────────────────────────────────

const EXPENSE_DEBIT: Record<string, string> = {
  "Achats":        "6111",
  "Salaires":      "6171",
  "Loyer":         "6132",
  "Fournitures":   "6123",
  "Transport":     "6142",
  "Communication": "6147",
  "Fiscalité":     "6161",
  "Banque":        "6311",
  "Autre dépense": "6182",
};

const INCOME_CREDIT: Record<string, string> = {
  "Ventes":        "7111",
  "Services":      "7131",
  "Remboursement": "7311",
  "Autre revenu":  "7131",
};

const JOURNAL_LABELS: Record<JournalCode, string> = {
  VT: "Journal des Ventes",
  AC: "Journal des Achats",
  BQ: "Journal de Banque",
  CA: "Journal de Caisse",
  OD: "Opérations Diverses",
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface ManualRow {
  id?: string;
  date: string;
  numero_piece: string;
  compte_cgnc: string;
  libelle: string;
  debit: string;
  credit: string;
  _dirty?: boolean;
  _auto?: boolean;  // pre-populated from source data, not yet saved to DB
}

const COL_KEYS = ["date", "numero_piece", "compte_cgnc", "libelle", "debit", "credit"] as const;
type ColKey = typeof COL_KEYS[number];

function emptyRow(lastDate?: string): ManualRow {
  return {
    date: lastDate ?? new Date().toISOString().split("T")[0],
    numero_piece: "", compte_cgnc: "", libelle: "",
    debit: "", credit: "", _dirty: false, _auto: false,
  };
}

function matchesSearch(query: string, piece: string, compte: string, libelle: string, debit: number | string, credit: number | string): boolean {
  if (!query.trim()) return true;
  const q = query.toLowerCase();
  return (
    piece.toLowerCase().includes(q) ||
    compte.toLowerCase().includes(q) ||
    libelle.toLowerCase().includes(q) ||
    String(debit).includes(q) ||
    String(credit).includes(q)
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  dossier: { id: string; raison_sociale: string };
  initialEcritures: DossierEcriture[];  // kept for server compat, not used directly
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SaisieClient({ dossier }: Props) {
  const ownerId = useAccountOwnerId();
  const now = new Date();
  const [period, setPeriod] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [journal, setJournal] = useState<JournalCode>("VT");

  const [rows, setRows] = useState<ManualRow[]>([emptyRow()]);
  const [loadingRows, setLoadingRows] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [locked, setLocked] = useState(false);
  const [locking, setLocking] = useState(false);
  const [confirmLock, setConfirmLock] = useState(false);

  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const supabase = createClient();

  // ─── Period lock check ────────────────────────────────────────────────────

  const checkLock = useCallback(async (p: string) => {
    const { data } = await supabase
      .from("dossier_clotures")
      .select("id")
      .eq("dossier_id", dossier.id)
      .eq("periode", p)
      .maybeSingle();
    setLocked(!!data);
  }, [dossier.id]);

  // ─── Auto-populate rows from invoices + transactions ──────────────────────

  const computeAutoRows = useCallback(async (p: string, j: JournalCode): Promise<ManualRow[]> => {
    const [year, month] = p.split("-");
    const startDate = `${year}-${month}-01`;
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    const endDate = `${year}-${month}-${String(lastDay).padStart(2, "0")}`;

    const autoRows: ManualRow[] = [];

    if (j === "VT") {
      const { data: invoices } = await supabase
        .from("invoices")
        .select("id, invoice_number, issue_date, subtotal, tax_amount, total, clients(name)")
        .eq("dossier_id", dossier.id)
        .gte("issue_date", startDate)
        .lte("issue_date", endDate)
        .order("issue_date");

      for (const inv of (invoices ?? []) as any[]) {
        const client = inv.clients?.name ?? "Client";
        const ref    = inv.invoice_number ?? "";
        const ht     = Number(inv.subtotal ?? 0);
        const tva    = Number(inv.tax_amount ?? 0);
        const ttc    = Number(inv.total ?? 0);
        const lib    = `${client}${ref ? " — " + ref : ""}`;

        autoRows.push({ date: inv.issue_date, numero_piece: ref, compte_cgnc: "3421", libelle: lib,         debit: String(ttc),             credit: "",         _dirty: true, _auto: true });
        autoRows.push({ date: inv.issue_date, numero_piece: ref, compte_cgnc: "7131", libelle: lib,         debit: "",                      credit: String(ht > 0 ? ht : ttc), _dirty: true, _auto: true });
        if (tva > 0) {
          autoRows.push({ date: inv.issue_date, numero_piece: ref, compte_cgnc: "4455", libelle: `TVA ${ref}`, debit: "", credit: String(tva), _dirty: true, _auto: true });
        }
      }
    } else if (j === "BQ" || j === "AC") {
      const { data: txs } = await supabase
        .from("transactions")
        .select("id, date, description, amount, type, category, receipt_id, invoice_id, reference")
        .eq("dossier_id", dossier.id)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date");

      for (const tx of (txs ?? []) as any[]) {
        const amount: number = Number(tx.amount);
        const txJournal: JournalCode = tx.receipt_id ? "AC" : "BQ";
        if (txJournal !== j) continue;

        if (tx.receipt_id) {
          const debitCpt = EXPENSE_DEBIT[tx.category ?? ""] ?? "6182";
          autoRows.push({ date: tx.date, numero_piece: tx.reference ?? "", compte_cgnc: debitCpt, libelle: tx.description, debit: String(amount), credit: "",           _dirty: true, _auto: true });
          autoRows.push({ date: tx.date, numero_piece: tx.reference ?? "", compte_cgnc: "4411",   libelle: tx.description, debit: "",             credit: String(amount), _dirty: true, _auto: true });
        } else if (tx.invoice_id) {
          autoRows.push({ date: tx.date, numero_piece: "", compte_cgnc: "5141", libelle: tx.description, debit: String(amount), credit: "",           _dirty: true, _auto: true });
          autoRows.push({ date: tx.date, numero_piece: "", compte_cgnc: "3421", libelle: tx.description, debit: "",             credit: String(amount), _dirty: true, _auto: true });
        } else if (tx.type === "income") {
          const creditCpt = INCOME_CREDIT[tx.category ?? ""] ?? "7131";
          autoRows.push({ date: tx.date, numero_piece: "", compte_cgnc: "5141",    libelle: tx.description, debit: String(amount), credit: "",           _dirty: true, _auto: true });
          autoRows.push({ date: tx.date, numero_piece: "", compte_cgnc: creditCpt, libelle: tx.description, debit: "",             credit: String(amount), _dirty: true, _auto: true });
        } else {
          const debitCpt = EXPENSE_DEBIT[tx.category ?? ""] ?? "6182";
          autoRows.push({ date: tx.date, numero_piece: "", compte_cgnc: debitCpt, libelle: tx.description, debit: String(amount), credit: "",           _dirty: true, _auto: true });
          autoRows.push({ date: tx.date, numero_piece: "", compte_cgnc: "5141",   libelle: tx.description, debit: "",             credit: String(amount), _dirty: true, _auto: true });
        }
      }
    }

    return autoRows;
  }, [dossier.id]);

  // ─── Load rows: saved entries first, auto-populate if none ───────────────

  const loadRows = useCallback(async (p: string, j: JournalCode) => {
    setLoadingRows(true);

    const { data: saved } = await supabase
      .from("dossier_ecritures")
      .select("*")
      .eq("dossier_id", dossier.id)
      .eq("periode", p)
      .eq("journal", j)
      .order("date")
      .order("created_at");

    if (saved && saved.length > 0) {
      const savedRows: ManualRow[] = saved.map((e: any) => ({
        id:           e.id,
        date:         e.date,
        numero_piece: e.numero_piece || "",
        compte_cgnc:  e.compte_cgnc  || "",
        libelle:      e.libelle      || "",
        debit:        e.debit  > 0 ? String(e.debit)  : "",
        credit:       e.credit > 0 ? String(e.credit) : "",
        _dirty: false,
        _auto:  false,
      }));
      setRows([...savedRows, emptyRow(savedRows.at(-1)?.date)]);
    } else {
      const autoRows = await computeAutoRows(p, j);
      setRows([...autoRows, emptyRow(autoRows.at(-1)?.date)]);
    }

    setLoadingRows(false);
  }, [dossier.id, computeAutoRows]);

  // ─── Mount ────────────────────────────────────────────────────────────────

  useEffect(() => {
    checkLock(period);
    loadRows(period, journal);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Period / journal change ──────────────────────────────────────────────

  function changePeriod(p: string) {
    setPeriod(p);
    setSearch("");
    setConfirmLock(false);
    checkLock(p);
    loadRows(p, journal);
  }

  function changeJournal(j: JournalCode) {
    setJournal(j);
    setSearch("");
    loadRows(period, j);
  }

  // ─── Row editing ──────────────────────────────────────────────────────────

  function updateRow(idx: number, key: string, value: string) {
    if (locked) return;
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [key]: value, _dirty: true } : r));
  }

  function addRow(afterIdx?: number) {
    if (locked) return;
    const ref = afterIdx !== undefined ? rows[afterIdx] : rows.at(-1);
    const newRow = emptyRow(ref?.date);
    setRows(prev => {
      if (afterIdx !== undefined) {
        const next = [...prev];
        next.splice(afterIdx + 1, 0, newRow);
        return next;
      }
      return [...prev, newRow];
    });
    const newIdx = afterIdx !== undefined ? afterIdx + 1 : rows.length;
    setTimeout(() => inputRefs.current[`${newIdx}-date`]?.focus(), 0);
  }

  function deleteRow(idx: number) {
    if (locked) return;
    const row = rows[idx];
    if (row.id) {
      supabase.from("dossier_ecritures").delete().eq("id", row.id).then(() => {});
    }
    setRows(prev => {
      const next = prev.filter((_, i) => i !== idx);
      return next.length === 0 ? [emptyRow()] : next;
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>, rowIdx: number, col: string) {
    const colIdx = COL_KEYS.indexOf(col as ColKey);
    if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      if (colIdx < COL_KEYS.length - 1) inputRefs.current[`${rowIdx}-${COL_KEYS[colIdx + 1]}`]?.focus();
      else { if (rowIdx >= rows.length - 1) addRow(); else inputRefs.current[`${rowIdx + 1}-date`]?.focus(); }
    } else if (e.key === "Tab" && e.shiftKey) {
      e.preventDefault();
      if (colIdx > 0) inputRefs.current[`${rowIdx}-${COL_KEYS[colIdx - 1]}`]?.focus();
      else if (rowIdx > 0) inputRefs.current[`${rowIdx - 1}-credit`]?.focus();
    } else if (e.key === "Enter") {
      e.preventDefault(); addRow(rowIdx);
    }
  }

  // ─── Save ─────────────────────────────────────────────────────────────────

  async function saveRows() {
    if (locked) return;
    const dirty = rows.filter(r => r._dirty && r.libelle.trim());
    if (dirty.length === 0) { toast("Aucune modification à sauvegarder"); return; }
    setSaving(true);

    const toInsert = dirty.filter(r => !r.id);
    const toUpdate = dirty.filter(r => !!r.id);

    if (toInsert.length > 0) {
      const { error } = await supabase.from("dossier_ecritures").insert(
        toInsert.map(r => ({
          dossier_id:         dossier.id,
          fiduciaire_user_id: ownerId,
          periode:            period,
          journal,
          date:               r.date,
          numero_piece:       r.numero_piece || null,
          compte_cgnc:        r.compte_cgnc  || null,
          libelle:            r.libelle.trim(),
          debit:              parseFloat(r.debit)  || 0,
          credit:             parseFloat(r.credit) || 0,
        }))
      );
      if (error) { setSaving(false); toast.error("Erreur: " + error.message); return; }
    }

    for (const r of toUpdate) {
      const { error } = await supabase.from("dossier_ecritures").update({
        date:         r.date,
        numero_piece: r.numero_piece || null,
        compte_cgnc:  r.compte_cgnc  || null,
        libelle:      r.libelle.trim(),
        debit:        parseFloat(r.debit)  || 0,
        credit:       parseFloat(r.credit) || 0,
      }).eq("id", r.id!);
      if (error) { setSaving(false); toast.error("Erreur: " + error.message); return; }
    }

    setSaving(false);
    toast.success(`${dirty.length} ligne${dirty.length > 1 ? "s" : ""} sauvegardée${dirty.length > 1 ? "s" : ""}`);
    await supabase.from("dossiers").update({ derniere_ecriture: new Date().toISOString() }).eq("id", dossier.id);
    await loadRows(period, journal);
  }

  // ─── Clôturer le mois ─────────────────────────────────────────────────────

  async function cloturerMois() {
    setLocking(true);
    const dirty = rows.filter(r => r._dirty && r.libelle.trim());
    if (dirty.length > 0) await saveRows();

    const { error } = await supabase.from("dossier_clotures").upsert({
      dossier_id:         dossier.id,
      fiduciaire_user_id: ownerId,
      periode:            period,
    });
    if (error) { toast.error(error.message); setLocking(false); return; }
    setLocked(true);
    setLocking(false);
    setConfirmLock(false);
    const [y, m] = period.split("-");
    const label = new Date(parseInt(y), parseInt(m) - 1, 1)
      .toLocaleDateString("fr-MA", { month: "long", year: "numeric" });
    toast.success(`Période ${label} clôturée ✓`);
  }

  // ─── Derived ──────────────────────────────────────────────────────────────

  const totalDebit  = rows.reduce((s, r) => s + (parseFloat(r.debit)  || 0), 0);
  const totalCredit = rows.reduce((s, r) => s + (parseFloat(r.credit) || 0), 0);
  const isBalanced  = Math.abs(totalDebit - totalCredit) < 0.01;
  const hasInput    = rows.some(r => r.debit || r.credit || r.libelle);
  const hasDirty    = rows.some(r => r._dirty && r.libelle.trim());
  const hasAuto     = rows.some(r => r._auto);

  const [periodYear, periodMonth] = period.split("-");
  const periodLabel = new Date(parseInt(periodYear), parseInt(periodMonth) - 1, 1)
    .toLocaleDateString("fr-MA", { month: "long", year: "numeric" });

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div>
      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(200,146,74,0.12)" }}>
          <PenLine size={18} className="text-[#C8924A]" />
        </div>
        <div>
          <h1 className="text-[18px] font-bold text-[#1A1A2E] leading-none">Saisie comptable</h1>
          <p className="text-[11px] text-[#9CA3AF] mt-0.5 capitalize">
            Journal des écritures — {dossier.raison_sociale}
          </p>
        </div>
        {locked && (
          <span className="ml-auto flex items-center gap-1.5 text-[11.5px] font-semibold text-[#065F46] bg-[#D1FAE5] px-3 py-1.5 rounded-lg">
            <Lock size={11} /> Période clôturée
          </span>
        )}
      </div>

      {/* ── Controls row ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">

        {/* Period picker */}
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-[#6B7280]">Période :</span>
          <input type="month" value={period} onChange={e => changePeriod(e.target.value)}
            className="input py-1 text-[12.5px] w-[140px]" />
        </div>

        {/* Journal tabs */}
        <div className="flex items-center gap-1 bg-[#F3F4F6] p-1 rounded-xl">
          {(["VT", "AC", "BQ", "CA", "OD"] as JournalCode[]).map(j => (
            <button key={j} onClick={() => changeJournal(j)}
              className={`px-3 py-1 rounded-lg text-[12px] font-medium transition-all ${
                journal === j ? "bg-[#0D1526] text-white shadow-sm" : "text-[#6B7280] hover:text-[#1A1A2E]"
              }`}>
              {j}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-[280px]">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
          <input
            className="input pl-7 py-1.5 text-[12px] w-full"
            placeholder="N° Pièce, Compte, Libellé, Montant…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#374151]">
              <X size={11} />
            </button>
          )}
        </div>

        {/* Right: balance + actions */}
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {hasInput && (
            isBalanced
              ? <span className="text-[11.5px] text-[#059669] bg-[#D1FAE5] px-2.5 py-1 rounded-lg flex items-center gap-1">
                  <CheckCircle size={12} /> Équilibré
                </span>
              : <span className="text-[11.5px] text-[#DC2626] bg-[#FEE2E2] px-2.5 py-1 rounded-lg flex items-center gap-1">
                  <AlertTriangle size={12} /> {fmt(Math.abs(totalDebit - totalCredit))} MAD
                </span>
          )}

          {!locked && (
            <button data-permission="accounting:create" onClick={saveRows} disabled={saving || !hasDirty}
              className="btn btn-gold flex items-center gap-1.5 disabled:opacity-50">
              <Save size={13} /> {saving ? "Sauvegarde..." : "Sauvegarder"}
            </button>
          )}

          {!locked && !confirmLock && (
            <button data-permission="accounting:lock" onClick={() => setConfirmLock(true)}
              className="btn btn-outline flex items-center gap-1.5 text-[12px]">
              <Archive size={12} /> Clôturer le mois
            </button>
          )}
          {!locked && confirmLock && (
            <div className="flex items-center gap-2 bg-[#FEF3C7] border border-[#FDE68A] rounded-lg px-3 py-1.5">
              <span className="text-[11.5px] text-[#92400E] font-medium capitalize">
                Clôturer {periodLabel} ?
              </span>
              <button data-permission="accounting:lock" onClick={cloturerMois} disabled={locking}
                className="btn btn-gold btn-sm text-[11px] py-0.5 px-2.5 h-6">
                {locking ? "…" : "Confirmer"}
              </button>
              <button onClick={() => setConfirmLock(false)}
                className="text-[#9CA3AF] hover:text-[#374151]">
                <X size={13} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Locked banner ─────────────────────────────────────────────────── */}
      {locked && (
        <div className="flex items-center gap-2.5 bg-[#FEF3C7] border border-[#FDE68A] rounded-lg px-4 py-2.5 mb-4 text-[12.5px] text-[#92400E]">
          <Lock size={13} className="flex-shrink-0" />
          <span>
            La période <strong className="capitalize">{periodLabel}</strong> est clôturée.
            Aucune modification n'est possible.
          </span>
        </div>
      )}

      {/* ── Journal table ──────────────────────────────────────────────────── */}
      <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl overflow-hidden">

        {/* Table header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#F9F9F6] border-b border-[rgba(0,0,0,0.06)]">
          <span className="text-[12.5px] font-semibold text-[#1A1A2E]">
            {JOURNAL_LABELS[journal]}
            <span className="ml-2 text-[11px] text-[#9CA3AF] font-normal capitalize">{periodLabel}</span>
          </span>
          {!loadingRows && hasAuto && (
            <span className="flex items-center gap-1 text-[11px] text-[#D97706]">
              <Zap size={10} /> Pré-rempli depuis les sources — modifiable avant sauvegarde
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="bg-[#F9FAFB] border-b border-[rgba(0,0,0,0.06)]">
                <th className="text-left px-3 py-2 text-[10.5px] font-semibold text-[#6B7280] uppercase tracking-wide w-[110px]">Date</th>
                <th className="text-left px-3 py-2 text-[10.5px] font-semibold text-[#6B7280] uppercase tracking-wide w-[100px]">N° Pièce</th>
                <th className="text-left px-3 py-2 text-[10.5px] font-semibold text-[#6B7280] uppercase tracking-wide w-[140px]">Compte CGNC</th>
                <th className="text-left px-3 py-2 text-[10.5px] font-semibold text-[#6B7280] uppercase tracking-wide">Libellé</th>
                <th className="text-right px-3 py-2 text-[10.5px] font-semibold text-[#6B7280] uppercase tracking-wide w-[110px]">Débit</th>
                <th className="text-right px-3 py-2 text-[10.5px] font-semibold text-[#6B7280] uppercase tracking-wide w-[110px]">Crédit</th>
                <th className="w-[40px]"></th>
              </tr>
            </thead>
            <tbody>
              {loadingRows ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-[12px] text-[#9CA3AF]">Chargement…</td>
                </tr>
              ) : (
                rows.map((row, idx) => {
                  const rowMatches = !search || matchesSearch(
                    search, row.numero_piece, row.compte_cgnc, row.libelle, row.debit, row.credit,
                  );
                  return (
                    <tr key={row.id ?? `new-${idx}`}
                      className="border-b border-[rgba(0,0,0,0.03)]"
                      style={{
                        backgroundColor: row._auto ? "rgba(200,146,74,0.05)" : undefined,
                        opacity: search && !rowMatches ? 0.3 : 1,
                      }}>

                      {(["date", "numero_piece", "compte_cgnc", "libelle", "debit", "credit"] as ColKey[]).map(col => (
                        <td key={col} className="p-0"
                          style={{ textAlign: col === "debit" || col === "credit" ? "right" : undefined }}>
                          {col === "compte_cgnc" ? (
                            <>
                              <input
                                ref={el => { inputRefs.current[`${idx}-${col}`] = el; }}
                                list={`cgnc-list-${idx}`}
                                value={row[col]}
                                placeholder="3421"
                                disabled={locked}
                                onChange={e => updateRow(idx, col, e.target.value)}
                                onKeyDown={e => handleKeyDown(e, idx, col)}
                                className="w-full border-none bg-transparent outline-none text-[12px] px-3 py-[9px] focus:bg-[#FFFBF5] font-mono disabled:opacity-50 disabled:cursor-not-allowed"
                              />
                              <datalist id={`cgnc-list-${idx}`}>
                                {CGNC.map(a => <option key={a.code} value={a.code} label={a.label} />)}
                              </datalist>
                            </>
                          ) : (
                            <input
                              ref={el => { inputRefs.current[`${idx}-${col}`] = el; }}
                              type={col === "date" ? "date" : col === "debit" || col === "credit" ? "number" : "text"}
                              value={row[col]}
                              placeholder={
                                col === "libelle"      ? "Description..." :
                                col === "numero_piece" ? "Réf." :
                                col === "debit" || col === "credit" ? "0" : ""
                              }
                              min={col === "debit" || col === "credit" ? "0" : undefined}
                              step={col === "debit" || col === "credit" ? "0.01" : undefined}
                              disabled={locked}
                              onChange={e => updateRow(idx, col, e.target.value)}
                              onKeyDown={e => handleKeyDown(e, idx, col)}
                              className={`w-full border-none bg-transparent outline-none text-[12px] px-3 py-[9px] focus:bg-[#FFFBF5] disabled:opacity-50 disabled:cursor-not-allowed ${
                                col === "debit" || col === "credit" ? "text-right" : ""
                              }`}
                            />
                          )}
                        </td>
                      ))}

                      <td className="p-0 w-[40px]">
                        <div className="flex items-center justify-center gap-1 px-1">
                          {row.id && row._dirty && !locked && (
                            <span className="w-1.5 h-1.5 rounded-full bg-[#D97706] flex-shrink-0" title="Modifié, non sauvegardé" />
                          )}
                          {!locked && (
                            <button data-permission="accounting:delete" onClick={() => deleteRow(idx)}
                              className="text-[#9CA3AF] hover:text-[#DC2626] transition-colors p-1.5">
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            <tfoot>
              <tr style={{ backgroundColor: "#F0EDE5" }}>
                <td colSpan={4} className="px-3 py-2">
                  {!locked && (
                    <button data-permission="accounting:create" onClick={() => addRow()}
                      className="text-[#C8924A] hover:underline text-[12px] font-medium flex items-center gap-1">
                      <Plus size={12} /> Ajouter une ligne
                    </button>
                  )}
                </td>
                <td className="text-right font-bold text-[12.5px] px-3 py-2 tabular-nums">
                  {totalDebit > 0 ? fmt(totalDebit) : ""}
                </td>
                <td className="text-right font-bold text-[12.5px] px-3 py-2 tabular-nums">
                  {totalCredit > 0 ? fmt(totalCredit) : ""}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <p className="text-[11px] text-[#9CA3AF] mt-2">
        Lignes dorées = pré-remplies depuis les sources · Tab → cellule suivante · Entrée → nouvelle ligne
        {locked && " · Période clôturée — lecture seule"}
      </p>
    </div>
  );
}
