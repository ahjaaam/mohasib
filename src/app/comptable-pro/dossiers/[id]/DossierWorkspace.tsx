"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import {
  ChevronLeft, Save, Plus, Trash2, Download, FileText,
  BarChart2, Receipt, Banknote, FolderOpen, Package,
  TrendingUp, CheckCircle, AlertTriangle,
} from "lucide-react";
import type { Dossier, DossierEcriture, DossierTva, JournalCode } from "@/types/fiduciaire";
import { CGNC_ACCOUNTS as CGNC } from "@/types/fiduciaire";

function fmt(n: number) {
  return n.toLocaleString("fr-MA", { minimumFractionDigits: 2 });
}
function fmtMAD(n: number) { return fmt(n) + " MAD"; }

const TABS = [
  { key: "dashboard", label: "Tableau de bord", icon: TrendingUp },
  { key: "saisie", label: "Saisie", icon: FileText },
  { key: "factures", label: "Factures clients", icon: FileText },
  { key: "achats", label: "Achats fournisseurs", icon: FileText },
  { key: "tva", label: "Déclaration TVA", icon: Receipt },
  { key: "paie", label: "Paie", icon: Banknote },
  { key: "bilan", label: "Bilan / CPC", icon: BarChart2 },
  { key: "documents", label: "Documents", icon: FolderOpen },
  { key: "export", label: "Export CGNC", icon: Package },
] as const;

type TabKey = typeof TABS[number]["key"];

interface EcritureRow {
  id?: string;
  date: string;
  numero_piece: string;
  compte_cgnc: string;
  libelle: string;
  debit: string;
  credit: string;
  _saved?: boolean;
}

const COL_KEYS = ["date", "numero_piece", "compte_cgnc", "libelle", "debit", "credit"] as const;
type ColKey = typeof COL_KEYS[number];

function emptyRow(lastDate?: string): EcritureRow {
  return { date: lastDate || new Date().toISOString().split("T")[0], numero_piece: "", compte_cgnc: "", libelle: "", debit: "", credit: "" };
}

interface Props {
  dossier: Dossier;
  initialEcritures: DossierEcriture[];
}

