"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import {
  AlertTriangle,
  CheckCircle,
  PenLine,
  Plus,
  Save,
  Search,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { CGNC_ACCOUNTS, type JournalCode } from "@/types/fiduciaire";
import { useAccountOwnerId } from "@/hooks/useAccountOwner";

interface ManualRow {
  id?: string;
  date: string;
  numero_piece: string;
  compte: string;
  libelle: string;
  debit: string;
  credit: string;
  _dirty?: boolean;
  _auto?: boolean;
}

const JOURNAL_LABELS: Record<JournalCode, string> = {
  VT: "Journal des Ventes",
  AC: "Journal des Achats",
  BQ: "Journal de Banque",
  CA: "Journal de Caisse",
  OD: "Opérations Diverses",
};

const EXPENSE_DEBIT: Record<string, string> = {
  Achats: "6111",
  Salaires: "6171",
  Loyer: "6132",
  Fournitures: "6123",
  Transport: "6142",
  Communication: "6147",
  Fiscalité: "6161",
  Banque: "6311",
  "Autre dépense": "6182",
};

const INCOME_CREDIT: Record<string, string> = {
  Ventes: "7111",
  Services: "7131",
  Remboursement: "7311",
  "Autre revenu": "7131",
};

const COL_KEYS = ["date", "numero_piece", "compte", "libelle", "debit", "credit"] as const;
type ColKey = typeof COL_KEYS[number];

function emptyRow(lastDate?: string): ManualRow {
  return {
    date: lastDate ?? new Date().toISOString().split("T")[0],
    numero_piece: "",
    compte: "",
    libelle: "",
    debit: "",
    credit: "",
    _dirty: false,
    _auto: false,
  };
}

function fmt(n: number) {
  return n.toLocaleString("fr-MA", { minimumFractionDigits: 2 });
}

