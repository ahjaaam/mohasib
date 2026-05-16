"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Users, Plus, FileText, Upload, Download, X, Loader2, CheckCircle, AlertCircle, Info } from "lucide-react";
import type { Client } from "@/types";
import ClientModal from "./ClientModal";
import * as XLSX from "xlsx";

type InvoiceRow = {
  id: string;
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
  const [clients, setClients] = useState<ClientWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string>("");

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
  const supabase = createClient();

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
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const query = supabase
      .from("clients")
      .select(`*, invoices(id, total, status, issue_date, due_date, updated_at)`);
    const { data } = await (dossierId
      ? query.eq("dossier_id", dossierId)
      : query.eq("user_id", user.id))
      .order("name");

    const rows: ClientWithStats[] = (data ?? []).map((c: any) => {
      const invoices: InvoiceRow[] = c.invoices ?? [];
      const { ca, count, avgDelay, overdueCount } = calcStats(invoices);
      return { ...c, _invoices: invoices, _ca: ca, _count: count, _avgDelay: avgDelay, _overdueCount: overdueCount };
    });

    setClients(rows);
    setLoading(false);
  }, []);

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

  const header = (
    <div className="flex items-center justify-between gap-3 mb-5">
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
      <div className="flex items-center gap-2">
        <input
          ref={importInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportFile(f); }}
        />
        <div className="flex items-center gap-1">
          <div className="relative group">
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
            onClick={() => importInputRef.current?.click()}
            className="btn btn-outline flex items-center gap-1.5"
          >
            <Upload size={13} /> Importer Excel
          </button>
        </div>
        <button onClick={openAdd} className="btn btn-gold flex items-center gap-1.5">
          <Plus size={13} /> Nouveau client
        </button>
      </div>
    </div>
  );

  if (loading)
    return (
      <div>
        {header}
        <div className="text-[12.5px] text-[#6B7280] py-8 text-center">Chargement...</div>
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
          <div className="text-4xl mb-3">👥</div>
          <p className="text-[#6B7280] font-medium text-[13px] mb-1">
            Aucun client pour l&apos;instant
          </p>
          <p className="text-[11.5px] text-[#9CA3AF] mb-4">
            Ajoutez vos clients pour les associer à vos factures.
          </p>
          <button onClick={openAdd} className="btn btn-gold">
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
                      <button onClick={runImport} disabled={importing} className="btn btn-gold flex-1 flex items-center justify-center gap-1.5 disabled:opacity-60">
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {clients.map((c) => (
          <div
            key={c.id}
            onClick={() => openEdit(c)}
            className="client-card group relative cursor-pointer hover:border-[#C8924A]/40 transition-all"
          >
            {/* Overdue badge */}
            {c._overdueCount > 0 && (
              <span className="absolute top-3 right-3 text-[10px] font-semibold bg-[#FEE2E2] text-[#DC2626] px-1.5 py-0.5 rounded-full">
                {c._overdueCount} en retard
              </span>
            )}

            {/* Avatar */}
            <div className="w-9 h-9 rounded-lg bg-[#0D1526] text-[#C8924A] flex items-center justify-center font-bold text-[13px] mb-2.5 flex-shrink-0">
              {initials(c.name)}
            </div>

            <div className="text-[13px] font-semibold text-[#1A1A2E] mb-0.5 pr-16">{c.name}</div>
            {c.ice && <div className="text-[11px] text-[#6B7280]">ICE: {c.ice}</div>}
            {c.city && <div className="text-[11px] text-[#6B7280]">{c.city}</div>}
            {c.email && <div className="text-[11px] text-[#6B7280]">{c.email}</div>}
            {c.phone && <div className="text-[11px] text-[#6B7280]">{c.phone}</div>}

            {/* Stats */}
            <div className="flex gap-4 mt-2.5 pt-2.5 border-t border-[rgba(0,0,0,0.08)]">
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

            {/* Footer row */}
            <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-[rgba(0,0,0,0.06)]">
              <Link
                href={`/invoices?q=${encodeURIComponent(c.name)}`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1.5 text-[11.5px] text-[#C8924A] font-medium hover:underline"
              >
                <FileText size={12} />
                Voir les factures {c._count > 0 ? `(${c._count})` : ""}
              </Link>
              <span className="text-[10.5px] text-[#C8924A] font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                Modifier →
              </span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
