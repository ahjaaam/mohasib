"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArchiveRestore,
  Camera,
  CheckCircle,
  Download,
  Eye,
  FileText,
  Loader2,
  ReceiptText,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { visibleDocumentAreas } from "@/lib/document-area";
import { useAccountOwnerId } from "@/hooks/useAccountOwner";
import { useGlobalPeriod } from "@/hooks/useGlobalPeriod";
import { cgncAccounts, categoryToCompte } from "@/lib/cgnc-accounts";
import { computePurchaseAmounts } from "@/lib/purchase-booking";
import { TRANSACTION_CATEGORIES } from "@/lib/utils";
import type { Receipt, ReceiptStatus } from "@/types";

interface ReceiptWithUrl extends Receipt {
  signedUrl?: string;
}

type StatusFilter = "all" | ReceiptStatus;

interface ConfirmationForm {
  amount: string;
  date: string;
  description: string;
  category: string;
  tvaRate: string;
  account: string;
}

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

const STATUS_META: Record<ReceiptStatus, { label: string; backgroundColor: string; color: string }> = {
  pending: { label: "À traiter", backgroundColor: "#FEF3C7", color: "#92400E" },
  matched: { label: "Traité", backgroundColor: "#D1FAE5", color: "#065F46" },
  ignored: { label: "Archivé", backgroundColor: "#F3F4F6", color: "#6B7280" },
};

