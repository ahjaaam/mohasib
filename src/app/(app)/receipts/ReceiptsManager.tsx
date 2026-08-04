"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  ArchiveRestore,
  Camera,
  Download,
  Eye,
  FileText,
  Loader2,
  Mail,
  MailOpen,
  ReceiptText,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { useAccountOwnerId } from "@/hooks/useAccountOwner";
import type { Receipt, ReceiptStatus } from "@/types";

interface ReceiptWithUrl extends Receipt {
  signedUrl?: string;
}

type StatusFilter = "all" | ReceiptStatus;

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("fr-MA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatAmount(value: number | null | undefined, currency = "MAD") {
  if (value == null || !Number.isFinite(Number(value))) return "Montant inconnu";
  return `${Math.abs(Number(value)).toLocaleString("fr-MA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

function receiptVendor(receipt: Receipt) {
  return receipt.ocr_data.vendor_name
    ?? receipt.ocr_data.vendor
    ?? receipt.ocr_data.description
    ?? "Fournisseur inconnu";
}

function receiptSource(receipt: Receipt) {
  const provider = (receipt.ocr_data as Record<string, unknown>).email_provider;
  return provider === "gmail"
    ? "Gmail"
    : provider === "outlook"
      ? "Outlook"
      : provider === "inbound"
        ? "Email reçu"
        : "Import manuel";
}

const STATUS_META: Record<ReceiptStatus, { label: string; className: string }> = {
  pending: { label: "À traiter", className: "bg-amber-50 text-amber-700 border-amber-200" },
  matched: { label: "Traité", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  ignored: { label: "Archivé", className: "bg-gray-100 text-gray-600 border-gray-200" },
};

export default function ReceiptsManager({ dossierId }: { dossierId?: string } = {}) {
  const ownerId = useAccountOwnerId();
  const supabase = createClient();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [receipts, setReceipts] = useState<ReceiptWithUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [syncingEmail, setSyncingEmail] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [source, setSource] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [preview, setPreview] = useState<ReceiptWithUrl | null>(null);
  const [mutating, setMutating] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    let request = supabase
      .from("receipts")
      .select("*")
      .order("created_at", { ascending: false });
    request = dossierId
      ? request.eq("dossier_id", dossierId)
      : request.eq("user_id", ownerId).is("dossier_id", null);

    const { data, error } = await request;
    if (error) {
      toast.error("Impossible de charger les justificatifs.");
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as Receipt[];
    const withUrls = rows.map((receipt) => {
      if (!receipt.storage_path) return receipt;
      const { data: urlData } = supabase.storage.from("receipts").getPublicUrl(receipt.storage_path);
      return { ...receipt, signedUrl: urlData.publicUrl };
    });
    setReceipts(withUrls);
    setLoading(false);
  }, [dossierId, ownerId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const requestedSearch = new URLSearchParams(window.location.search).get("search");
    if (requestedSearch) setQuery(requestedSearch);
  }, []);

  async function handleFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (!list.length) return;
    setUploading(true);
    let imported = 0;
    for (const file of list) {
      try {
        const body = new FormData();
        body.append("file", file);
        if (dossierId) body.append("dossier_id", dossierId);
        const response = await fetch("/api/ocr", { method: "POST", body });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.message ?? result.error ?? "Import impossible");
        imported += 1;
      } catch (error) {
        toast.error(`${file.name} : ${error instanceof Error ? error.message : "Import impossible"}`);
      }
    }
    if (imported) {
      toast.success(`${imported} justificatif${imported > 1 ? "s" : ""} importé${imported > 1 ? "s" : ""}`);
      await load();
    }
    setUploading(false);
  }

  async function importFromEmails() {
    setSyncingEmail(true);
    try {
      const response = await fetch("/api/email/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "receipts_only",
          ...(dossierId ? { dossierId } : {}),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Importation impossible");

      if (result.not_connected) {
        toast("Connectez votre email dans les paramètres d’intégration.", { icon: <Mail size={16} /> });
        router.push(
          dossierId
            ? `/comptable-pro/dossiers/${dossierId}/settings?tab=integrations`
            : "/settings?tab=integrations",
        );
        return;
      }

      if (result.imported > 0) {
        toast.success(
          `${result.imported} reçu${result.imported > 1 ? "s" : ""} ou bon${result.imported > 1 ? "s" : ""} importé${result.imported > 1 ? "s" : ""}`,
        );
        await load();
      } else if (result.errors?.length) {
        toast.error(result.errors.join(" "), { duration: 5000 });
      } else {
        toast("Aucun nouveau reçu ou bon trouvé. Les factures et avoirs ont été exclus.", {
          icon: <MailOpen size={16} />,
          duration: 5000,
        });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Importation impossible");
    } finally {
      setSyncingEmail(false);
    }
  }

  async function updateStatus(receipt: ReceiptWithUrl, nextStatus: ReceiptStatus) {
    setMutating((current) => new Set(current).add(receipt.id));
    const response = await fetch(`/api/receipts/${receipt.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    const result = await response.json().catch(() => ({}));
    setMutating((current) => {
      const next = new Set(current);
      next.delete(receipt.id);
      return next;
    });
    if (!response.ok) {
      toast.error(result.error ?? "Modification impossible");
      return;
    }
    setReceipts((current) => current.map((item) => item.id === receipt.id ? { ...item, status: nextStatus } : item));
    setPreview((current) => current?.id === receipt.id ? { ...current, status: nextStatus } : current);
    toast.success(nextStatus === "pending" ? "Justificatif remis à traiter" : "Justificatif archivé");
  }

  async function deleteReceipt(receipt: ReceiptWithUrl) {
    if (!window.confirm(`Supprimer définitivement « ${receipt.file_name ?? receiptVendor(receipt)} » ?`)) return;
    setMutating((current) => new Set(current).add(receipt.id));
    const response = await fetch(`/api/receipts/${receipt.id}`, { method: "DELETE" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMutating((current) => {
        const next = new Set(current);
        next.delete(receipt.id);
        return next;
      });
      toast.error(result.error ?? "Suppression impossible");
      return;
    }
    setReceipts((current) => current.filter((item) => item.id !== receipt.id));
    if (preview?.id === receipt.id) setPreview(null);
    toast.success("Justificatif supprimé");
  }

  const filtered = useMemo(() => receipts.filter((receipt) => {
    const searchable = [
      receipt.file_name,
      receiptVendor(receipt),
      receipt.ocr_data.receipt_number,
      receipt.ocr_data.description,
    ].filter(Boolean).join(" ").toLowerCase();
    if (query && !searchable.includes(query.toLowerCase())) return false;
    if (status !== "all" && receipt.status !== status) return false;
    if (source !== "all" && receiptSource(receipt) !== source) return false;
    const receiptDate = receipt.ocr_data.date ?? receipt.created_at.slice(0, 10);
    if (dateFrom && receiptDate < dateFrom) return false;
    if (dateTo && receiptDate > dateTo) return false;
    return true;
  }), [receipts, query, status, source, dateFrom, dateTo]);

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[rgba(200,146,74,0.12)]">
            <ReceiptText size={18} className="text-[#C8924A]" />
          </div>
          <div>
            <h1 className="text-[18px] font-bold leading-none text-[#1A1A2E]">Justificatifs</h1>
            <p className="mt-0.5 text-[11px] text-[#9CA3AF]">Centralisez, recherchez et classez vos reçus et pièces comptables</p>
          </div>
        </div>
      </div>

      <input ref={fileInputRef} type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden"
        onChange={(event) => { if (event.target.files) handleFiles(event.target.files); event.target.value = ""; }} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(event) => { if (event.target.files) handleFiles(event.target.files); event.target.value = ""; }} />

      <div
        className={`mb-4 border-2 border-dashed bg-white px-4 py-3 transition-colors ${dragOver ? "border-[#C8924A] bg-[#FFFDF8]" : "border-[#D1D5DB]"}`}
        onDragOver={(event) => { event.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          handleFiles(event.dataTransfer.files);
        }}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[12.5px] font-semibold text-[#1A1A2E]">Déposez vos justificatifs ici</div>
            <div className="text-[11px] text-[#9CA3AF]">PDF, JPG, PNG ou WebP · 10 Mo maximum · extraction automatique</div>
          </div>
          <div className="flex flex-wrap gap-2 sm:flex-shrink-0">
            <button
              data-permission="document:create"
              disabled={uploading || syncingEmail}
              onClick={importFromEmails}
              className="flex items-center gap-1.5 whitespace-nowrap border-0 bg-[#0D1526] px-3.5 py-2 text-[12px] font-medium text-white transition-colors hover:bg-[#1A263D] disabled:opacity-50"
            >
              <RefreshCw size={13} className={syncingEmail ? "animate-spin" : ""} />
              {syncingEmail ? "Importation…" : "Importer depuis mes emails"}
            </button>
            <button
              data-permission="document:create"
              disabled={uploading || syncingEmail}
              onClick={() => fileInputRef.current?.click()}
              className="btn btn-outline"
            >
              {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
              {uploading ? "Importation…" : "Importer des documents"}
            </button>
            <button
              data-permission="document:create"
              disabled={uploading || syncingEmail}
              onClick={() => cameraInputRef.current?.click()}
              className="btn btn-outline"
            >
              <Camera size={13} /> Prendre une photo
            </button>
          </div>
        </div>
      </div>

      <div className="mb-3 rounded-xl border border-[rgba(0,0,0,0.08)] bg-white p-3.5">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1fr)_150px_150px_145px_145px]">
          <label className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-[#9CA3AF]" />
            <input className="input w-full pl-9" value={query} onChange={(event) => setQuery(event.target.value)}
              placeholder="Fournisseur, fichier, référence…" />
          </label>
          <select className="input" value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}>
            <option value="all">Tous les statuts</option>
            <option value="pending">À traiter</option>
            <option value="matched">Traités</option>
            <option value="ignored">Archivés</option>
          </select>
          <select className="input" value={source} onChange={(event) => setSource(event.target.value)}>
            <option value="all">Toutes les sources</option>
            <option>Import manuel</option>
            <option>Gmail</option>
            <option>Outlook</option>
            <option>Email reçu</option>
          </select>
          <input aria-label="Date de début" type="date" className="input" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          <input aria-label="Date de fin" type="date" className="input" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((item) => <div key={item} className="h-20 animate-pulse rounded-xl border border-gray-100 bg-white" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <ReceiptText size={34} className="mx-auto mb-3 text-[#D1D5DB]" />
          <p className="text-[13px] font-medium text-[#6B7280]">
            {receipts.length ? "Aucun justificatif ne correspond aux filtres." : "Aucun justificatif pour le moment."}
          </p>
          {!receipts.length && (
            <button onClick={() => fileInputRef.current?.click()} className="btn btn-gold mt-4 text-[12px]">
              <Upload size={12} /> Importer le premier
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[rgba(0,0,0,0.08)] bg-white">
          <div className="hidden grid-cols-[minmax(240px,1.5fr)_1fr_130px_130px_140px] gap-3 border-b border-gray-100 bg-[#FAFAF8] px-4 py-2 text-[10.5px] font-semibold uppercase tracking-wide text-[#8A909B] md:grid">
            <span>Justificatif</span><span>Fournisseur</span><span>Montant</span><span>Statut</span><span className="text-right">Actions</span>
          </div>
          {filtered.map((receipt) => {
            const meta = STATUS_META[receipt.status];
            const busy = mutating.has(receipt.id);
            return (
              <div key={receipt.id} className="grid gap-3 border-b border-gray-100 px-4 py-3 last:border-b-0 md:grid-cols-[minmax(240px,1.5fr)_1fr_130px_130px_140px] md:items-center">
                <button onClick={() => setPreview(receipt)} className="flex min-w-0 items-center gap-3 text-left">
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[#F4F1EA] text-[#C8924A]">
                    <FileText size={17} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[12.5px] font-semibold text-[#1A1A2E]">{receipt.file_name ?? "Justificatif sans nom"}</span>
                    <span className="block text-[10.5px] text-[#9CA3AF]">{formatDate(receipt.created_at)} · {receiptSource(receipt)}</span>
                  </span>
                </button>
                <div className="min-w-0">
                  <div className="truncate text-[12px] font-medium text-[#374151]">{receiptVendor(receipt)}</div>
                  <div className="truncate text-[10.5px] text-[#9CA3AF]">{receipt.ocr_data.receipt_number ?? "Sans référence"}</div>
                </div>
                <div className="text-[12px] font-semibold text-[#1A1A2E]">
                  {formatAmount(receipt.ocr_data.amount, receipt.ocr_data.currency ?? "MAD")}
                </div>
                <div>
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.className}`}>{meta.label}</span>
                </div>
                <div className="flex items-center justify-end gap-1">
                  <button title="Aperçu" onClick={() => setPreview(receipt)} className="rounded-md p-2 text-[#6B7280] hover:bg-gray-100 hover:text-[#1A1A2E]"><Eye size={14} /></button>
                  {receipt.signedUrl && (
                    <a title="Télécharger" href={receipt.signedUrl} download={receipt.file_name ?? true} className="rounded-md p-2 text-[#6B7280] hover:bg-gray-100 hover:text-[#1A1A2E]"><Download size={14} /></a>
                  )}
                  {receipt.status === "ignored" ? (
                    <button data-permission="document:create" disabled={busy} title="Remettre à traiter" onClick={() => updateStatus(receipt, "pending")} className="rounded-md p-2 text-[#6B7280] hover:bg-gray-100 hover:text-[#1A1A2E]"><ArchiveRestore size={14} /></button>
                  ) : (
                    <button data-permission="document:create" disabled={busy} title="Archiver" onClick={() => updateStatus(receipt, "ignored")} className="rounded-md p-2 text-[#6B7280] hover:bg-gray-100 hover:text-[#1A1A2E]"><X size={14} /></button>
                  )}
                  <button data-permission="document:delete" disabled={busy} title="Supprimer" onClick={() => deleteReceipt(receipt)} className="rounded-md p-2 text-[#9CA3AF] hover:bg-red-50 hover:text-red-600">
                    {busy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {preview && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onClick={() => setPreview(null)}>
          <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold text-[#1A1A2E]">{preview.file_name ?? "Justificatif"}</div>
                <div className="text-[10.5px] text-[#9CA3AF]">{receiptVendor(preview)} · {formatAmount(preview.ocr_data.amount, preview.ocr_data.currency ?? "MAD")}</div>
              </div>
              <div className="flex items-center gap-1">
                {preview.signedUrl && <a href={preview.signedUrl} download={preview.file_name ?? true} className="btn btn-outline text-[12px]"><Download size={13} /> Télécharger</a>}
                <button onClick={() => setPreview(null)} className="rounded-md p-2 text-[#6B7280] hover:bg-gray-100"><X size={18} /></button>
              </div>
            </div>
            <div className="min-h-[60vh] flex-1 bg-[#F3F4F6] p-3">
              {!preview.signedUrl ? (
                <div className="flex h-full min-h-[60vh] items-center justify-center text-[12px] text-[#9CA3AF]">Aucun fichier disponible.</div>
              ) : preview.mime_type === "application/pdf" ? (
                <iframe title={preview.file_name ?? "Justificatif PDF"} src={preview.signedUrl} className="h-[72vh] w-full rounded-lg bg-white" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview.signedUrl} alt={preview.file_name ?? "Justificatif"} className="mx-auto max-h-[72vh] max-w-full rounded-lg object-contain" />
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
