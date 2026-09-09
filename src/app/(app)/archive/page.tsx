"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import {
  FolderOpen, Receipt, Download, X, Plus, Files,
  Search, Loader2, Building2, FileArchive, FileText, Inbox, UploadCloud,
} from "lucide-react";
import { useAccountOwnerId } from "@/hooks/useAccountOwner";
import { translateError } from "@/lib/errors";
import GoogleDriveIcon from "@/components/GoogleDriveIcon";

// ─── Types ────────────────────────────────────────────────────────────────────

type DocType = "invoice" | "recu" | "company_document";

interface ArchiveDoc {
  id: string;
  name: string;
  type: DocType;
  date: string;
  url: string | null;
  mime_type?: string | null;
  amount?: number;
  subtitle: string;
  client?: string;
  // receipt
  vendor?: string;
  storage_path?: string | null;
  // company doc
  document_category?: string;
  expiration_date?: string | null;
  notes?: string | null;
  archive_id?: string | null;
}

interface NamedArchive {
  id: string;
  name: string;
  created_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

function sourceMeta(doc: ArchiveDoc) {
  if (doc.type === "invoice") {
    return { label: "Facturation", color: "#2563EB", bg: "#EFF6FF", Icon: FileText };
  }
  if (doc.type === "recu") {
    return { label: "Achats", color: "#D97706", bg: "#FFF7ED", Icon: Inbox };
  }
  if (doc.archive_id) {
    return { label: "Google Drive", color: "#2563EB", bg: "#F4F7FB", Icon: GoogleDriveIcon };
  }
  return { label: "Ajout manuel", color: "#6B7280", bg: "#F3F4F6", Icon: UploadCloud };
}

const DOC_CATEGORIES = [
  "Certificat ICE", "RC", "Patente", "Statuts",
  "Contrat", "Attestation", "Relevé bancaire", "Autre",
];

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-MA", { day: "numeric", month: "long", year: "numeric" });
}
function fmtAmt(n: number) { return n.toLocaleString("fr-MA") + " MAD"; }

// ─── Preview panel ────────────────────────────────────────────────────────────

