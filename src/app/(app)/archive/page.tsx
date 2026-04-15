"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  FolderOpen, FileText, Receipt, Download, X, Plus,
  Search, Loader2, Building2, FileArchive,
} from "lucide-react";
import type { InvoiceStatus } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type DocType = "facture" | "recu" | "company_document";

interface ArchiveDoc {
  id: string;
  name: string;
  type: DocType;
  date: string;
  url: string | null;
  mime_type?: string | null;
  amount?: number;
  status?: string;
  subtitle: string;
  // invoice
  invoice_number?: string;
  client_name?: string;
  subtotal?: number;
  tax_amount?: number;
  total?: number;
  due_date?: string;
  invoice_id?: string;
  invoice_status?: InvoiceStatus;
  // receipt
  vendor?: string;
  storage_path?: string | null;
  // company doc
  document_category?: string;
  expiration_date?: string | null;
  notes?: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_META: Record<DocType, { label: string; color: string; bg: string; Icon: React.ElementType }> = {
  facture:           { label: "Facture",             color: "#FFFFFF", bg: "#0D1526", Icon: FileText },
  recu:              { label: "Reçu",                color: "#FFFFFF", bg: "#D97706", Icon: Receipt },
  company_document:  { label: "Doc. Entreprise",     color: "#FFFFFF", bg: "#6B7280", Icon: Building2 },
};

const STATUS_BADGE: Record<string, { cls: string; label: string }> = {
  paid:      { cls: "b-paid",    label: "Payée" },
  sent:      { cls: "b-pending", label: "En attente" },
  overdue:   { cls: "b-overdue", label: "En retard" },
  draft:     { cls: "b-draft",   label: "Brouillon" },
  cancelled: { cls: "b-draft",   label: "Annulée" },
  matched:   { cls: "b-paid",    label: "Traité" },
  pending:   { cls: "b-pending", label: "En attente" },
  ignored:   { cls: "b-draft",   label: "Ignoré" },
};

const DOC_CATEGORIES = [
  "Certificat ICE", "RC", "Patente", "Statuts",
  "Contrat", "Attestation", "Autre",
];

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-MA", { day: "numeric", month: "long", year: "numeric" });
}
function fmtAmt(n: number) { return n.toLocaleString("fr-MA") + " MAD"; }

// ─── Expiry badge ─────────────────────────────────────────────────────────────

function ExpiryBadge({ date }: { date: string }) {
  const days = Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
  if (days < 0)  return <span className="badge b-overdue">Expiré</span>;
  if (days <= 30) return <span className="badge b-pending">Expire dans {days}j</span>;
  return <span className="badge b-paid">Valide</span>;
}

// ─── Preview panel ────────────────────────────────────────────────────────────