export default function DossierWorkspace({ dossier, initialEcritures }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTab = (searchParams.get("tab") as TabKey) ?? "dashboard";
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);

  const now = new Date();
  const [period, setPeriod] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [journal, setJournal] = useState<JournalCode>("BQ");
  const [ecritures, setEcritures] = useState<DossierEcriture[]>(initialEcritures);
  const [rows, setRows] = useState<EcritureRow[]>([emptyRow()]);
  const [saving, setSaving] = useState(false);
  const [tvaData, setTvaData] = useState<DossierTva | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const supabase = createClient();

  const APP_ROUTES: Partial<Record<TabKey, string>> = {
    factures:     `/invoices?dossier_id=${dossier.id}`,
    achats:       `/inbox?dossier_id=${dossier.id}`,
    paie:         `/paie?dossier_id=${dossier.id}`,
  };

  const switchTab = (tab: TabKey) => {
    if (APP_ROUTES[tab]) {
      document.cookie = `active_dossier_id=${dossier.id}; path=/; max-age=7200`;
      router.push(APP_ROUTES[tab]!);
      return;
    }
    setActiveTab(tab);
    router.replace(`/comptable-pro/dossiers/${dossier.id}?tab=${tab}`, { scroll: false });
  };

  useEffect(() => {
    const existing = ecritures.filter(e => e.periode === period && e.journal === journal);
    const savedRows: EcritureRow[] = existing.map(e => ({
      id: e.id,
      date: e.date,
      numero_piece: e.numero_piece || "",
      compte_cgnc: e.compte_cgnc || "",
      libelle: e.libelle || "",
      debit: e.debit > 0 ? String(e.debit) : "",
      credit: e.credit > 0 ? String(e.credit) : "",
      _saved: true,
    }));
    setRows([...savedRows, emptyRow(savedRows.at(-1)?.date)]);
  }, [period, journal, ecritures]);

  // Set/clear dossier cookie for (app) route access
  useEffect(() => {
    document.cookie = `active_dossier_id=${dossier.id}; path=/; max-age=7200`;
    return () => { document.cookie = "active_dossier_id=; path=/; max-age=0"; };
  }, [dossier.id]);

  const fetchEcritures = useCallback(async () => {
    const { data } = await supabase.from("dossier_ecritures").select("*")
      .eq("dossier_id", dossier.id).order("date").order("created_at");
    if (data) setEcritures(data);
  }, [dossier.id]);

  useEffect(() => {
    if (activeTab === "tva") {
      const p = `${period}`;
      supabase.from("dossier_tva").select("*").eq("dossier_id", dossier.id).eq("periode", p).single()
        .then(({ data }) => setTvaData(data));
    }
  }, [activeTab, period, dossier.id]);

  function updateRow(idx: number, key: string, value: string) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [key]: value, _saved: false } : r));
  }

  function addRow(afterIdx?: number) {
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
    if (rows[idx]._saved && rows[idx].id) {
      supabase.from("dossier_ecritures").delete().eq("id", rows[idx].id!).then(() => fetchEcritures());
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
      if (colIdx < COL_KEYS.length - 1) {
        inputRefs.current[`${rowIdx}-${COL_KEYS[colIdx + 1]}`]?.focus();
      } else {
        if (rowIdx >= rows.length - 1) {
          addRow();
        } else {
          inputRefs.current[`${rowIdx + 1}-date`]?.focus();
        }
      }
    } else if (e.key === "Tab" && e.shiftKey) {
      e.preventDefault();
      if (colIdx > 0) {
        inputRefs.current[`${rowIdx}-${COL_KEYS[colIdx - 1]}`]?.focus();
      } else if (rowIdx > 0) {
        inputRefs.current[`${rowIdx - 1}-credit`]?.focus();
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      addRow(rowIdx);
    }
  }

  async function saveEcritures() {
    const unsaved = rows.filter(r => !r._saved && r.libelle.trim());
    if (unsaved.length === 0) { toast("Aucune nouvelle ligne à sauvegarder"); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("dossier_ecritures").insert(
      unsaved.map(r => ({
        dossier_id: dossier.id,
        fiduciaire_user_id: user!.id,
        periode: period,
        journal,
        date: r.date,
        numero_piece: r.numero_piece || null,
        compte_cgnc: r.compte_cgnc || null,
        libelle: r.libelle.trim(),
        debit: parseFloat(r.debit) || 0,
        credit: parseFloat(r.credit) || 0,
      }))
    );
    setSaving(false);
    if (error) { toast.error("Erreur: " + error.message); return; }
    toast.success(`${unsaved.length} ligne${unsaved.length > 1 ? "s" : ""} sauvegardée${unsaved.length > 1 ? "s" : ""}`);
    await fetchEcritures();
    // Update derniere_ecriture on dossier
    await supabase.from("dossiers").update({ derniere_ecriture: new Date().toISOString() }).eq("id", dossier.id);
  }

  const totalDebit = rows.reduce((s, r) => s + (parseFloat(r.debit) || 0), 0);
  const totalCredit = rows.reduce((s, r) => s + (parseFloat(r.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  // Compute KPIs from all ecritures
  const allProduits = ecritures.filter(e => e.compte_cgnc?.startsWith("7")).reduce((s, e) => s + e.credit - e.debit, 0);
  const allCharges = ecritures.filter(e => e.compte_cgnc?.startsWith("6")).reduce((s, e) => s + e.debit - e.credit, 0);
  const resultat = allProduits - allCharges;
  const banqueTotal = ecritures.filter(e => e.compte_cgnc?.startsWith("514")).reduce((s, e) => s + e.debit - e.credit, 0) + dossier.solde_banque_initial;

  // CPC data
  const cpcData = [
    { label: "Ventes de marchandises (711)", montant: ecritures.filter(e => e.compte_cgnc?.startsWith("711")).reduce((s, e) => s + e.credit - e.debit, 0) },
    { label: "Ventes de services (713)", montant: ecritures.filter(e => e.compte_cgnc?.startsWith("713")).reduce((s, e) => s + e.credit - e.debit, 0) },
    { label: "Produits financiers (718)", montant: ecritures.filter(e => e.compte_cgnc?.startsWith("718")).reduce((s, e) => s + e.credit - e.debit, 0) },
  ];
  const chargesData = [
    { label: "Achats (611/612)", montant: ecritures.filter(e => e.compte_cgnc?.startsWith("61")).reduce((s, e) => s + e.debit - e.credit, 0) },
    { label: "Charges externes (614/615)", montant: ecritures.filter(e => e.compte_cgnc?.startsWith("614") || e.compte_cgnc?.startsWith("615")).reduce((s, e) => s + e.debit - e.credit, 0) },
    { label: "Charges de personnel (617)", montant: ecritures.filter(e => e.compte_cgnc?.startsWith("617")).reduce((s, e) => s + e.debit - e.credit, 0) },
    { label: "Impôts et taxes (616)", montant: ecritures.filter(e => e.compte_cgnc?.startsWith("616")).reduce((s, e) => s + e.debit - e.credit, 0) },
    { label: "Dotations aux amortissements (618)", montant: ecritures.filter(e => e.compte_cgnc?.startsWith("618")).reduce((s, e) => s + e.debit - e.credit, 0) },
  ];

  // TVA computed from ecritures
  const tvaCollectee = ecritures.filter(e => e.compte_cgnc === "4455").reduce((s, e) => s + e.credit - e.debit, 0);
  const tvaDeductible = ecritures.filter(e => e.compte_cgnc === "3453" || e.compte_cgnc === "4456").reduce((s, e) => s + e.debit - e.credit, 0);
  const netDu = tvaCollectee - tvaDeductible;

  // Bilan data (simplified)
  const actifImmob = ecritures.filter(e => e.compte_cgnc?.startsWith("2") && !e.compte_cgnc?.startsWith("28")).reduce((s, e) => s + e.debit - e.credit, 0);
  const actifCirc = ecritures.filter(e => e.compte_cgnc?.startsWith("3")).reduce((s, e) => s + e.debit - e.credit, 0);
  const tresorerie = ecritures.filter(e => e.compte_cgnc?.startsWith("5")).reduce((s, e) => s + e.debit - e.credit, 0) + dossier.solde_banque_initial + dossier.solde_caisse_initial;
  const totalActif = actifImmob + actifCirc + tresorerie;
  const capitaux = dossier.capital_social + resultat;
  const dettes = ecritures.filter(e => e.compte_cgnc?.startsWith("4")).reduce((s, e) => s + e.credit - e.debit, 0) + dossier.dettes_fournisseurs_initiales;
  const totalPassif = capitaux + dettes;

  return (
    <div>
      {/* Top breadcrumb */}
      <div className="flex items-center gap-2 mb-5 text-[12.5px]">
        <Link href="/comptable-pro/dossiers" className="flex items-center gap-1 text-[#6B7280] hover:text-[#C8924A] transition-colors">
          <ChevronLeft size={14} /> Mes dossiers
        </Link>
        <span className="text-[#D1D5DB]">/</span>
        <span className="font-semibold text-[#1A1A2E]">{dossier.raison_sociale}</span>
        {dossier.ice && <span className="text-[11px] text-[#9CA3AF]">ICE: {dossier.ice}</span>}
        <span className={`ml-1 text-[10.5px] font-medium px-2 py-0.5 rounded-full ${
          dossier.regime_tva === "mensuel" ? "bg-[#EFF6FF] text-[#1D4ED8]" : dossier.regime_tva === "trimestriel" ? "bg-[#FEF3C7] text-[#92400E]" : "bg-[#F3F4F6] text-[#6B7280]"
        }`}>
          TVA {dossier.regime_tva}
        </span>
      </div>

      {/* Tabs */}
      <div className="tabs mb-6 overflow-x-auto flex-nowrap">
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => switchTab(key as TabKey)}
            className={`tab whitespace-nowrap ${activeTab === key ? "active" : ""}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ─── TAB: TABLEAU DE BORD ─── */}
      {activeTab === "dashboard" && (
        <div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-6">
            <div className="kpi">
              <div className="kpi-label">Chiffre d'affaires</div>
              <div className="kpi-value text-[20px]">{fmtMAD(allProduits)}</div>
              <div className="text-[11px] text-[#6B7280]">Tous comptes 7xxx</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Charges totales</div>
              <div className="kpi-value text-[20px]">{fmtMAD(allCharges)}</div>
              <div className="text-[11px] text-[#6B7280]">Tous comptes 6xxx</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Résultat net</div>
              <div className="kpi-value text-[20px]" style={{ color: resultat >= 0 ? "#059669" : "#DC2626" }}>
                {fmtMAD(resultat)}
              </div>
              <div className="text-[11px] text-[#6B7280]">Produits — Charges</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Trésorerie</div>
              <div className="kpi-value text-[20px]">{fmtMAD(banqueTotal)}</div>
              <div className="text-[11px] text-[#6B7280]">Comptes 514x + init.</div>
            </div>
          </div>

          {ecritures.length === 0 ? (
            <div className="text-center py-12 card">
              <FileText size={32} className="text-[#D1D5DB] mx-auto mb-3" />
              <p className="text-[13px] text-[#6B7280] mb-1">Aucune écriture comptable</p>
              <p className="text-[12px] text-[#9CA3AF] mb-4">Commencez par saisir les écritures dans l'onglet Saisie</p>
              <button onClick={() => switchTab("saisie")} className="btn btn-gold btn-sm">Aller à la saisie →</button>
            </div>
          ) : (
            <div className="tbl">
              <div className="tbl-header">
                <span className="tbl-title">Dernières écritures</span>
                <button onClick={() => switchTab("saisie")} className="btn btn-outline btn-sm">Voir tout →</button>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Journal</th>
                    <th>Compte</th>
                    <th>Libellé</th>
                    <th className="text-right">Débit</th>
                    <th className="text-right">Crédit</th>
                  </tr>
                </thead>
                <tbody>
                  {[...ecritures].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10).map(e => (
                    <tr key={e.id}>
                      <td className="text-[11.5px] text-[#6B7280]">{new Date(e.date).toLocaleDateString("fr-MA", { day: "numeric", month: "short" })}</td>
                      <td><span className="tag tag-blue">{e.journal}</span></td>
                      <td className="font-mono text-[12px]">{e.compte_cgnc || "—"}</td>
                      <td>{e.libelle}</td>
                      <td className="text-right text-[12px]">{e.debit > 0 ? fmt(e.debit) : ""}</td>
                      <td className="text-right text-[12px]">{e.credit > 0 ? fmt(e.credit) : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB: SAISIE ─── */}
      {activeTab === "saisie" && (
        <div>
          {/* Controls */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-[#6B7280]">Période:</span>
              <input type="month" value={period} onChange={e => setPeriod(e.target.value)}
                className="input py-1 text-[12.5px] w-[140px]" />
            </div>
            <div className="flex items-center gap-1.5 bg-[#F3F4F6] p-1 rounded-xl">
              {(["VT", "AC", "BQ", "CA", "OD"] as JournalCode[]).map(j => (
                <button key={j} onClick={() => setJournal(j)}
                  className={`px-3 py-1 rounded-lg text-[12px] font-medium transition-all ${
                    journal === j ? "bg-[#0D1526] text-white shadow-sm" : "text-[#6B7280] hover:text-[#1A1A2E]"
                  }`}>
                  {j}
                </button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-2">
              {rows.some(r => r.debit || r.credit) && (
                isBalanced
                  ? <span className="text-[11.5px] text-[#059669] bg-[#D1FAE5] px-2.5 py-1 rounded-lg flex items-center gap-1"><CheckCircle size={12} /> Équilibré</span>
                  : <span className="text-[11.5px] text-[#DC2626] bg-[#FEE2E2] px-2.5 py-1 rounded-lg flex items-center gap-1"><AlertTriangle size={12} /> Déséquil. {fmtMAD(Math.abs(totalDebit - totalCredit))}</span>
              )}
              <button onClick={saveEcritures} disabled={saving} className="btn btn-gold">
                <Save size={13} /> {saving ? "Sauvegarde..." : "Sauvegarder"}
              </button>
            </div>
          </div>

          {/* Journal table */}
          <div className="tbl overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 120 }}>Date</th>
                  <th style={{ width: 110 }}>N° Pièce</th>
                  <th style={{ width: 160 }}>Compte CGNC</th>
                  <th>Libellé</th>
                  <th style={{ width: 110, textAlign: "right" }}>Débit</th>
                  <th style={{ width: 110, textAlign: "right" }}>Crédit</th>
                  <th style={{ width: 36 }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={idx} style={{ backgroundColor: row._saved ? "rgba(0,0,0,0.01)" : undefined }}>
                    {(["date", "numero_piece", "compte_cgnc", "libelle", "debit", "credit"] as ColKey[]).map(col => (
                      <td key={col} className="p-0" style={{ textAlign: col === "debit" || col === "credit" ? "right" : undefined }}>
                        {col === "compte_cgnc" ? (
                          <>
                            <input
                              ref={el => { inputRefs.current[`${idx}-${col}`] = el; }}
                              list={`cgnc-list-${idx}`}
                              value={row[col]}
                              placeholder="3421"
                              onChange={e => updateRow(idx, col, e.target.value)}
                              onKeyDown={e => handleKeyDown(e, idx, col)}
                              className="w-full border-none bg-transparent outline-none text-[12px] px-3 py-[9px] focus:bg-[#FFFBF5] font-mono"
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
                            placeholder={col === "libelle" ? "Description..." : col === "numero_piece" ? "Réf." : col === "debit" || col === "credit" ? "0" : ""}
                            min={col === "debit" || col === "credit" ? "0" : undefined}
                            step={col === "debit" || col === "credit" ? "0.01" : undefined}
                            onChange={e => updateRow(idx, col, e.target.value)}
                            onKeyDown={e => handleKeyDown(e, idx, col)}
                            className={`w-full border-none bg-transparent outline-none text-[12px] px-3 py-[9px] focus:bg-[#FFFBF5] ${
                              col === "debit" || col === "credit" ? "text-right" : ""
                            }`}
                          />
                        )}
                      </td>
                    ))}
                    <td className="p-0 text-center">
                      {!row._saved && (
                        <button onClick={() => deleteRow(idx)}
                          className="text-[#9CA3AF] hover:text-[#DC2626] transition-colors p-2">
                          <Trash2 size={12} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ backgroundColor: "#F0EDE5" }}>
                  <td colSpan={4} className="px-3 py-2">
                    <button onClick={() => addRow()} className="text-[#C8924A] hover:underline text-[12px] font-medium flex items-center gap-1">
                      <Plus size={12} /> Ajouter une ligne
                    </button>
                  </td>
                  <td className="text-right font-bold text-[12.5px] px-3 py-2">{totalDebit > 0 ? fmt(totalDebit) : ""}</td>
                  <td className="text-right font-bold text-[12.5px] px-3 py-2">{totalCredit > 0 ? fmt(totalCredit) : ""}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="text-[11px] text-[#9CA3AF] mt-2">
            Tab → cellule suivante · Entrée → nouvelle ligne · Suppr → supprimer la ligne
          </p>
        </div>
      )}

      {/* ─── TAB: FACTURES CLIENTS ─── */}
      {activeTab === "factures" && (
        <div className="text-center py-16 card">
          <FileText size={36} className="text-[#D1D5DB] mx-auto mb-3" />
          <p className="text-[13px] font-medium text-[#6B7280] mb-1">Factures clients de {dossier.raison_sociale}</p>
          <p className="text-[12px] text-[#9CA3AF] mb-4">
            Créez et gérez les factures depuis le module Factures — filtrez par client pour isoler ce dossier.
          </p>
          <button onClick={() => switchTab("saisie")} className="btn btn-outline btn-sm mr-2">
            Saisir une écriture
          </button>
        </div>
      )}

      {/* ─── TAB: ACHATS FOURNISSEURS ─── */}
      {activeTab === "achats" && (
        <div className="text-center py-16 card">
          <FileText size={36} className="text-[#D1D5DB] mx-auto mb-3" />
          <p className="text-[13px] font-medium text-[#6B7280] mb-1">Achats fournisseurs de {dossier.raison_sociale}</p>
          <p className="text-[12px] text-[#9CA3AF] mb-4">
            Importez et gérez les factures fournisseurs dans la Boîte de réception — les écritures se créent automatiquement.
          </p>
          <button onClick={() => switchTab("saisie")} className="btn btn-gold btn-sm">
            Saisir manuellement →
          </button>
        </div>
      )}

      {/* ─── TAB: DÉCLARATION TVA ─── */}
      {activeTab === "tva" && (
        <div>
          <div className="flex items-center gap-3 mb-5">
            <span className="text-[12px] text-[#6B7280]">Période:</span>
            <input type="month" value={period} onChange={e => setPeriod(e.target.value)}
              className="input py-1 text-[12.5px] w-[140px]" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
            <div className="kpi">
              <div className="kpi-label">TVA collectée</div>
              <div className="kpi-value text-[20px]">{fmtMAD(tvaCollectee)}</div>
              <div className="text-[11px] text-[#6B7280]">Compte 4455</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">TVA déductible</div>
              <div className="kpi-value text-[20px]">{fmtMAD(tvaDeductible)}</div>
              <div className="text-[11px] text-[#6B7280]">Comptes 3453 / 4456</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Net à payer</div>
              <div className="kpi-value text-[20px]" style={{ color: netDu > 0 ? "#DC2626" : "#059669" }}>
                {fmtMAD(netDu)}
              </div>
              <div className="text-[11px] text-[#6B7280]">Collectée — Déductible</div>
            </div>
          </div>

          {tvaData ? (
            <div className="card p-4 border-[#D1FAE5] bg-[#F0FDF4]">
              <div className="flex items-center gap-2 text-[#059669]">
                <CheckCircle size={16} />
                <span className="text-[13px] font-semibold">Déclaration déposée</span>
                {tvaData.date_depot && <span className="text-[12px]">le {new Date(tvaData.date_depot).toLocaleDateString("fr-MA")}</span>}
              </div>
            </div>
          ) : (
            <div className="card p-4 border-[#FDE68A] bg-[#FFFBEB]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[#92400E]">
                  <AlertTriangle size={16} />
                  <span className="text-[13px] font-semibold">Déclaration à déposer avant le 20 du mois suivant</span>
                </div>
                <button
                  onClick={async () => {
                    const { data: { user } } = await supabase.auth.getUser();
                    await supabase.from("dossier_tva").upsert({
                      dossier_id: dossier.id,
                      fiduciaire_user_id: user!.id,
                      periode: period,
                      tva_collectee: tvaCollectee,
                      tva_deductible: tvaDeductible,
                      net_du: netDu,
                      statut: "deposee",
                      date_depot: new Date().toISOString(),
                    }, { onConflict: "dossier_id,periode" });
                    setTvaData({ id: "", dossier_id: dossier.id, periode: period, tva_collectee: tvaCollectee, tva_deductible: tvaDeductible, net_du: netDu, statut: "deposee", date_depot: new Date().toISOString(), created_at: "" });
                    toast.success("Déclaration marquée comme déposée");
                  }}
                  className="btn btn-gold btn-sm">
                  Marquer comme déposée
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB: PAIE ─── */}
      {activeTab === "paie" && (
        <div className="text-center py-16 card">
          <Banknote size={36} className="text-[#D1D5DB] mx-auto mb-3" />
          <p className="text-[13px] font-medium text-[#6B7280] mb-1">Paie de {dossier.raison_sociale}</p>
          <p className="text-[12px] text-[#9CA3AF] mb-4">
            Gérez les employés et bulletins de paie depuis le module La Paie.
          </p>
          <Link href="/paie" className="btn btn-gold btn-sm">Aller à La Paie →</Link>
        </div>
      )}

      {/* ─── TAB: BILAN / CPC ─── */}
      {activeTab === "bilan" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* CPC */}
          <div className="tbl">
            <div className="tbl-header"><span className="tbl-title">Compte de Produits et Charges (CPC)</span></div>
            <table>
              <tbody>
                <tr style={{ backgroundColor: "#F0FDF4" }}>
                  <td colSpan={2} className="font-semibold text-[#059669] text-[12px]">PRODUITS D'EXPLOITATION</td>
                </tr>
                {cpcData.map(row => (
                  <tr key={row.label}>
                    <td className="text-[12px]">{row.label}</td>
                    <td className="text-right font-medium text-[12px]">{row.montant > 0 ? fmtMAD(row.montant) : "—"}</td>
                  </tr>
                ))}
                <tr style={{ backgroundColor: "#F0FDF4" }}>
                  <td className="font-semibold text-[12.5px]">Total Produits</td>
                  <td className="text-right font-bold text-[#059669] text-[12.5px]">{fmtMAD(allProduits)}</td>
                </tr>
                <tr style={{ backgroundColor: "#FEF2F2" }}>
                  <td colSpan={2} className="font-semibold text-[#DC2626] text-[12px] pt-3">CHARGES D'EXPLOITATION</td>
                </tr>
                {chargesData.map(row => (
                  <tr key={row.label}>
                    <td className="text-[12px]">{row.label}</td>
                    <td className="text-right font-medium text-[12px]">{row.montant > 0 ? fmtMAD(row.montant) : "—"}</td>
                  </tr>
                ))}
                <tr style={{ backgroundColor: "#FEF2F2" }}>
                  <td className="font-semibold text-[12.5px]">Total Charges</td>
                  <td className="text-right font-bold text-[#DC2626] text-[12.5px]">{fmtMAD(allCharges)}</td>
                </tr>
                <tr style={{ backgroundColor: resultat >= 0 ? "#D1FAE5" : "#FEE2E2" }}>
                  <td className="font-bold text-[13px] py-3">RÉSULTAT NET</td>
                  <td className={`text-right font-bold text-[14px] py-3 ${resultat >= 0 ? "text-[#059669]" : "text-[#DC2626]"}`}>
                    {fmtMAD(resultat)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Bilan simplifié */}
          <div className="tbl">
            <div className="tbl-header"><span className="tbl-title">Bilan simplifié</span></div>
            <table>
              <tbody>
                <tr style={{ backgroundColor: "#EFF6FF" }}>
                  <td colSpan={2} className="font-semibold text-[#1D4ED8] text-[12px]">ACTIF</td>
                </tr>
                <tr>
                  <td className="text-[12px]">Immobilisations (2xxx)</td>
                  <td className="text-right font-medium text-[12px]">{actifImmob > 0 ? fmtMAD(actifImmob) : "—"}</td>
                </tr>
                <tr>
                  <td className="text-[12px]">Actif circulant (3xxx)</td>
                  <td className="text-right font-medium text-[12px]">{actifCirc > 0 ? fmtMAD(actifCirc) : "—"}</td>
                </tr>
                <tr>
                  <td className="text-[12px]">Trésorerie (5xxx)</td>
                  <td className="text-right font-medium text-[12px]">{fmtMAD(tresorerie)}</td>
                </tr>
                <tr style={{ backgroundColor: "#EFF6FF" }}>
                  <td className="font-semibold text-[12.5px]">Total Actif</td>
                  <td className="text-right font-bold text-[#1D4ED8] text-[12.5px]">{fmtMAD(totalActif)}</td>
                </tr>
                <tr style={{ backgroundColor: "#F0FDF4" }}>
                  <td colSpan={2} className="font-semibold text-[#059669] text-[12px] pt-3">PASSIF</td>
                </tr>
                <tr>
                  <td className="text-[12px]">Capital social + Résultat</td>
                  <td className="text-right font-medium text-[12px]">{fmtMAD(capitaux)}</td>
                </tr>
                <tr>
                  <td className="text-[12px]">Dettes (4xxx)</td>
                  <td className="text-right font-medium text-[12px]">{dettes > 0 ? fmtMAD(dettes) : "—"}</td>
                </tr>
                <tr style={{ backgroundColor: "#F0FDF4" }}>
                  <td className="font-semibold text-[12.5px]">Total Passif</td>
                  <td className="text-right font-bold text-[#059669] text-[12.5px]">{fmtMAD(totalPassif)}</td>
                </tr>
              </tbody>
            </table>
            <div className={`mx-4 my-3 p-2.5 rounded-lg text-[11.5px] font-medium text-center ${
              Math.abs(totalActif - totalPassif) < 1 ? "bg-[#D1FAE5] text-[#059669]" : "bg-[#FEE2E2] text-[#DC2626]"
            }`}>
              {Math.abs(totalActif - totalPassif) < 1 ? "Bilan équilibré ✓" : `Écart: ${fmtMAD(Math.abs(totalActif - totalPassif))}`}
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB: DOCUMENTS ─── */}
      {activeTab === "documents" && (
        <div className="text-center py-16 card">
          <FolderOpen size={36} className="text-[#D1D5DB] mx-auto mb-3" />
          <p className="text-[13px] font-medium text-[#6B7280] mb-1">Documents de {dossier.raison_sociale}</p>
          <p className="text-[12px] text-[#9CA3AF]">
            Les documents importés dans la Boîte de réception apparaîtront ici.
          </p>
        </div>
      )}

      {/* ─── TAB: EXPORT CGNC ─── */}
      {activeTab === "export" && (
        <div>
          <div className="card p-5 mb-4">
            <h2 className="text-[14px] font-semibold text-[#1A1A2E] mb-4">Exporter les données de {dossier.raison_sociale}</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-5">
              {["Journal des ventes", "Journal des achats", "Grand livre", "Balance comptable", "Déclaration TVA", "Bilan + CPC"].map(doc => (
                <label key={doc} className="flex items-center gap-2.5 p-3 rounded-xl border border-[rgba(0,0,0,0.07)] cursor-pointer hover:border-[#C8924A] bg-white transition-all">
                  <input type="checkbox" defaultChecked className="accent-[#C8924A]" />
                  <span className="text-[12.5px] text-[#1A1A2E]">{doc}</span>
                </label>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <div>
                <label className="block text-[12px] font-medium text-[#374151] mb-1">Période</label>
                <input type="month" className="input" defaultValue={period} />
              </div>
              <div className="mt-5">
                <button className="btn btn-gold gap-2">
                  <Download size={14} /> Générer l'export ZIP
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