function PreviewPanel({ doc, onClose, onDelete }: {
  doc: ArchiveDoc;
  onClose: () => void;
  onDelete: (doc: ArchiveDoc) => void;
}) {
  const { Icon, label, bg, color } = sourceMeta(doc);
  const isPdf = doc.mime_type?.includes("pdf") || doc.url?.includes(".pdf");
  const isImg = doc.mime_type?.startsWith("image/") || /\.(jpe?g|png|webp)$/i.test(doc.url ?? "");

  return (
    <div className="flex flex-col h-full bg-[#FAFAF6]">
      {/* Preview area */}
      <div className="flex-1 bg-[#F0EDE5] flex items-center justify-center overflow-hidden relative">
        {doc.url ? (
          isPdf ? (
            <iframe
              src={doc.url + "#toolbar=0&navpanes=0"}
              className="w-full h-full border-0"
              title={doc.name}
            />
          ) : isImg ? (
            <img src={doc.url} alt={doc.name} className="object-contain w-full h-full p-4" />
          ) : (
            <div className="text-center p-8">
              <FileArchive size={48} className="text-[#6B7280] mx-auto mb-3" />
              <p className="text-[13px] text-[#6B7280] mb-4">Aperçu non disponible pour ce format</p>
              <a href={doc.url} target="_blank" rel="noopener noreferrer" className="btn btn-gold">
                <Download size={13} /> Télécharger
              </a>
            </div>
          )
        ) : (
          <div className="text-center p-8">
            <FolderOpen size={48} className="text-[#6B7280]/40 mx-auto mb-3" />
            <p className="text-[13px] text-[#6B7280]">Aucun aperçu disponible</p>
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="flex-shrink-0 bg-white border-t border-[rgba(0,0,0,0.08)] p-4 overflow-y-auto" style={{ maxHeight: "45%" }}>
        <div className="flex items-start justify-between mb-3">
          <div className="min-w-0 flex-1 pr-3">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full mb-1.5"
              style={{ background: bg, color }}>
              <Icon size={10} /> {label}
            </span>
            <h3 className="text-[14px] font-semibold text-[#1A1A2E] leading-snug">{doc.name}</h3>
          </div>
          <button onClick={onClose} className="text-[#6B7280] hover:text-[#1A1A2E] flex-shrink-0 mt-0.5">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-1.5 text-[12.5px] mb-4">
          <div className="flex justify-between">
            <span className="text-[#6B7280]">Date</span>
            <span className="font-medium">{fmtDate(doc.date)}</span>
          </div>

          {(doc.type === "recu" || doc.type === "invoice") && (
            <>
              {(doc.vendor || doc.client) && (
                <div className="flex justify-between">
                  <span className="text-[#6B7280]">{doc.type === "invoice" ? "Client" : "Fournisseur"}</span>
                  <span className="font-medium">{doc.client ?? doc.vendor}</span>
                </div>
              )}
              {doc.amount != null && (
                <div className="flex justify-between font-semibold">
                  <span className="text-[#6B7280]">Montant</span>
                  <span className={doc.amount < 0 ? "text-[#DC2626]" : "text-[#059669]"}>
                    {fmtAmt(Math.abs(doc.amount))}
                  </span>
                </div>
              )}
            </>
          )}

          {doc.type === "company_document" && (
            <>
              {doc.document_category && (
                <div className="flex justify-between">
                  <span className="text-[#6B7280]">Type</span>
                  <span className="font-medium">{doc.document_category}</span>
                </div>
              )}
              {doc.expiration_date && (
                <div className="flex justify-between">
                  <span className="text-[#6B7280]">Expiration</span>
                  <span className="font-medium">{fmtDate(doc.expiration_date)}</span>
                </div>
              )}
              {doc.notes && (
                <div className="mt-1">
                  <span className="text-[#6B7280] block mb-0.5">Notes</span>
                  <p className="text-[12px] text-[#1A1A2E]">{doc.notes}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {doc.url && (
            <a href={doc.url} target="_blank" rel="noopener noreferrer" className="btn btn-gold btn-sm">
              <Download size={12} /> Télécharger
            </a>
          )}
          {doc.type !== "invoice" && (
            <button
              data-permission="document:delete"
              onClick={() => onDelete(doc)}
              className="ml-auto text-[12px] text-[#DC2626] hover:underline"
            >
              Supprimer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Upload modal ─────────────────────────────────────────────────────────────

function UploadModal({ dossierId, archives, driveConnected, onClose, onUploaded }: {
  dossierId?: string;
  archives: NamedArchive[];
  driveConnected: boolean;
  onClose: () => void;
  onUploaded: (doc: ArchiveDoc) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState(DOC_CATEGORIES[0]);
  const [customName, setCustomName] = useState("");
  const [expiry, setExpiry] = useState("");
  const [notes, setNotes] = useState("");
  const [archiveId, setArchiveId] = useState(archives[0]?.id ?? "");
  const [uploading, setUploading] = useState(false);

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("category", category);
      form.set("customName", customName);
      form.set("expiry", expiry);
      form.set("notes", notes);
      if (dossierId) form.set("dossierId", dossierId);
      if (archiveId) form.set("archiveId", archiveId);
      const response = await fetch("/api/archive/documents", { method: "POST", body: form });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || "Ajout du document impossible.");
      const inserted = json.document;

      toast.success("Document ajouté à l'archive");
      onUploaded({
        id: inserted.id,
        name: inserted.name,
        type: "company_document",
        date: inserted.created_at,
        url: inserted.content_url,
        mime_type: inserted.mime_type,
        document_category: inserted.document_category,
        expiration_date: inserted.expiration_date,
        notes: inserted.notes,
        subtitle: inserted.document_category ?? "",
        archive_id: inserted.archive_id,
      });
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : translateError(err));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(0,0,0,0.08)]">
          <h2 className="text-[14px] font-semibold">Ajouter un document</h2>
          <button onClick={onClose}><X size={16} className="text-[#6B7280]" /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Drop zone */}
          <label className="block border-2 border-dashed border-[rgba(0,0,0,0.12)] rounded-xl p-5 text-center cursor-pointer hover:border-[#C8924A] transition-colors">
            <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.docx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            {file ? (
              <p className="text-[13px] font-medium text-[#1A1A2E]">{file.name}</p>
            ) : (
              <>
                <FolderOpen size={28} className="text-[#6B7280]/50 mx-auto mb-2" />
                <p className="text-[12.5px] text-[#6B7280]">Glissez votre document ici</p>
                <p className="text-[11px] text-[#6B7280]/60 mt-0.5">PDF, JPG, PNG, DOCX — max 20 MB</p>
              </>
            )}
          </label>

          {/* Category */}
          {driveConnected && (
            <div>
              <label className="block text-[11.5px] font-medium text-[#6B7280] mb-1.5">Destination</label>
              <select className="input" value={archiveId} onChange={(event) => setArchiveId(event.target.value)}>
                <option value="">Stockage Mohasib</option>
                {archives.map(archive => (
                  <option key={archive.id} value={archive.id}>Google Drive — {archive.name}</option>
                ))}
              </select>
              {archives.length === 0 && (
                <p className="text-[10.5px] text-[#9CA3AF] mt-1">
                  Créez une archive Drive depuis l'écran Archive pour l'utiliser ici.
                </p>
              )}
            </div>
          )}

          {/* Category */}
          <div>
            <label className="block text-[11.5px] font-medium text-[#6B7280] mb-1.5">Type de document</label>
            <div className="flex flex-wrap gap-1.5">
              {DOC_CATEGORIES.map((c) => (
                <button key={c} onClick={() => setCategory(c)}
                  className={`text-[11.5px] px-2.5 py-1 rounded-full border transition-colors ${
                    category === c
                      ? "bg-[#0D1526] text-white border-[#0D1526]"
                      : "border-[rgba(0,0,0,0.12)] text-[#6B7280] hover:border-[#C8924A]"
                  }`}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          {category === "Autre" && (
            <input className="input" placeholder="Nom du document" value={customName}
              onChange={(e) => setCustomName(e.target.value)} />
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-[11.5px] font-medium text-[#6B7280] mb-1.5">Date d'expiration (optionnel)</label>
              <input type="date" className="input" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="block text-[11.5px] font-medium text-[#6B7280] mb-1.5">Notes (optionnel)</label>
            <textarea className="input resize-none h-16" placeholder="Notes..." value={notes}
              onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 px-5 py-4 border-t border-[rgba(0,0,0,0.08)]">
          <button onClick={onClose} className="btn btn-outline">Annuler</button>
          <button data-permission="document:create" onClick={handleUpload} disabled={!file || uploading} className="btn btn-gold">
            {uploading ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            Ajouter au coffre
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type FolderKey = "all" | DocType;

const FOLDERS: { key: FolderKey; label: string; Icon: React.ElementType }[] = [
  { key: "all",              label: "Tous les fichiers", Icon: Files },
  { key: "invoice",          label: "Factures",          Icon: FileText },
  { key: "recu",             label: "Pièces d'achat",    Icon: Receipt },
  { key: "company_document", label: "Entreprise",        Icon: Building2 },
];

export default function ArchivePage({ dossierId }: { dossierId?: string } = {}) {
  const ownerId = useAccountOwnerId();
  const searchParams = useSearchParams();
  const requestedSearch = searchParams.get("search") ?? "";
  const [docs, setDocs] = useState<ArchiveDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ArchiveDoc | null>(null);
  const [folder, setFolder] = useState<FolderKey>("all");
  const [searchState, setSearchState] = useState({ source: requestedSearch, value: requestedSearch });
  const search = searchState.source === requestedSearch ? searchState.value : requestedSearch;
  const setSearch = (value: string) => setSearchState({ source: requestedSearch, value });
  const [showUpload, setShowUpload] = useState(false);
  const [archives, setArchives] = useState<NamedArchive[]>([]);
  const [driveConnected, setDriveConnected] = useState(false);
  const [activeArchive, setActiveArchive] = useState("all");
  const [creatingArchive, setCreatingArchive] = useState(false);
  const supabase = createClient();

  const loadArchives = useCallback(async () => {
    const query = dossierId ? `?dossierId=${encodeURIComponent(dossierId)}` : "";
    const response = await fetch(`/api/google-drive/archives${query}`);
    if (!response.ok) return;
    const json = await response.json();
    setDriveConnected(!!json.connected);
    setArchives(json.archives ?? []);
  }, [dossierId]);

  // ── Load ──────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [invoiceRes, recRes, cdRes] = await Promise.all([
      (dossierId
        ? supabase.from("invoices").select("id,invoice_number,issue_date,total,currency,invoice_type,clients(name)").eq("dossier_id", dossierId)
        : supabase.from("invoices").select("id,invoice_number,issue_date,total,currency,invoice_type,clients(name)").eq("user_id", ownerId).is("dossier_id", null)
      ).or("invoice_type.is.null,invoice_type.eq.facture").order("issue_date", { ascending: false }),
      (dossierId
        ? supabase.from("receipts").select("*").eq("user_id", ownerId).eq("dossier_id", dossierId)
        : supabase.from("receipts").select("*").eq("user_id", ownerId).is("dossier_id", null)
      ).order("created_at", { ascending: false }),
      (dossierId
        ? supabase.from("company_documents").select("*").eq("user_id", ownerId).eq("dossier_id", dossierId)
        : supabase.from("company_documents").select("*").eq("user_id", ownerId).is("dossier_id", null)
      ).order("created_at", { ascending: false }),
    ]);

    const result: ArchiveDoc[] = [];

    // Customer invoices
    for (const invoice of (invoiceRes.data ?? [])) {
      const clientRelation = Array.isArray(invoice.clients) ? invoice.clients[0] : invoice.clients;
      const client = clientRelation?.name ?? null;
      const total = Number(invoice.total ?? 0);
      result.push({
        id: `inv-${invoice.id}`,
        name: invoice.invoice_number || "Facture",
        type: "invoice",
        date: invoice.issue_date,
        url: `/api/invoices/${invoice.id}/pdf`,
        mime_type: "application/pdf",
        amount: total,
        client: client ?? undefined,
        subtitle: client ? `${client} · ${fmtAmt(total)}` : fmtAmt(total),
      });
    }

    // Receipts
    for (const rec of (recRes.data ?? [])) {
      const vendor = rec.ocr_data?.vendor_name ?? rec.ocr_data?.vendor ?? null;
      const amount = rec.ocr_data?.amount ?? null;
      result.push({
        id: `rec-${rec.id}`,
        name: vendor ? `${vendor} — ${new Date(rec.created_at).toLocaleDateString("fr-MA")}` : (rec.file_name ?? "Reçu"),
        type: "recu",
        date: rec.created_at,
        url: `/api/receipts/${rec.id}/content`,
        mime_type: rec.mime_type ?? undefined,
        amount: amount ?? undefined,
        subtitle: amount != null ? `${Math.abs(amount).toLocaleString("fr-MA")} MAD` : rec.file_name ?? "",
        vendor: vendor ?? undefined,
        storage_path: rec.storage_path,
      });
    }

    // Company docs
    for (const cd of (cdRes.data ?? [])) {
      result.push({
        id: `cd-${cd.id}`,
        name: cd.name,
        type: "company_document",
        date: cd.created_at,
        url: `/api/archive/documents/${cd.id}/content`,
        mime_type: cd.mime_type,
        subtitle: cd.document_category ?? "",
        document_category: cd.document_category,
        expiration_date: cd.expiration_date,
        notes: cd.notes,
        storage_path: cd.storage_path,
        archive_id: cd.archive_id,
      });
    }

    result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setDocs(result);
    setLoading(false);
  }, [dossierId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadArchives(); }, [loadArchives]);

  async function createArchive() {
    const name = prompt("Nom de la nouvelle archive");
    if (!name?.trim()) return;
    setCreatingArchive(true);
    try {
      const response = await fetch("/api/google-drive/archives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), dossierId: dossierId ?? null }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || "Création impossible.");
      setArchives(previous => [...previous, json.archive]);
      setActiveArchive(json.archive.id);
      setFolder("all");
      setSelected(null);
      toast.success("Archive Google Drive créée");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Création impossible.");
    } finally {
      setCreatingArchive(false);
    }
  }

  function selectDoc(doc: ArchiveDoc) {
    setSelected(doc);
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function deleteDoc(doc: ArchiveDoc) {
    if (!confirm("Supprimer ce document ?")) return;

    if (doc.type === "recu") {
      const realId = doc.id.replace("rec-", "");
      const { error } = await supabase.from("receipts").delete().eq("id", realId);
      if (error) { toast.error("Erreur lors de la suppression"); return; }
    } else if (doc.type === "company_document") {
      const realId = doc.id.replace("cd-", "");
      const response = await fetch(`/api/archive/documents/${realId}`, { method: "DELETE" });
      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        toast.error(json.error || "Erreur lors de la suppression");
        return;
      }
    }

    setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    if (selected?.id === doc.id) setSelected(null);
    toast.success("Document supprimé");
  }

  // ── Filter ────────────────────────────────────────────────────────────────

  const filtered = docs.filter((d) => {
    if (activeArchive !== "all" && (d.type !== "company_document" || d.archive_id !== activeArchive)) return false;
    if (folder !== "all" && d.type !== folder) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        d.name.toLowerCase().includes(q) ||
        (d.vendor ?? "").toLowerCase().includes(q) ||
        d.subtitle.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const docsInLocation = docs.filter((doc) =>
    activeArchive === "all" || (doc.type === "company_document" && doc.archive_id === activeArchive)
  );
  const countFor = (key: FolderKey) =>
    key === "all" ? docsInLocation.length : docsInLocation.filter((doc) => doc.type === key).length;

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      {showUpload && (
        <UploadModal
          dossierId={dossierId}
          archives={archives}
          driveConnected={driveConnected}
          onClose={() => setShowUpload(false)}
          onUploaded={(doc) => { setDocs((prev) => [doc, ...prev]); setSelected(doc); }}
        />
      )}

      <div className="flex h-[calc(100%+32px)] w-[calc(100%+32px)] min-h-0 -m-4 overflow-hidden md:h-[calc(100%+42px)] md:w-[calc(100%+44px)] md:-mx-[22px] md:-mt-[24px] md:-mb-[18px] md:border-l md:border-[#E5E5E1]">

        {/* ── Left Panel ──────────────────────────────────────────────────── */}
        <div className={`${selected ? "hidden md:flex" : "flex"} w-full min-w-0 flex-shrink-0 flex-col overflow-hidden bg-white md:w-[38%] md:min-w-[280px] md:border-r md:border-[rgba(0,0,0,0.08)]`}>

          {/* Page header */}
          <div className="px-3.5 pt-3.5 pb-3 border-b border-[rgba(0,0,0,0.06)] flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(200,146,74,0.12)" }}>
                <FolderOpen size={18} className="text-[#C8924A]" />
              </div>
              <div>
                <h1 className="text-[18px] font-bold text-[#1A1A2E] leading-none">Archive</h1>
                <p className="text-[11px] text-[#9CA3AF] mt-0.5">Documents et pièces justificatives</p>
              </div>
            </div>
          </div>

          {/* Search + Add */}
          <div className="px-3.5 pt-3.5 pb-2 flex-shrink-0">
            <div className="flex items-center gap-2 mb-2">
              <select
                className="input flex-1 text-[12px]"
                value={activeArchive}
                onChange={(event) => {
                  setActiveArchive(event.target.value);
                  setFolder("all");
                  setSelected(null);
                }}
              >
                <option value="all">Toutes les archives</option>
                {archives.map(archive => (
                  <option key={archive.id} value={archive.id}>{archive.name} · Google Drive</option>
                ))}
              </select>
              {driveConnected ? (
                <button
                  data-permission="document:create"
                  onClick={createArchive}
                  disabled={creatingArchive}
                  className="btn btn-outline flex-shrink-0 text-[11.5px]"
                  title="Créer une archive Google Drive"
                >
                  {creatingArchive ? <Loader2 size={12} className="animate-spin" /> : <GoogleDriveIcon size={12} />}
                  Nouvelle
                </button>
              ) : (
                <a href="/parametres?tab=integrations" className="btn btn-outline flex-shrink-0 text-[11.5px]">
                  <GoogleDriveIcon size={12} /> Connecter Drive
                </a>
              )}
            </div>
            <div className="flex items-stretch gap-2">
              <div className="relative flex-1">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6B7280]" />
                <input
                  className="input pl-8 text-[12px] h-full"
                  placeholder="Rechercher un document..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <button data-permission="document:create" onClick={() => setShowUpload(true)} className="btn btn-gold flex-shrink-0 flex items-center gap-1.5 text-[12px]">
                <Plus size={12} /> Ajouter
              </button>
            </div>
            <p className="text-[10.5px] text-[#6B7280] mt-1.5 pl-0.5">
              {filtered.length} document{filtered.length !== 1 ? "s" : ""}
            </p>
          </div>

          {/* Folders */}
          <div className="flex-shrink-0 border-b border-[rgba(0,0,0,0.06)] px-3.5 pb-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF]">Dossiers</p>
            <div className="grid grid-cols-2 gap-2">
              {FOLDERS.map(({ key, label, Icon }) => {
                const isActive = folder === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setFolder(key);
                      setSelected(null);
                    }}
                    aria-pressed={isActive}
                    className={`flex min-w-0 items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors ${
                      isActive
                        ? "bg-[#0D1526] text-white shadow-sm"
                        : "bg-[#F7F7F3] text-[#1A1A2E] hover:bg-[#F0EDE5]"
                    }`}
                  >
                    <Icon size={15} className={isActive ? "text-[#D9AA67]" : "text-[#C8924A]"} />
                    <span className="min-w-0 flex-1 truncate text-[11.5px] font-medium">{label}</span>
                    <span className={`text-[10px] ${isActive ? "text-white/60" : "text-[#9CA3AF]"}`}>
                      {countFor(key)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="loading-state">
                Chargement des documents…
              </div>
            )}

            {!loading && filtered.length === 0 && (
              <div className="empty-state">
                <FolderOpen size={32} className="text-[#6B7280]/30 mx-auto mb-2" />
                <p className="text-[12.5px] text-[#6B7280]">
                  {search ? "Aucun résultat" : "Aucun document"}
                </p>
              </div>
            )}

            {!loading && filtered.map((doc) => {
              const { Icon, bg, color, label } = sourceMeta(doc);
              const isSelected = selected?.id === doc.id;

              return (
                <button
                  key={doc.id}
                  onClick={() => selectDoc(doc)}
                  aria-pressed={isSelected}
                  className={`mx-2 my-1 flex w-[calc(100%-16px)] items-start gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors ${
                    isSelected
                      ? "bg-[#F5EDE2] shadow-[inset_0_0_0_1px_rgba(200,146,74,0.28)]"
                      : "hover:bg-[#FAFAF6]"
                  }`}
                >
                  {/* Icon */}
                  <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
                    style={{ background: bg }}>
                    <Icon size={14} style={{ color }} />
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-[12.5px] font-medium text-[#1A1A2E] truncate leading-snug">{doc.name}</p>
                      <span className="text-[10px] text-[#6B7280] flex-shrink-0 whitespace-nowrap">
                        {new Date(doc.date).toLocaleDateString("fr-MA", { day: "numeric", month: "short" })}
                      </span>
                    </div>
                    <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[10.5px] text-[#6B7280]">
                      <span className="flex-shrink-0 font-medium" style={{ color }}>{label}</span>
                      {doc.subtitle && <span aria-hidden="true" className="text-[#D1D5DB]">·</span>}
                      <p className="truncate">{doc.subtitle}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

        </div>

        {/* ── Right Panel ─────────────────────────────────────────────────── */}
        <div className={`${selected ? "block" : "hidden md:block"} min-w-0 flex-1 overflow-hidden`}>
          {selected ? (
            <PreviewPanel
              doc={selected}
              onClose={() => setSelected(null)}
              onDelete={deleteDoc}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <FolderOpen size={56} className="text-[#6B7280]/20 mb-4" />
              <p className="text-[14px] font-medium text-[#6B7280]">Sélectionnez un document</p>
              <p className="text-[12px] text-[#6B7280]/60 mt-1">Cliquez sur un fichier pour le prévisualiser</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