function PreviewPanel({ doc, onClose, onDelete }: {
  doc: ArchiveDoc;
  onClose: () => void;
  onDelete: (doc: ArchiveDoc) => void;
}) {
  const { Icon, label, bg } = TYPE_META[doc.type];
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
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full text-white mb-1.5"
              style={{ background: bg }}>
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

          {doc.type === "facture" && (
            <>
              <div className="flex justify-between">
                <span className="text-[#6B7280]">Client</span>
                <span className="font-medium">{doc.client_name ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B7280]">Montant HT</span>
                <span>{doc.subtotal != null ? fmtAmt(doc.subtotal) : "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B7280]">TVA</span>
                <span>{doc.tax_amount != null ? fmtAmt(doc.tax_amount) : "—"}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span className="text-[#6B7280]">TTC</span>
                <span>{doc.total != null ? fmtAmt(doc.total) : "—"}</span>
              </div>
              {doc.invoice_status && (
                <div className="flex justify-between items-center">
                  <span className="text-[#6B7280]">Statut</span>
                  <span className={`badge ${STATUS_BADGE[doc.invoice_status]?.cls ?? "b-draft"}`}>
                    {STATUS_BADGE[doc.invoice_status]?.label ?? doc.invoice_status}
                  </span>
                </div>
              )}
              {doc.due_date && (
                <div className="flex justify-between">
                  <span className="text-[#6B7280]">Échéance</span>
                  <span>{fmtDate(doc.due_date)}</span>
                </div>
              )}
            </>
          )}

          {doc.type === "recu" && (
            <>
              {doc.vendor && (
                <div className="flex justify-between">
                  <span className="text-[#6B7280]">Fournisseur</span>
                  <span className="font-medium">{doc.vendor}</span>
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
              {doc.status && (
                <div className="flex justify-between items-center">
                  <span className="text-[#6B7280]">Statut inbox</span>
                  <span className={`badge ${STATUS_BADGE[doc.status]?.cls ?? "b-draft"}`}>
                    {STATUS_BADGE[doc.status]?.label ?? doc.status}
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
                <div className="flex justify-between items-center">
                  <span className="text-[#6B7280]">Expiration</span>
                  <ExpiryBadge date={doc.expiration_date} />
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
          {doc.type === "facture" && doc.invoice_id && (
            <Link href={`/invoices/${doc.invoice_id}`} className="btn btn-outline btn-sm">
              Voir la facture →
            </Link>
          )}
          <button
            onClick={() => onDelete(doc)}
            className="ml-auto text-[12px] text-[#DC2626] hover:underline"
          >
            Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Upload modal ─────────────────────────────────────────────────────────────

function UploadModal({ onClose, onUploaded }: {
  onClose: () => void;
  onUploaded: (doc: ArchiveDoc) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState(DOC_CATEGORIES[0]);
  const [customName, setCustomName] = useState("");
  const [expiry, setExpiry] = useState("");
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const supabase = createClient();

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const ext = file.name.split(".").pop();
      const path = `${user!.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("company-documents").upload(path, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = await supabase.storage
        .from("company-documents").createSignedUrl(path, 3600 * 24 * 365);

      const name = category === "Autre" && customName ? customName : (category + " — " + file.name);

      const { data: inserted, error: dbError } = await supabase
        .from("company_documents")
        .insert({
          user_id: user!.id,
          name,
          document_category: category,
          storage_path: path,
          file_name: file.name,
          mime_type: file.type,
          expiration_date: expiry || null,
          notes: notes || null,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      toast.success("Document ajouté à l'archive");
      onUploaded({
        id: inserted.id,
        name,
        type: "company_document",
        date: inserted.created_at,
        url: urlData?.signedUrl ?? null,
        mime_type: file.type,
        document_category: category,
        expiration_date: expiry || null,
        notes: notes || null,
        subtitle: category,
        storage_path: path,
      });
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'upload");
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

          <div className="grid grid-cols-2 gap-3">
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
          <button onClick={handleUpload} disabled={!file || uploading} className="btn btn-gold">
            {uploading ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            Ajouter au coffre
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type TabKey = "all" | DocType;

const TABS: { key: TabKey; label: string }[] = [
  { key: "all",              label: "Tous" },
  { key: "facture",          label: "Factures" },
  { key: "recu",             label: "Reçus" },
  { key: "company_document", label: "Entreprise" },
];

export default function ArchivePage() {
  const [docs, setDocs] = useState<ArchiveDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ArchiveDoc | null>(null);
  const [resolving, setResolving] = useState(false);
  const [tab, setTab] = useState<TabKey>("all");
  const [search, setSearch] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const supabase = createClient();

  // ── Load ──────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [invRes, recRes, cdRes] = await Promise.all([
      supabase.from("invoices").select("*, clients(id,name)")
        .eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("receipts").select("*")
        .eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("company_documents").select("*")
        .eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);

    const result: ArchiveDoc[] = [];

    // Invoices
    for (const inv of (invRes.data ?? [])) {
      const client = (inv as any).clients?.name ?? "—";
      result.push({
        id: `inv-${inv.id}`,
        name: `${inv.invoice_number} — ${client}`,
        type: "facture",
        date: inv.created_at,
        url: null,
        mime_type: "application/pdf",
        amount: Number(inv.total),
        subtitle: `${Number(inv.total).toLocaleString("fr-MA")} MAD · ${STATUS_BADGE[inv.status]?.label ?? inv.status}`,
        invoice_number: inv.invoice_number,
        client_name: client,
        subtotal: Number(inv.subtotal),
        tax_amount: Number(inv.tax_amount),
        total: Number(inv.total),
        due_date: inv.due_date ?? undefined,
        invoice_id: inv.id,
        invoice_status: inv.status,
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
        url: null, // resolved on select
        mime_type: rec.mime_type ?? undefined,
        amount: amount ?? undefined,
        status: rec.status,
        subtitle: amount != null ? `${Math.abs(amount).toLocaleString("fr-MA")} MAD` : rec.file_name ?? "",
        vendor: vendor ?? undefined,
        storage_path: rec.storage_path,
      });
    }

    // Company docs
    for (const cd of (cdRes.data ?? [])) {
      // get signed url
      let url: string | null = null;
      if (cd.storage_path) {
        const { data } = await supabase.storage.from("company-documents")
          .createSignedUrl(cd.storage_path, 3600);
        url = data?.signedUrl ?? null;
      }
      result.push({
        id: `cd-${cd.id}`,
        name: cd.name,
        type: "company_document",
        date: cd.created_at,
        url,
        mime_type: cd.mime_type,
        subtitle: cd.document_category ?? "",
        document_category: cd.document_category,
        expiration_date: cd.expiration_date,
        notes: cd.notes,
        storage_path: cd.storage_path,
      });
    }

    result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setDocs(result);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Resolve URL on select ─────────────────────────────────────────────────

  async function selectDoc(doc: ArchiveDoc) {
    setSelected(doc);
    if (doc.url) return; // already resolved

    setResolving(true);
    try {
      if (doc.type === "facture" && doc.invoice_id) {
        const res = await fetch(`/api/invoices/${doc.invoice_id}/pdf`, { method: "POST" });
        if (res.ok) {
          const { pdfUrl } = await res.json();
          const resolved = { ...doc, url: pdfUrl ?? null, mime_type: "application/pdf" };
          setDocs((prev) => prev.map((d) => d.id === doc.id ? resolved : d));
          setSelected(resolved);
        }
      } else if (doc.type === "recu" && doc.storage_path) {
        const { data } = await supabase.storage.from("receipts")
          .createSignedUrl(doc.storage_path, 3600);
        const resolved = { ...doc, url: data?.signedUrl ?? null };
        setDocs((prev) => prev.map((d) => d.id === doc.id ? resolved : d));
        setSelected(resolved);
      }
    } finally {
      setResolving(false);
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function deleteDoc(doc: ArchiveDoc) {
    if (!confirm("Supprimer ce document ?")) return;

    if (doc.type === "facture" && doc.invoice_id) {
      const { error } = await supabase.from("invoices").delete().eq("id", doc.invoice_id);
      if (error) { toast.error("Erreur lors de la suppression"); return; }
    } else if (doc.type === "recu") {
      const realId = doc.id.replace("rec-", "");
      const { error } = await supabase.from("receipts").delete().eq("id", realId);
      if (error) { toast.error("Erreur lors de la suppression"); return; }
    } else if (doc.type === "company_document") {
      const realId = doc.id.replace("cd-", "");
      const { error } = await supabase.from("company_documents").delete().eq("id", realId);
      if (error) { toast.error("Erreur lors de la suppression"); return; }
    }

    setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    if (selected?.id === doc.id) setSelected(null);
    toast.success("Document supprimé");
  }

  // ── Filter ────────────────────────────────────────────────────────────────

  const filtered = docs.filter((d) => {
    if (tab !== "all" && d.type !== tab) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        d.name.toLowerCase().includes(q) ||
        (d.client_name ?? "").toLowerCase().includes(q) ||
        (d.vendor ?? "").toLowerCase().includes(q) ||
        d.subtitle.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const countFor = (t: TabKey) =>
    t === "all" ? docs.length : docs.filter((d) => d.type === t).length;

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onUploaded={(doc) => { setDocs((prev) => [doc, ...prev]); setSelected(doc); }}
        />
      )}

      <div className="flex h-[calc(100vh-52px)] -m-4 md:-mx-[22px] md:-mt-[24px] md:-mb-[18px] overflow-hidden">

        {/* ── Left Panel ──────────────────────────────────────────────────── */}
        <div className="w-[38%] min-w-[280px] flex-shrink-0 flex flex-col bg-white border-r border-[rgba(0,0,0,0.08)] overflow-hidden">

          {/* Search + Add */}
          <div className="px-3.5 pt-3.5 pb-2 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6B7280]" />
                <input
                  className="input pl-8 text-[12px]"
                  placeholder="Rechercher un document..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <button onClick={() => setShowUpload(true)} className="btn btn-gold btn-sm flex-shrink-0">
                <Plus size={12} /> Ajouter
              </button>
            </div>
            <p className="text-[10.5px] text-[#6B7280] mt-1.5 pl-0.5">
              {filtered.length} document{filtered.length !== 1 ? "s" : ""}
            </p>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-[rgba(0,0,0,0.08)] flex-shrink-0 overflow-x-auto">
            {TABS.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`tab flex-shrink-0 flex items-center gap-1`}
                style={{ borderBottomColor: tab === t.key ? "#C8924A" : "transparent",
                  color: tab === t.key ? "#C8924A" : "#6B7280",
                  fontWeight: tab === t.key ? 500 : 400 }}>
                {t.label}
                <span className="text-[9.5px] bg-[rgba(0,0,0,0.06)] px-1.5 py-0.5 rounded-full">
                  {countFor(t.key)}
                </span>
              </button>
            ))}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={20} className="animate-spin text-[#C8924A]" />
              </div>
            )}

            {!loading && filtered.length === 0 && (
              <div className="text-center py-12 px-4">
                <FolderOpen size={32} className="text-[#6B7280]/30 mx-auto mb-2" />
                <p className="text-[12.5px] text-[#6B7280]">
                  {search ? "Aucun résultat" : "Aucun document"}
                </p>
                {tab === "facture" && (
                  <Link href="/invoices/new" className="btn btn-gold mt-3 text-[11.5px]">
                    Créer une facture
                  </Link>
                )}
              </div>
            )}

            {!loading && filtered.map((doc) => {
              const { Icon, bg } = TYPE_META[doc.type];
              const isSelected = selected?.id === doc.id;
              const hasExpiry = doc.expiration_date;
              const expired = hasExpiry && new Date(doc.expiration_date!) < new Date();
              const expiringSoon = hasExpiry && !expired &&
                Math.ceil((new Date(doc.expiration_date!).getTime() - Date.now()) / 86400000) <= 30;

              return (
                <button
                  key={doc.id}
                  onClick={() => selectDoc(doc)}
                  className="w-full text-left px-3.5 py-2.5 border-b border-[rgba(0,0,0,0.06)] transition-colors hover:bg-[#FAFAF6] flex items-start gap-2.5"
                  style={{
                    borderLeft: isSelected ? "3px solid #C8924A" : "3px solid transparent",
                    background: isSelected ? "rgba(200,146,74,0.05)" : undefined,
                  }}
                >
                  {/* Icon */}
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: bg + "22" }}>
                    <Icon size={13} style={{ color: bg === "#FFFFFF" ? "#1A1A2E" : bg }} />
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-[12.5px] font-medium text-[#1A1A2E] truncate leading-snug">{doc.name}</p>
                      <span className="text-[10px] text-[#6B7280] flex-shrink-0 whitespace-nowrap">
                        {new Date(doc.date).toLocaleDateString("fr-MA", { day: "numeric", month: "short" })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <p className="text-[11px] text-[#6B7280] truncate">{doc.subtitle}</p>
                      {expired && <span className="badge b-overdue text-[9px] flex-shrink-0">Expiré</span>}
                      {expiringSoon && !expired && <span className="badge b-pending text-[9px] flex-shrink-0">Expire bientôt</span>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

        </div>

        {/* ── Right Panel ─────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-hidden">
          {selected ? (
            resolving ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <Loader2 size={28} className="animate-spin text-[#C8924A]" />
                <p className="text-[12.5px] text-[#6B7280]">Chargement de l'aperçu...</p>
              </div>
            ) : (
            <PreviewPanel
              doc={selected}
              onClose={() => setSelected(null)}
              onDelete={deleteDoc}
            />
            )
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