export default function ReceiptsManager({ dossierId }: { dossierId?: string } = {}) {
  const ownerId = useAccountOwnerId();
  const { period: globalPeriod } = useGlobalPeriod();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [receipts, setReceipts] = useState<ReceiptWithUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [source, setSource] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [preview, setPreview] = useState<ReceiptWithUrl | null>(null);
  const [confirming, setConfirming] = useState<ReceiptWithUrl | null>(null);
  const [confirmationForm, setConfirmationForm] = useState<ConfirmationForm | null>(null);
  const [booking, setBooking] = useState(false);
  const [mutating, setMutating] = useState<Set<string>>(new Set());

  useEffect(() => {
    setDateFrom(globalPeriod.start);
    setDateTo(globalPeriod.end);
  }, [globalPeriod.start, globalPeriod.end]);

  const load = useCallback(async () => {
    setLoading(true);
    let request = supabase
      .from("receipts")
      .select("*")
      .in("document_area", visibleDocumentAreas("expenses"))
      .order("created_at", { ascending: false });
    request = dossierId
      ? request.eq("dossier_id", dossierId)
      : request.eq("user_id", ownerId).is("dossier_id", null);

    const { data, error } = await request;
    if (error) {
      toast.error("Impossible de charger les notes de frais.");
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as Receipt[];
    const withUrls = await Promise.all(rows.map(async (receipt) => {
      if (!receipt.storage_path) return receipt;
      const { data: urlData } = await supabase.storage.from("receipts").createSignedUrl(receipt.storage_path, 5 * 60);
      return { ...receipt, signedUrl: urlData?.signedUrl };
    }));
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
        body.append("document_area", "supporting_document");
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
      toast.success(`${imported} note${imported > 1 ? "s" : ""} de frais importée${imported > 1 ? "s" : ""}`);
      await load();
    }
    setUploading(false);
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
    toast.success(nextStatus === "pending" ? "Note de frais remise à traiter" : "Note de frais archivée");
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
    toast.success("Note de frais supprimée");
  }

  function reviewAndConfirm(receipt: ReceiptWithUrl) {
    const category = receipt.ocr_data.category ?? "Achats";
    setConfirmationForm({
      amount: String(Math.abs(Number(receipt.ocr_data.amount ?? 0)) || ""),
      date: receipt.ocr_data.date ?? new Date().toISOString().slice(0, 10),
      description: receipt.ocr_data.description ?? receiptVendor(receipt),
      category,
      tvaRate: String(receipt.ocr_data.tva_rate ?? 0),
      account: receipt.ocr_data.compte ?? categoryToCompte[category] ?? "6111",
    });
    setPreview(null);
    setConfirming(receipt);
  }

  function updateConfirmationForm(field: keyof ConfirmationForm, value: string) {
    setConfirmationForm((current) => {
      if (!current) return current;
      if (field === "category") {
        return { ...current, category: value, account: categoryToCompte[value] ?? current.account };
      }
      return { ...current, [field]: value };
    });
  }

  async function confirmBooking() {
    if (!confirming || !confirmationForm) return;
    const amount = Number(confirmationForm.amount);
    const tvaRate = Number(confirmationForm.tvaRate || 0);
    if (!Number.isFinite(amount) || amount <= 0 || !confirmationForm.account || !confirmationForm.description) {
      toast.error("Vérifiez le montant, la description et le compte comptable.");
      return;
    }

    setBooking(true);
    const amounts = computePurchaseAmounts({ amount, tva_rate: tvaRate });
    const confirmedOcr = {
      ...confirming.ocr_data,
      amount: -Math.abs(amount),
      type: "expense" as const,
      date: confirmationForm.date,
      description: confirmationForm.description,
      category: confirmationForm.category,
      tva_rate: tvaRate,
      tva_amount: amounts.tvaAmount,
      compte: confirmationForm.account,
      is_supplier_invoice: confirming.ocr_data.is_supplier_invoice ?? true,
    };

    const { error: updateError } = await supabase
      .from("receipts")
      .update({ ocr_data: confirmedOcr })
      .eq("id", confirming.id);
    if (updateError) {
      toast.error("Impossible d’enregistrer les données de la note de frais.");
      setBooking(false);
      return;
    }

    const bookingResponse = await fetch("/api/accounting/book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "purchase", receiptId: confirming.id, dossierId }),
    });
    const bookingResult = await bookingResponse.json().catch(() => ({}));
    if (!bookingResponse.ok) {
      toast.error(bookingResult.message ?? bookingResult.error ?? "La comptabilisation a échoué.");
      setBooking(false);
      return;
    }

    const statusResponse = await fetch(`/api/receipts/${confirming.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "matched" }),
    });
    if (!statusResponse.ok) {
      toast.error("L’écriture est créée, mais le statut de la note de frais n’a pas été mis à jour.");
      setBooking(false);
      return;
    }
    if (dossierId) {
      await supabase.from("dossiers").update({ derniere_ecriture: new Date().toISOString() }).eq("id", dossierId);
    }

    setReceipts((current) => current.map((receipt) => receipt.id === confirming.id
      ? { ...receipt, status: "matched", ocr_data: confirmedOcr }
      : receipt));
    setBooking(false);
    setConfirming(null);
    setConfirmationForm(null);
    toast.success("Note de frais comptabilisée dans Écritures.");
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
  const confirmationAmounts = confirmationForm
    ? computePurchaseAmounts({
        amount: Number(confirmationForm.amount || 0),
        tva_rate: Number(confirmationForm.tvaRate || 0),
      })
    : null;
  const confirmationAccountLabel = confirmationForm
    ? cgncAccounts.find((account) => account.code === confirmationForm.account)?.label ?? "Compte de charge"
    : "";

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[rgba(200,146,74,0.12)]">
            <ReceiptText size={18} className="text-[#C8924A]" />
          </div>
          <div>
            <h1 className="text-[18px] font-bold leading-none text-[#1A1A2E]">Notes de frais</h1>
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
            <div className="text-[12.5px] font-semibold text-[#1A1A2E]">Déposez vos notes de frais ici</div>
            <div className="text-[11px] text-[#9CA3AF]">PDF, JPG, PNG ou WebP · 10 Mo maximum · extraction automatique</div>
          </div>
          <div className="flex flex-wrap gap-2 sm:flex-shrink-0">
            <button
              data-permission="document:create"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="btn btn-outline"
            >
              {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
              {uploading ? "Importation…" : "Importer des documents"}
            </button>
            <button
              data-permission="document:create"
              disabled={uploading}
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
            {receipts.length ? "Aucune note de frais ne correspond aux filtres." : "Aucune note de frais pour le moment."}
          </p>
          {!receipts.length && (
            <button onClick={() => fileInputRef.current?.click()} className="btn btn-gold mt-4 text-[12px]">
              <Upload size={12} /> Importer le premier
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[rgba(0,0,0,0.08)] bg-white">
          <div className="hidden grid-cols-[minmax(240px,1.5fr)_1fr_130px_130px_210px] gap-3 border-b border-gray-100 bg-[#FAFAF8] px-4 py-2 text-[10.5px] font-semibold uppercase tracking-wide text-[#8A909B] md:grid">
            <span>Note de frais</span><span>Fournisseur</span><span>Montant</span><span>Statut</span><span className="text-right">Actions</span>
          </div>
          {filtered.map((receipt) => {
            const meta = STATUS_META[receipt.status];
            const busy = mutating.has(receipt.id);
            return (
              <div key={receipt.id} className="grid gap-3 border-b border-gray-100 px-4 py-3 last:border-b-0 md:grid-cols-[minmax(240px,1.5fr)_1fr_130px_130px_210px] md:items-center">
                <button onClick={() => setPreview(receipt)} className="flex min-w-0 items-center gap-3 text-left">
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[#F4F1EA] text-[#C8924A]">
                    <FileText size={17} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[12.5px] font-semibold text-[#1A1A2E]">{receipt.file_name ?? "Note de frais sans nom"}</span>
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
                  <span
                    className="table-status-badge"
                    style={{ backgroundColor: meta.backgroundColor, color: meta.color }}
                  >
                    {meta.label}
                  </span>
                </div>
                <div className="flex items-center justify-end gap-1">
                  {receipt.status === "pending" && (
                    <button
                      data-permission="document:create"
                      disabled={busy}
                      title="Vérifier les données avant de comptabiliser"
                      onClick={() => reviewAndConfirm(receipt)}
                      className="mr-1 inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-emerald-600 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50"
                    >
                      <CheckCircle size={13} /> Confirmer
                    </button>
                  )}
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

      {confirming && confirmationForm && confirmationAmounts && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4" onClick={() => { if (!booking) setConfirming(null); }}>
          <div className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h2 className="text-[16px] font-bold text-[#1A1A2E]">Vérifier et comptabiliser</h2>
                <p className="mt-0.5 text-[11px] text-[#8A909B]">{confirming.file_name ?? receiptVendor(confirming)} · aucune écriture ne sera créée avant la confirmation finale</p>
              </div>
              <button disabled={booking} onClick={() => setConfirming(null)} className="rounded-md p-2 text-[#6B7280] hover:bg-gray-100 disabled:opacity-50"><X size={18} /></button>
            </div>

            <div className="grid gap-3 p-5 sm:grid-cols-2">
              <label>
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#8A909B]">Montant TTC (MAD)</span>
                <input type="number" min="0" step="0.01" className="input w-full" value={confirmationForm.amount} onChange={(event) => updateConfirmationForm("amount", event.target.value)} />
              </label>
              <label>
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#8A909B]">Date</span>
                <input type="date" className="input w-full" value={confirmationForm.date} onChange={(event) => updateConfirmationForm("date", event.target.value)} />
              </label>
              <label className="sm:col-span-2">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#8A909B]">Description</span>
                <input className="input w-full" value={confirmationForm.description} onChange={(event) => updateConfirmationForm("description", event.target.value)} />
              </label>
              <label>
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#8A909B]">Catégorie</span>
                <select className="input w-full" value={confirmationForm.category} onChange={(event) => updateConfirmationForm("category", event.target.value)}>
                  {TRANSACTION_CATEGORIES.expense.map((category) => <option key={category}>{category}</option>)}
                </select>
              </label>
              <label>
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#8A909B]">TVA</span>
                <select className="input w-full" value={confirmationForm.tvaRate} onChange={(event) => updateConfirmationForm("tvaRate", event.target.value)}>
                  <option value="0">Aucune TVA</option>
                  <option value="7">7%</option>
                  <option value="10">10%</option>
                  <option value="14">14%</option>
                  <option value="20">20%</option>
                </select>
              </label>
              <label className="sm:col-span-2">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#8A909B]">Compte de charge</span>
                <select className="input w-full" value={confirmationForm.account} onChange={(event) => updateConfirmationForm("account", event.target.value)}>
                  {cgncAccounts.filter((account) => account.code.startsWith("6") || account.code.startsWith("2")).map((account) => (
                    <option key={account.code} value={account.code}>{account.code} — {account.label}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mx-5 mb-5 overflow-hidden rounded-xl border border-[rgba(0,0,0,0.10)]">
              <div className="flex items-center justify-between border-b border-gray-100 bg-[#FAFAF8] px-4 py-3">
                <div>
                  <div className="text-[12px] font-bold text-[#1A1A2E]">Écriture qui sera créée</div>
                  <div className="text-[10.5px] text-[#8A909B]">Journal AC · Achat fournisseur</div>
                </div>
                <span className="text-[10px] font-semibold text-emerald-700">Équilibrée</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-[11.5px]">
                  <thead className="bg-white text-[9.5px] uppercase tracking-wide text-[#9CA3AF]">
                    <tr><th className="px-4 py-2 text-left">Compte</th><th className="px-4 py-2 text-left">Libellé</th><th className="px-4 py-2 text-right">Débit</th><th className="px-4 py-2 text-right">Crédit</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr>
                      <td className="px-4 py-2.5 font-mono font-semibold text-[#C8924A]">{confirmationForm.account}</td>
                      <td className="px-4 py-2.5 text-[#4B5563]">{confirmationAccountLabel}</td>
                      <td className="px-4 py-2.5 text-right font-semibold">{formatAmount(confirmationAmounts.totalHt)}</td>
                      <td className="px-4 py-2.5 text-right text-[#9CA3AF]">—</td>
                    </tr>
                    {confirmationAmounts.tvaAmount > 0 && (
                      <tr>
                        <td className="px-4 py-2.5 font-mono font-semibold text-[#C8924A]">3455</td>
                        <td className="px-4 py-2.5 text-[#4B5563]">État TVA récupérable</td>
                        <td className="px-4 py-2.5 text-right font-semibold">{formatAmount(confirmationAmounts.tvaAmount)}</td>
                        <td className="px-4 py-2.5 text-right text-[#9CA3AF]">—</td>
                      </tr>
                    )}
                    <tr>
                      <td className="px-4 py-2.5 font-mono font-semibold text-[#C8924A]">4411</td>
                      <td className="px-4 py-2.5 text-[#4B5563]">Fournisseurs</td>
                      <td className="px-4 py-2.5 text-right text-[#9CA3AF]">—</td>
                      <td className="px-4 py-2.5 text-right font-semibold">{formatAmount(confirmationAmounts.totalTtc)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-4">
              <button disabled={booking} onClick={() => setConfirming(null)} className="btn btn-outline">Annuler</button>
              <button disabled={booking || confirmationAmounts.totalTtc <= 0} onClick={confirmBooking} className="btn btn-gold">
                {booking ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                {booking ? "Comptabilisation…" : "Confirmer et créer l’écriture"}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {preview && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onClick={() => setPreview(null)}>
          <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold text-[#1A1A2E]">{preview.file_name ?? "Note de frais"}</div>
                <div className="text-[10.5px] text-[#9CA3AF]">{receiptVendor(preview)} · {formatAmount(preview.ocr_data.amount, preview.ocr_data.currency ?? "MAD")}</div>
              </div>
              <div className="flex items-center gap-1">
                {preview.status === "pending" && (
                  <button
                    data-permission="document:create"
                    onClick={() => reviewAndConfirm(preview)}
                    className="btn btn-outline border-emerald-600 text-[12px] text-emerald-700 hover:bg-emerald-50"
                  >
                    <CheckCircle size={13} /> Vérifier et confirmer
                  </button>
                )}
                {preview.signedUrl && <a href={preview.signedUrl} download={preview.file_name ?? true} className="btn btn-outline text-[12px]"><Download size={13} /> Télécharger</a>}
                <button onClick={() => setPreview(null)} className="rounded-md p-2 text-[#6B7280] hover:bg-gray-100"><X size={18} /></button>
              </div>
            </div>
            <div className="min-h-[60vh] flex-1 bg-[#F3F4F6] p-3">
              {!preview.signedUrl && !preview.storage_path ? (
                <div className="flex h-full min-h-[60vh] items-center justify-center text-[12px] text-[#9CA3AF]">Aucun fichier disponible.</div>
              ) : preview.mime_type === "application/pdf" ? (
                <iframe title={preview.file_name ?? "Note de frais PDF"} src={`/api/receipts/${preview.id}/content`} className="h-[72vh] w-full rounded-lg bg-white" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview.signedUrl} alt={preview.file_name ?? "Note de frais"} className="mx-auto max-h-[72vh] max-w-full rounded-lg object-contain" />
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