export default function SaisieClient() {
  const ownerId = useAccountOwnerId();
  const now = new Date();
  const supabase = createClient();
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [period, setPeriod] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [journal, setJournal] = useState<JournalCode>("VT");
  const [rows, setRows] = useState<ManualRow[]>([emptyRow()]);
  const [loadingRows, setLoadingRows] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const loadCompany = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from("companies")
      .select("id, raison_sociale")
      .eq("user_id", ownerId)
      .single();

    if (error || !data) {
      setLoadingRows(false);
      toast.error("Entreprise introuvable");
      return null;
    }

    setCompanyId(data.id);
    setCompanyName(data.raison_sociale ?? "");
    return data.id as string;
  }, [supabase]);

  const computeAutoRows = useCallback(async (cid: string, p: string, j: JournalCode): Promise<ManualRow[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const [year, month] = p.split("-");
    const startDate = `${year}-${month}-01`;
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    const endDate = `${year}-${month}-${String(lastDay).padStart(2, "0")}`;
    const autoRows: ManualRow[] = [];

    if (j === "VT") {
      const { data: invoices } = await supabase
        .from("invoices")
        .select("id, invoice_number, issue_date, subtotal, tax_amount, total, clients(name)")
        .eq("user_id", ownerId)
        .is("dossier_id", null)
        .gte("issue_date", startDate)
        .lte("issue_date", endDate)
        .order("issue_date");

      for (const inv of (invoices ?? []) as any[]) {
        const client = inv.clients?.name ?? "Client";
        const ref = inv.invoice_number ?? "";
        const ht = Number(inv.subtotal ?? 0);
        const tva = Number(inv.tax_amount ?? 0);
        const ttc = Number(inv.total ?? 0);
        const lib = `${client}${ref ? " - " + ref : ""}`;

        autoRows.push({ date: inv.issue_date, numero_piece: ref, compte: "3421", libelle: lib, debit: String(ttc), credit: "", _dirty: true, _auto: true });
        autoRows.push({ date: inv.issue_date, numero_piece: ref, compte: "7131", libelle: lib, debit: "", credit: String(ht > 0 ? ht : ttc), _dirty: true, _auto: true });
        if (tva > 0) autoRows.push({ date: inv.issue_date, numero_piece: ref, compte: "4455", libelle: `TVA ${ref}`, debit: "", credit: String(tva), _dirty: true, _auto: true });
      }
    } else if (j === "BQ" || j === "AC") {
      const { data: txs } = await supabase
        .from("transactions")
        .select("id, date, description, amount, type, category, receipt_id, invoice_id, reference")
        .eq("user_id", ownerId)
        .is("dossier_id", null)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date");

      for (const tx of (txs ?? []) as any[]) {
        const amount = Number(tx.amount);
        const txJournal: JournalCode = tx.receipt_id ? "AC" : "BQ";
        if (txJournal !== j) continue;

        if (tx.receipt_id) {
          const debitCpt = EXPENSE_DEBIT[tx.category ?? ""] ?? "6182";
          autoRows.push({ date: tx.date, numero_piece: tx.reference ?? "", compte: debitCpt, libelle: tx.description, debit: String(amount), credit: "", _dirty: true, _auto: true });
          autoRows.push({ date: tx.date, numero_piece: tx.reference ?? "", compte: "4411", libelle: tx.description, debit: "", credit: String(amount), _dirty: true, _auto: true });
        } else if (tx.invoice_id) {
          autoRows.push({ date: tx.date, numero_piece: "", compte: "5141", libelle: tx.description, debit: String(amount), credit: "", _dirty: true, _auto: true });
          autoRows.push({ date: tx.date, numero_piece: "", compte: "3421", libelle: tx.description, debit: "", credit: String(amount), _dirty: true, _auto: true });
        } else if (tx.type === "income") {
          const creditCpt = INCOME_CREDIT[tx.category ?? ""] ?? "7131";
          autoRows.push({ date: tx.date, numero_piece: "", compte: "5141", libelle: tx.description, debit: String(amount), credit: "", _dirty: true, _auto: true });
          autoRows.push({ date: tx.date, numero_piece: "", compte: creditCpt, libelle: tx.description, debit: "", credit: String(amount), _dirty: true, _auto: true });
        } else {
          const debitCpt = EXPENSE_DEBIT[tx.category ?? ""] ?? "6182";
          autoRows.push({ date: tx.date, numero_piece: "", compte: debitCpt, libelle: tx.description, debit: String(amount), credit: "", _dirty: true, _auto: true });
          autoRows.push({ date: tx.date, numero_piece: "", compte: "5141", libelle: tx.description, debit: "", credit: String(amount), _dirty: true, _auto: true });
        }
      }
    }

    return autoRows;
  }, [supabase]);

  const loadRows = useCallback(async (cid: string, p: string, j: JournalCode) => {
    setLoadingRows(true);

    const { data: saved, error } = await supabase
      .from("ecritures_comptables")
      .select("*")
      .eq("company_id", cid)
      .is("dossier_id", null)
      .eq("journal", j)
      .gte("date_ecriture", `${p}-01`)
      .lte("date_ecriture", `${p}-${String(new Date(parseInt(p.slice(0, 4)), parseInt(p.slice(5, 7)), 0).getDate()).padStart(2, "0")}`)
      .order("date_ecriture")
      .order("created_at");

    if (error) {
      toast.error(error.message);
      setRows([emptyRow()]);
      setLoadingRows(false);
      return;
    }

    if (saved && saved.length > 0) {
      const savedRows = saved.map((e: any) => ({
        id: e.id,
        date: e.date_ecriture,
        numero_piece: e.numero_piece || "",
        compte: e.compte || "",
        libelle: e.libelle || "",
        debit: e.debit > 0 ? String(e.debit) : "",
        credit: e.credit > 0 ? String(e.credit) : "",
        _dirty: false,
        _auto: false,
      }));
      setRows([...savedRows, emptyRow(savedRows.at(-1)?.date)]);
    } else {
      const autoRows = await computeAutoRows(cid, p, j);
      setRows([...autoRows, emptyRow(autoRows.at(-1)?.date)]);
    }

    setLoadingRows(false);
  }, [computeAutoRows, supabase]);

  useEffect(() => {
    loadCompany().then((cid) => {
      if (cid) loadRows(cid, period, journal);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function changePeriod(nextPeriod: string) {
    setPeriod(nextPeriod);
    setSearch("");
    if (companyId) loadRows(companyId, nextPeriod, journal);
  }

  function changeJournal(nextJournal: JournalCode) {
    setJournal(nextJournal);
    setSearch("");
    if (companyId) loadRows(companyId, period, nextJournal);
  }

  function updateRow(idx: number, key: string, value: string) {
    setRows((prev) => prev.map((r, i) => i === idx ? { ...r, [key]: value, _dirty: true } : r));
  }

  function addRow(afterIdx?: number) {
    const ref = afterIdx !== undefined ? rows[afterIdx] : rows.at(-1);
    const newRow = emptyRow(ref?.date);
    setRows((prev) => {
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
    const row = rows[idx];
    if (row.id) fetch(`/api/ecritures/${row.id}`, { method: "DELETE" }).catch(() => {});
    setRows((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      return next.length === 0 ? [emptyRow()] : next;
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>, rowIdx: number, col: string) {
    const colIdx = COL_KEYS.indexOf(col as ColKey);
    if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      if (colIdx < COL_KEYS.length - 1) inputRefs.current[`${rowIdx}-${COL_KEYS[colIdx + 1]}`]?.focus();
      else if (rowIdx >= rows.length - 1) addRow();
      else inputRefs.current[`${rowIdx + 1}-date`]?.focus();
    } else if (e.key === "Tab" && e.shiftKey) {
      e.preventDefault();
      if (colIdx > 0) inputRefs.current[`${rowIdx}-${COL_KEYS[colIdx - 1]}`]?.focus();
      else if (rowIdx > 0) inputRefs.current[`${rowIdx - 1}-credit`]?.focus();
    } else if (e.key === "Enter") {
      e.preventDefault();
      addRow(rowIdx);
    }
  }

  async function saveRows() {
    if (!companyId) return;
    const dirty = rows.filter((r) => r._dirty && r.libelle.trim());
    if (dirty.length === 0) {
      toast("Aucune modification à sauvegarder");
      return;
    }
    if (dirty.some((r) => !r.compte.trim())) {
      toast.error("Chaque ligne sauvegardée doit avoir un compte CGNC");
      return;
    }

    setSaving(true);
    const toInsert = dirty.filter((r) => !r.id);
    const toUpdate = dirty.filter((r) => !!r.id);

    for (const r of toInsert) {
      const res = await fetch("/api/ecritures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          journal,
          date: r.date,
          numero_piece: r.numero_piece,
          compte: r.compte,
          libelle: r.libelle.trim(),
          debit: parseFloat(r.debit) || 0,
          credit: parseFloat(r.credit) || 0,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setSaving(false);
        toast.error("Erreur: " + (body.message || body.error || res.statusText));
        return;
      }
    }

    for (const r of toUpdate) {
      const res = await fetch(`/api/ecritures/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: r.date,
          numero_piece: r.numero_piece,
          compte: r.compte,
          libelle: r.libelle.trim(),
          debit: parseFloat(r.debit) || 0,
          credit: parseFloat(r.credit) || 0,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setSaving(false);
        toast.error("Erreur: " + (body.message || body.error || res.statusText));
        return;
      }
    }

    setSaving(false);
    toast.success(`${dirty.length} ligne${dirty.length > 1 ? "s" : ""} sauvegardée${dirty.length > 1 ? "s" : ""}`);
    await loadRows(companyId, period, journal);
  }

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      r.numero_piece.toLowerCase().includes(q) ||
      r.compte.toLowerCase().includes(q) ||
      r.libelle.toLowerCase().includes(q) ||
      r.debit.includes(q) ||
      r.credit.includes(q)
    );
  }, [rows, search]);

  const totalDebit = rows.reduce((s, r) => s + (parseFloat(r.debit) || 0), 0);
  const totalCredit = rows.reduce((s, r) => s + (parseFloat(r.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;
  const hasInput = rows.some((r) => r.debit || r.credit || r.libelle);
  const hasDirty = rows.some((r) => r._dirty && r.libelle.trim());
  const hasAuto = rows.some((r) => r._auto);
  const [periodYear, periodMonth] = period.split("-");
  const periodLabel = new Date(parseInt(periodYear), parseInt(periodMonth) - 1, 1)
    .toLocaleDateString("fr-MA", { month: "long", year: "numeric" });

  return (
    <div>
      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(200,146,74,0.12)" }}>
          <PenLine size={18} className="text-[#C8924A]" />
        </div>
        <div>
          <h1 className="text-[18px] font-bold text-[#1A1A2E] leading-none">Saisie comptable</h1>
          <p className="text-[11px] text-[#9CA3AF] mt-0.5">
            Journal des écritures{companyName ? ` - ${companyName}` : ""}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-[#6B7280]">Période :</span>
          <input type="month" value={period} onChange={(e) => changePeriod(e.target.value)}
            className="input py-1 text-[12.5px] w-[140px]" />
        </div>

        <div className="flex items-center gap-1 bg-[#F3F4F6] p-1 rounded-xl">
          {(["VT", "AC", "BQ", "CA", "OD"] as JournalCode[]).map((j) => (
            <button key={j} onClick={() => changeJournal(j)}
              className={`px-3 py-1 rounded-lg text-[12px] font-medium transition-all ${
                journal === j ? "bg-[#0D1526] text-white shadow-sm" : "text-[#6B7280] hover:text-[#1A1A2E]"
              }`}>
              {j}
            </button>
          ))}
        </div>

        <div className="relative flex-1 max-w-[280px]">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
          <input
            className="input pl-7 py-1.5 text-[12px] w-full"
            placeholder="N° Pièce, Compte, Libellé, Montant..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#374151]">
              <X size={11} />
            </button>
          )}
        </div>

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

          <button data-permission="accounting:create" onClick={saveRows} disabled={saving || !hasDirty}
            className="btn btn-gold flex items-center gap-1.5 disabled:opacity-50">
            <Save size={13} /> {saving ? "Sauvegarde..." : "Sauvegarder"}
          </button>
        </div>
      </div>

      <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#F9F9F6] border-b border-[rgba(0,0,0,0.06)]">
          <span className="text-[12.5px] font-semibold text-[#1A1A2E]">
            {JOURNAL_LABELS[journal]}
            <span className="ml-2 text-[11px] text-[#9CA3AF] font-normal capitalize">{periodLabel}</span>
          </span>
          {!loadingRows && hasAuto && (
            <span className="flex items-center gap-1 text-[11px] text-[#D97706]">
              <Zap size={10} /> Pré-rempli depuis les sources
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="bg-[#F9FAFB] border-b border-[rgba(0,0,0,0.06)]">
                <th className="text-left px-3 py-2 text-[10.5px] font-semibold text-[#6B7280] uppercase tracking-wide w-[110px]">Date</th>
                <th className="text-left px-3 py-2 text-[10.5px] font-semibold text-[#6B7280] uppercase tracking-wide w-[120px]">Pièce</th>
                <th className="text-left px-3 py-2 text-[10.5px] font-semibold text-[#6B7280] uppercase tracking-wide w-[130px]">Compte</th>
                <th className="text-left px-3 py-2 text-[10.5px] font-semibold text-[#6B7280] uppercase tracking-wide">Libellé</th>
                <th className="text-right px-3 py-2 text-[10.5px] font-semibold text-[#6B7280] uppercase tracking-wide w-[120px]">Débit</th>
                <th className="text-right px-3 py-2 text-[10.5px] font-semibold text-[#6B7280] uppercase tracking-wide w-[120px]">Crédit</th>
                <th className="w-[42px]" />
              </tr>
            </thead>
            <tbody>
              {loadingRows ? (
                <tr><td colSpan={7} className="loading-cell">Chargement...</td></tr>
              ) : filteredRows.length === 0 ? (
                <tr><td colSpan={7} className="empty-cell">Aucune écriture trouvée. Ajustez les filtres ou ajoutez une écriture.</td></tr>
              ) : filteredRows.map((row, idx) => (
                <tr key={`${row.id ?? "new"}-${idx}`} className={`border-b border-[rgba(0,0,0,0.04)] ${row._auto ? "bg-[#FFFBEB]/50" : "hover:bg-[#FAFAF6]"}`}>
                  <td className="px-2 py-1">
                    <input ref={(el) => { inputRefs.current[`${idx}-date`] = el; }} type="date" value={row.date}
                      onChange={(e) => updateRow(idx, "date", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, idx, "date")}
                      className="w-full bg-transparent border-0 text-[12px] focus:ring-1 focus:ring-[#C8924A] rounded px-1.5 py-1" />
                  </td>
                  <td className="px-2 py-1">
                    <input ref={(el) => { inputRefs.current[`${idx}-numero_piece`] = el; }} value={row.numero_piece}
                      onChange={(e) => updateRow(idx, "numero_piece", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, idx, "numero_piece")}
                      className="w-full bg-transparent border-0 text-[12px] focus:ring-1 focus:ring-[#C8924A] rounded px-1.5 py-1" placeholder="REF" />
                  </td>
                  <td className="px-2 py-1">
                    <input ref={(el) => { inputRefs.current[`${idx}-compte`] = el; }} value={row.compte}
                      onChange={(e) => updateRow(idx, "compte", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, idx, "compte")}
                      list="cgnc-accounts"
                      className="w-full bg-transparent border-0 text-[12px] font-mono focus:ring-1 focus:ring-[#C8924A] rounded px-1.5 py-1" placeholder="Compte" />
                  </td>
                  <td className="px-2 py-1">
                    <input ref={(el) => { inputRefs.current[`${idx}-libelle`] = el; }} value={row.libelle}
                      onChange={(e) => updateRow(idx, "libelle", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, idx, "libelle")}
                      className="w-full bg-transparent border-0 text-[12px] focus:ring-1 focus:ring-[#C8924A] rounded px-1.5 py-1" placeholder="Libellé" />
                  </td>
                  <td className="px-2 py-1">
                    <input ref={(el) => { inputRefs.current[`${idx}-debit`] = el; }} value={row.debit}
                      onChange={(e) => updateRow(idx, "debit", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, idx, "debit")}
                      className="w-full bg-transparent border-0 text-[12px] text-right tabular-nums focus:ring-1 focus:ring-[#C8924A] rounded px-1.5 py-1" placeholder="0.00" />
                  </td>
                  <td className="px-2 py-1">
                    <input ref={(el) => { inputRefs.current[`${idx}-credit`] = el; }} value={row.credit}
                      onChange={(e) => updateRow(idx, "credit", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, idx, "credit")}
                      className="w-full bg-transparent border-0 text-[12px] text-right tabular-nums focus:ring-1 focus:ring-[#C8924A] rounded px-1.5 py-1" placeholder="0.00" />
                  </td>
                  <td className="px-2 py-1 text-center">
                    <button data-permission="accounting:delete" onClick={() => deleteRow(idx)} className="text-[#9CA3AF] hover:text-[#DC2626] p-1">
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-[#F9F9F6] border-t border-[rgba(0,0,0,0.08)]">
                <td colSpan={3} className="px-3 py-2">
                  <button data-permission="accounting:create" onClick={() => addRow()}
                    className="btn btn-outline flex items-center gap-1.5 text-[12px] py-1.5 px-3">
                    <Plus size={13} /> Ajouter une ligne
                  </button>
                </td>
                <td className="px-3 py-2 text-right text-[12px] font-semibold text-[#1A1A2E]">Total</td>
                <td className="px-3 py-2 text-right text-[12px] font-bold tabular-nums text-[#1A1A2E]">{fmt(totalDebit)}</td>
                <td className="px-3 py-2 text-right text-[12px] font-bold tabular-nums text-[#1A1A2E]">{fmt(totalCredit)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        <datalist id="cgnc-accounts">
          {CGNC_ACCOUNTS.map((account) => (
            <option key={account.code} value={account.code}>{account.label}</option>
          ))}
        </datalist>
      </div>
    </div>
  );
}
