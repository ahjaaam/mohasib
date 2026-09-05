"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Users, Plus, FileText, Upload, Download, X, Loader2, CheckCircle, AlertCircle, Info, ArrowDown, ArrowUp, Search, LayoutGrid, Rows3 } from "lucide-react";
import type { Client } from "@/types";
import ClientModal from "./ClientModal";
import * as XLSX from "xlsx";
import { useAccountOwnerId } from "@/hooks/useAccountOwner";
import { compareValues, nextSort, type SortDirection } from "@/components/SortableTh";

type InvoiceRow = {
  id: string;
  invoice_number: string;
  total: number;
  status: string;
  issue_date: string;
  due_date: string | null;
  updated_at: string;
};

type ClientWithStats = Client & {
  _invoices: InvoiceRow[];
  _ca: number;
  _count: number;
  _avgDelay: number | null;
  _overdueCount: number;
};

type ClientSortKey = "name" | "city" | "ca" | "count" | "delay" | "overdue";
type ClientViewMode = "cards" | "rows";

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function fmtCA(n: number): string {
  return n.toLocaleString("fr-MA", { maximumFractionDigits: 0 }) + " MAD";
}

function calcStats(invoices: InvoiceRow[]) {
  const nonDraft = invoices.filter((i) => i.status !== "draft");
  const ca = nonDraft.reduce((sum, i) => sum + Number(i.total), 0);
  const count = invoices.length;

  // Average payment delay: use updated_at - issue_date as proxy for paid invoices
  const paid = invoices.filter((i) => i.status === "paid");
  let avgDelay: number | null = null;
  if (paid.length > 0) {
    const total = paid.reduce((sum, i) => {
      const days = Math.max(
        0,
        Math.round(
          (new Date(i.updated_at).getTime() - new Date(i.issue_date).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      );
      return sum + days;
    }, 0);
    avgDelay = Math.round(total / paid.length);
  }

  const overdueCount = invoices.filter((i) => i.status === "overdue").length;
  return { ca, count, avgDelay, overdueCount };
}

function delayColor(days: number): string {
  if (days < 30) return "text-[#059669]";
  if (days <= 45) return "text-[#D97706]";
  return "text-[#DC2626]";
}

// ── Excel import helpers ───────────────────────────────────────────────────────

const SAMPLE_COLUMNS = ["Nom *", "Email", "Téléphone", "Adresse", "Ville", "Code postal", "ICE", "RC", "Notes"];
const SAMPLE_ROWS = [
  ["Société Exemple SARL", "contact@exemple.ma", "0661000000", "123 Rue Mohammed V", "Casablanca", "20000", "002345678000045", "RC-12345", "Client premium"],
  ["Entreprise Test SA",   "info@test.ma",       "0522000000", "Bd Zerktouni 45",    "Rabat",      "10000", "",                "",         ""],
];

function downloadSample() {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([SAMPLE_COLUMNS, ...SAMPLE_ROWS]);
  ws["!cols"] = SAMPLE_COLUMNS.map((_, i) => ({ wch: [30, 28, 15, 30, 15, 12, 18, 14, 25][i] }));
  XLSX.utils.book_append_sheet(wb, ws, "Clients");
  XLSX.writeFile(wb, "modele-import-clients.xlsx");
}

interface ImportRow { name: string; email?: string; phone?: string; address?: string; city?: string; postal_code?: string; ice?: string; rc?: string; notes?: string; }
interface ImportResult { added: number; skipped: number; errors: string[] }

function parseExcel(file: File): Promise<ImportRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target!.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: "" }) as string[][];
        if (rows.length < 2) { resolve([]); return; }
        // skip header row
        const parsed: ImportRow[] = rows.slice(1)
          .filter((r) => r[0]?.toString().trim())
          .map((r) => ({
            name:        r[0]?.toString().trim(),
            email:       r[1]?.toString().trim() || undefined,
            phone:       r[2]?.toString().trim() || undefined,
            address:     r[3]?.toString().trim() || undefined,
            city:        r[4]?.toString().trim() || undefined,
            postal_code: r[5]?.toString().trim() || undefined,
            ice:         r[6]?.toString().trim() || undefined,
            rc:          r[7]?.toString().trim() || undefined,
            notes:       r[8]?.toString().trim() || undefined,
          }));
        resolve(parsed);
      } catch (err: any) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ClientsPage({ dossierId: propDossierId }: { dossierId?: string } = {}) {
  const ownerId = useAccountOwnerId();
  const [clients, setClients] = useState<ClientWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string>("");
  const [sortKey, setSortKey] = useState<ClientSortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [viewMode, setViewMode] = useState<ClientViewMode>("rows");

  function selectViewMode(mode: ClientViewMode) {
    setViewMode(mode);
  }

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);

  // Import state
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importModal, setImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const searchParams = useSearchParams();
  const dossierId = propDossierId ?? searchParams.get("dossier_id");
  const requestedSearch = searchParams.get("search") ?? "";
  const [searchState, setSearchState] = useState({ source: requestedSearch, value: requestedSearch });
  const search = searchState.source === requestedSearch ? searchState.value : requestedSearch;
  const setSearch = (value: string) => setSearchState({ source: requestedSearch, value });
  const supabase = useMemo(() => createClient(), []);

  async function handleImportFile(file: File) {
    setImportFile(file);
    setImportResult(null);
    try {
      const rows = await parseExcel(file);
      setImportPreview(rows);
      setImportModal(true);
    } catch {
      setImportPreview([]);
      setImportModal(true);
    }
  }

  async function runImport() {
    if (!importPreview.length) return;
    setImporting(true);
    let added = 0;
    const errors: string[] = [];

    for (const row of importPreview) {
      const { error } = await supabase.from("clients").insert({
        user_id: userId,
        ...(dossierId ? { dossier_id: dossierId } : {}),
        name: row.name,
        email: row.email ?? null,
        phone: row.phone ?? null,
        address: row.address ?? null,
        city: row.city ?? null,
        postal_code: row.postal_code ?? null,
        ice: row.ice ?? null,
        rc: row.rc ?? null,
        notes: row.notes ?? null,
      });
      if (error) errors.push(`${row.name}: ${error.message}`);
      else added++;
    }

    setImporting(false);
    setImportResult({ added, skipped: 0, errors });
    if (added > 0) await load();
  }

  function closeImport() {
    setImportModal(false);
    setImportFile(null);
    setImportPreview([]);
    setImportResult(null);
    if (importInputRef.current) importInputRef.current.value = "";
  }

  const load = useCallback(async () => {
    setLoading(true);
    setClients([]);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setClients([]);
      setLoading(false);
      return;
    }
    setUserId(ownerId);

    const query = supabase
      .from("clients")
      .select(`*, invoices(id, invoice_number, total, status, issue_date, due_date, updated_at)`);
    const { data } = await (dossierId
      ? query.eq("dossier_id", dossierId)
      : query.eq("user_id", ownerId).is("dossier_id", null))
      .order("name");

    const rows: ClientWithStats[] = (data ?? []).map((c: any) => {
      const invoices: InvoiceRow[] = c.invoices ?? [];
      const { ca, count, avgDelay, overdueCount } = calcStats(invoices);
      return { ...c, _invoices: invoices, _ca: ca, _count: count, _avgDelay: avgDelay, _overdueCount: overdueCount };
    });

    setClients(rows);
    setLoading(false);
  }, [dossierId, ownerId, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  // Topbar "+ Nouveau client" button dispatches this event
  useEffect(() => {
    const handler = () => {
      setEditClient(null);
      setModalOpen(true);
    };
    document.addEventListener("open-add-client", handler);
    return () => document.removeEventListener("open-add-client", handler);
  }, []);

  function openAdd() {
    setEditClient(null);
    setModalOpen(true);
  }

  function openEdit(c: Client) {
    setEditClient(c);
    setModalOpen(true);
  }

  function handleSort(nextKey: ClientSortKey) {
    const next = nextSort(sortKey, sortDirection, nextKey);
    setSortKey(next.key);
    setSortDirection(next.direction);
  }

  const sortedClients = useMemo(() => {
    const valueFor = (client: ClientWithStats, key: ClientSortKey): string | number | null => {
      switch (key) {
        case "name": return client.name;
        case "city": return client.city ?? "";
        case "ca": return client._ca;
        case "count": return client._count;
        case "delay": return client._avgDelay ?? 99999;
        case "overdue": return client._overdueCount;
        default: return "";
      }
    };
    const normalizedSearch = search.trim().toLowerCase();
    return clients
      .filter((client) => {
        if (!normalizedSearch) return true;
        return [
          client.name,
          client.email,
          client.phone,
          client.city,
          client.ice,
          client.rc,
          client.address,
        ].some((value) => value?.toLowerCase().includes(normalizedSearch));
      })
      .sort((a, b) => compareValues(valueFor(a, sortKey), valueFor(b, sortKey), sortDirection));
  }, [clients, search, sortKey, sortDirection]);

  const header = (
    <div className="mb-5 flex flex-col items-stretch justify-between gap-4 xl:flex-row xl:items-center">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(200,146,74,0.12)" }}>
          <Users size={18} className="text-[#C8924A]" />
        </div>
        <div>
          <h1 className="text-[18px] font-bold text-[#1A1A2E] leading-none">Clients</h1>
          <p className="text-[11px] text-[#9CA3AF] mt-0.5">Gérez vos clients et suivez leur activité</p>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center xl:shrink-0">
        <input
          ref={importInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportFile(f); }}
        />
        <div className="relative flex flex-col sm:flex-row">
          <div className="group absolute right-3 top-1/2 -translate-y-1/2 sm:right-full sm:mr-2">
            <button className="w-5 h-5 flex items-center justify-center rounded-full text-[#9CA3AF] hover:text-[#6B7280] transition-colors">
              <Info size={14} />
            </button>
            <div className="absolute left-0 top-7 z-50 w-72 bg-[#1A1A2E] text-white text-[11.5px] rounded-xl px-3.5 py-3 shadow-xl leading-relaxed pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">
              <p className="font-semibold mb-1.5 text-[#C8924A]">Colonnes acceptées (dans l&apos;ordre)</p>
              <p className="font-mono text-[11px] text-[#E5E7EB]">Nom *, Email, Téléphone, Adresse, Ville, Code postal, ICE, RC, Notes</p>
              <p className="mt-2 text-[#9CA3AF]">Seule la colonne <span className="text-white font-semibold">Nom</span> est obligatoire. Les cellules vides sont ignorées.</p>
              <div className="absolute -top-1.5 left-2 w-3 h-3 bg-[#1A1A2E] rotate-45 rounded-sm" />
            </div>
          </div>
          <button
            data-auth-required="import clients"
            onClick={() => importInputRef.current?.click()}
            className="inline-flex h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg border px-3.5 text-[12px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C8924A] sm:h-9 sm:w-auto border-[#D7DADF] bg-white text-[#374151] hover:border-[#B8BEC8] hover:bg-[#F8F9FB] px-10 sm:px-3.5"
          >
            <Upload size={15} strokeWidth={1.75} aria-hidden="true" /> Importer Excel
          </button>
        </div>
        <button data-permission="invoice:create" onClick={openAdd} className="inline-flex h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg border px-3.5 text-[12px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C8924A] sm:h-9 sm:w-auto border-[#111621] bg-[#111621] text-white hover:border-[#25334B] hover:bg-[#25334B]">
          <Plus size={15} strokeWidth={1.75} aria-hidden="true" /> Nouveau client
        </button>
      </div>
    </div>
  );

  if (loading)
    return (
      <div>
        {header}
        <div className="loading-state">Chargement des clients…</div>
      </div>
    );

  if (clients.length === 0)
    return (
      <>
        <ClientModal
          userId={userId}
          dossierId={dossierId}
          client={null}
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onSaved={load}
        />
        {header}
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Users size={36} className="mb-3 text-[#9CA3AF]" aria-hidden="true" />
          <p className="text-[#6B7280] font-medium text-[13px] mb-1">
            Aucun client pour l&apos;instant
          </p>
          <p className="text-[11.5px] text-[#9CA3AF] mb-4">
            Ajoutez vos clients pour les associer à vos factures.
          </p>
          <button data-permission="invoice:create" onClick={openAdd} className="btn btn-gold">
            + Nouveau client
          </button>
        </div>
      </>
    );

  return (
    <>
      <ClientModal
        userId={userId}
        dossierId={dossierId}
        client={editClient}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={load}
        onDeleted={load}
      />

      {/* ── Import modal ── */}
      {importModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.45)" }} onClick={closeImport}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[15px] font-bold text-[#1A1A2E]">Importer des clients</h2>
              <button onClick={closeImport} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F3F4F6] text-[#6B7280]">
                <X size={15} />
              </button>
            </div>

            {/* Download sample */}
            <button
              onClick={downloadSample}
              className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg border border-dashed border-[rgba(200,146,74,0.4)] text-[12.5px] text-[#C8924A] hover:bg-[rgba(200,146,74,0.04)] transition-colors mb-4"
            >
              <Download size={13} />
              Télécharger le modèle Excel (.xlsx)
            </button>

            {/* Result */}
            {importResult ? (
              <div className="flex flex-col gap-2">
                {importResult.added > 0 && (
                  <div className="flex items-center gap-2 text-[13px] text-[#059669] bg-[#D1FAE5] rounded-lg px-3 py-2.5">
                    <CheckCircle size={14} />
                    {importResult.added} client{importResult.added > 1 ? "s" : ""} importé{importResult.added > 1 ? "s" : ""} avec succès
                  </div>
                )}
                {importResult.errors.map((e, i) => (
                  <div key={i} className="flex items-start gap-2 text-[12px] text-[#DC2626] bg-[#FEE2E2] rounded-lg px-3 py-2">
                    <AlertCircle size={13} className="mt-0.5 flex-shrink-0" /> {e}
                  </div>
                ))}
                <button onClick={closeImport} className="btn btn-gold mt-2">Fermer</button>
              </div>
            ) : (
              <>
                {/* Preview table */}
                {importPreview.length === 0 ? (
                  <p className="text-[12.5px] text-[#DC2626] bg-[#FEE2E2] rounded-lg px-3 py-2.5">
                    Aucune ligne valide trouvée. Vérifiez que la colonne &quot;Nom&quot; est renseignée.
                  </p>
                ) : (
                  <>
                    <p className="text-[12px] text-[#6B7280] mb-2">{importPreview.length} client{importPreview.length > 1 ? "s" : ""} détecté{importPreview.length > 1 ? "s" : ""} — aperçu :</p>
                    <div className="border border-[rgba(0,0,0,0.08)] rounded-lg overflow-hidden mb-4 max-h-52 overflow-y-auto">
                      <table className="w-full text-[11.5px]">
                        <thead className="bg-[#F9F9F6] sticky top-0">
                          <tr>
                            {["Nom", "Email", "Téléphone", "Ville", "ICE"].map((h) => (
                              <th key={h} className="px-3 py-2 text-left font-semibold text-[#6B7280] text-[10.5px] uppercase tracking-[0.4px]">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {importPreview.map((r, i) => (
                            <tr key={i} className={i % 2 === 1 ? "bg-[#FAFAFA]" : ""}>
                              <td className="px-3 py-1.5 font-medium text-[#1A1A2E]">{r.name}</td>
                              <td className="px-3 py-1.5 text-[#6B7280]">{r.email ?? "—"}</td>
                              <td className="px-3 py-1.5 text-[#6B7280]">{r.phone ?? "—"}</td>
                              <td className="px-3 py-1.5 text-[#6B7280]">{r.city ?? "—"}</td>
                              <td className="px-3 py-1.5 text-[#6B7280]">{r.ice ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={closeImport} className="btn btn-outline flex-1">Annuler</button>
                      <button data-permission="invoice:create" onClick={runImport} disabled={importing} className="btn btn-gold flex-1 flex items-center justify-center gap-1.5 disabled:opacity-60">
                        {importing ? <><Loader2 size={13} className="animate-spin" /> Importation...</> : <><CheckCircle size={13} /> Importer {importPreview.length} client{importPreview.length > 1 ? "s" : ""}</>}
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {header}

      <div className="relative mb-3 max-w-[380px]">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8A909B]" />
        <input
          className="input w-full pl-9"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Rechercher par nom, ICE, ville, email…"
        />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#6B7280]">Trier par</span>
        {([
          ["name", "Nom"],
          ["city", "Ville"],
          ["ca", "CA"],
          ["count", "Factures"],
          ["delay", "Délai"],
          ["overdue", "Retards"],
        ] as [ClientSortKey, string][]).map(([key, label]) => {
          const active = sortKey === key;
          const Icon = sortDirection === "asc" ? ArrowUp : ArrowDown;
          return (
            <button
              key={key}
              type="button"
              onClick={() => handleSort(key)}
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11.5px] font-semibold transition ${
                active
                  ? "border-[#C8924A]/40 bg-[#FFF7ED] text-[#C8924A]"
                  : "border-[rgba(0,0,0,0.16)] bg-[#FAFAF6] text-[#6B7280] shadow-[0_1px_2px_rgba(13,21,38,0.05)] hover:border-[#C8924A]/30 hover:bg-[#F0EDE5] hover:text-[#C8924A]"
              }`}
            >
              {label}
              {active && <Icon size={11} />}
            </button>
          );
        })}
        <div className="ui-control ml-auto flex h-8 items-center border border-[rgba(0,0,0,0.16)] bg-[#F1F2F3] p-0.5" aria-label="Mode d’affichage">
          <button
            type="button"
            onClick={() => selectViewMode("cards")}
            aria-label="Afficher en cartes"
            aria-pressed={viewMode === "cards"}
            title="Vue cartes"
            className={`flex h-7 w-8 items-center justify-center transition-colors ${viewMode === "cards" ? "bg-white text-[#C8924A] shadow-sm" : "text-[#777E8B] hover:text-[#1A1A2E]"}`}
          >
            <LayoutGrid size={14} />
          </button>
          <button
            type="button"
            onClick={() => selectViewMode("rows")}
            aria-label="Afficher horizontalement"
            aria-pressed={viewMode === "rows"}
            title="Vue horizontale"
            className={`flex h-7 w-8 items-center justify-center transition-colors ${viewMode === "rows" ? "bg-white text-[#C8924A] shadow-sm" : "text-[#777E8B] hover:text-[#1A1A2E]"}`}
          >
            <Rows3 size={14} />
          </button>
        </div>
      </div>

      {sortedClients.length === 0 ? (
        <div className="border border-[rgba(0,0,0,0.08)] bg-white px-5 py-12 text-center text-[12.5px] text-[#6B7280]">
          Aucun client ne correspond à « {search.trim()} ».
        </div>
      ) : (
        <div className={`grid grid-cols-1 gap-2.5 ${viewMode === "cards" ? "sm:grid-cols-2 lg:grid-cols-3" : ""}`}>
          {sortedClients.map((c) => (
          <div
            key={c.id}
            onClick={() => openEdit(c)}
            className={`client-card group relative flex cursor-pointer flex-col overflow-hidden !p-0 transition-all hover:border-[#C8924A]/40 ${viewMode === "rows" ? "md:flex-row md:items-stretch" : ""}`}
          >
            {/* Identity and contact */}
            <div className={`flex min-w-0 gap-3 p-4 ${viewMode === "rows" ? "md:w-[300px] md:flex-shrink-0" : ""}`}>
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center bg-[#0D1526] text-[13px] font-bold text-[#C8924A]">
                {initials(c.name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <div className="truncate text-[13px] font-semibold text-[#1A1A2E]">{c.name}</div>
                  {c._overdueCount > 0 && (
                    <span className="badge-pill flex-shrink-0 bg-[#FEE2E2] px-1.5 py-0.5 text-[10px] font-semibold text-[#DC2626]">
                      {c._overdueCount} en retard
                    </span>
                  )}
                </div>
                <div className="mt-1 space-y-0.5">
                  {c.ice && <div className="truncate text-[11px] text-[#6B7280]">ICE: {c.ice}</div>}
                  {(c.city || c.phone) && <div className="truncate text-[11px] text-[#6B7280]">{[c.city, c.phone].filter(Boolean).join(" · ")}</div>}
                  {c.email && <div className="truncate text-[11px] text-[#6B7280]">{c.email}</div>}
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className={`grid grid-cols-3 gap-4 border-t border-[rgba(0,0,0,0.08)] px-4 py-3 ${viewMode === "rows" ? "md:w-[310px] md:flex-shrink-0 md:border-l md:border-t-0 md:items-center" : ""}`}>
              <div className="text-[11px] text-[#6B7280]">
                <strong className="block text-[12px] text-[#1A1A2E] font-semibold">
                  {fmtCA(c._ca)}
                </strong>
                CA total
              </div>
              <div className="text-[11px] text-[#6B7280]">
                <strong className="block text-[12px] text-[#1A1A2E] font-semibold">
                  {c._count}
                </strong>
                Factures
              </div>
              <div className="text-[11px] text-[#6B7280]">
                <strong
                  className={`block text-[12px] font-semibold ${
                    c._avgDelay !== null ? delayColor(c._avgDelay) : "text-[#1A1A2E]"
                  }`}
                >
                  {c._avgDelay !== null ? `${c._avgDelay}j` : "—"}
                </strong>
                Délai moyen
              </div>
            </div>

            <div className={`min-w-0 flex-1 border-t border-[rgba(0,0,0,0.06)] px-4 py-3 ${viewMode === "rows" ? "md:border-l md:border-t-0" : ""}`}>
              {c._invoices.length > 0 ? (
                <>
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.45px] text-[#9CA3AF]">Factures récentes</div>
                <div className="space-y-1">
                  {[...c._invoices]
                    .sort((a, b) => b.issue_date.localeCompare(a.issue_date))
                    .slice(0, 2)
                    .map((invoice) => (
                      <Link
                        key={invoice.id}
                        href={`/factures/${invoice.id}`}
                        onClick={(event) => event.stopPropagation()}
                        className="flex items-center justify-between text-[11px] text-[#6B7280] hover:text-[#C8924A]"
                      >
                        <span className="font-medium">{invoice.invoice_number}</span>
                        <span>{Number(invoice.total).toLocaleString("fr-MA", { maximumFractionDigits: 2 })} MAD</span>
                      </Link>
                    ))}
                </div>
                </>
              ) : (
                <div className="flex h-full items-center text-[11px] text-[#9CA3AF]">Aucune facture récente</div>
              )}
            </div>

            {/* Actions */}
            <div className={`flex items-center justify-between gap-3 border-t border-[rgba(0,0,0,0.06)] px-4 py-3 ${viewMode === "rows" ? "md:w-[170px] md:flex-shrink-0 md:flex-col md:items-start md:justify-center md:border-l md:border-t-0" : ""}`}>
              <Link
                href={`/factures?q=${encodeURIComponent(c.name)}`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1.5 text-[11.5px] text-[#C8924A] font-medium hover:underline"
              >
                <FileText size={12} />
                Voir les factures {c._count > 0 ? `(${c._count})` : ""}
              </Link>
              <span className="text-[10.5px] font-medium text-[#C8924A] opacity-70 transition-opacity group-hover:opacity-100">
                Modifier →
              </span>
            </div>
          </div>
          ))}
        </div>
      )}
    </>
  );
}
