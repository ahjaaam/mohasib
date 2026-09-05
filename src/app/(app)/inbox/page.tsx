"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { visibleDocumentAreas } from "@/lib/document-area";
import type { Receipt, OcrData } from "@/types";
import { normalizeExpenseCategory, TRANSACTION_CATEGORIES } from "@/lib/utils";
import { cgncAccounts, categoryToCompte, expenseNoteCategoryToCompte } from "@/lib/cgnc-accounts";
import { computePurchaseAmounts, shouldBookConfirmedPurchase } from "@/lib/purchase-booking";
import { evaluateInvoiceControls, highestInvoiceControlSeverity, type InvoiceControlCheck } from "@/lib/invoice-controls";
import { Upload, CheckCircle, X, Loader2, Camera, FileText, Eye, Download, Inbox, Mail, RefreshCw, Search, FolderOpen, Clipboard, CalendarDays, AlertCircle, ShieldCheck, UserCheck, Clock3, Building2, Pencil, LayoutGrid, Rows3, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from "lucide-react";
import toast from "react-hot-toast";
import { useAccountOwnerId } from "@/hooks/useAccountOwner";
import { useGlobalPeriod } from "@/hooks/useGlobalPeriod";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return Math.abs(n).toLocaleString("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(d: string) {
  try { return new Date(d).toLocaleDateString("fr-MA", { day: "2-digit", month: "2-digit", year: "numeric" }); }
  catch { return d; }
}

function addDays(date: string | null | undefined, days: number) {
  if (!date) return "";
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return "";
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function computeAmounts(ocr: OcrData) {
  const amounts = computePurchaseAmounts({
    amount: ocr.amount ?? ocr.amount_ttc ?? 0,
    discount_amount: ocr.discount_amount ?? 0,
    tva_amount: ocr.tva_amount ?? ocr.tax_amount ?? 0,
    tva_rate: ocr.tva_rate ?? 0,
  });
  return {
    ht: amounts.totalHt,
    tva: amounts.tvaAmount,
    remise: amounts.discountAmount,
    ttc: amounts.totalTtc,
  };
}

function matchesInvoiceSearch(receipt: Receipt, query: string) {
  if (!query) return true;
  const ocr = receipt.ocr_data;
  const searchable = [
    receipt.file_name,
    ocr.vendor_name,
    ocr.vendor,
    ocr.receipt_number,
    ocr.invoice_number,
    ocr.description,
    ocr.supplier_ice,
    ocr.supplier_if,
    ocr.date,
    ocr.due_date,
    ocr.amount,
    ocr.amount_ttc,
  ]
    .filter((value) => value !== null && value !== undefined && value !== "")
    .join(" ")
    .toLocaleLowerCase("fr");
  return searchable.includes(query);
}

function invoiceSource(receipt: Receipt) {
  const provider = (receipt.ocr_data as Record<string, unknown>).email_provider;
  return provider === "gmail"
    ? "Gmail"
    : provider === "outlook"
      ? "Outlook"
      : provider === "inbound"
        ? "Email reçu"
        : "Import manuel";
}

function matchesInvoiceFilters(receipt: Receipt, query: string, source: string, dateFrom: string, dateTo: string) {
  if (!matchesInvoiceSearch(receipt, query)) return false;
  if (source !== "all" && invoiceSource(receipt) !== source) return false;
  const invoiceDate = receipt.ocr_data.date ?? receipt.created_at.slice(0, 10);
  if (dateFrom && invoiceDate < dateFrom) return false;
  if (dateTo && invoiceDate > dateTo) return false;
  return true;
}

const ALL_CATS = TRANSACTION_CATEGORIES.expense;
const TVA_OPTIONS = [
  { label: "Aucune TVA", value: "" },
  { label: "7%", value: "7" },
  { label: "10%", value: "10" },
  { label: "14%", value: "14" },
  { label: "20%", value: "20" },
];

type Tab = "pending" | "matched" | "suppliers" | "ignored";

interface ReceiptWithUrl extends Receipt { signedUrl?: string; }

interface CardForm {
  supplier: string;
  amount: string;
  discount_amount: string;
  category: string;
  description: string;
  date: string;
  due_date: string;
  tva_rate: string;
  compte_comptable: string;
}

interface UploadingFile {
  tempId: string;
  name: string;
  state: "uploading" | "processing" | "done" | "error";
  error?: string;
}

interface SupplierSummary {
  key: string;
  name: string;
  receiptIds: string[];
  ice: string | null;
  fiscalId: string | null;
  rib: string | null;
  iban: string | null;
  invoiceCount: number;
  totalTtc: number;
  latestDate: string;
}

function supplierSummaries(receipts: ReceiptWithUrl[], includeNonSupplier = false): SupplierSummary[] {
  const suppliers = new Map<string, SupplierSummary>();

  for (const receipt of receipts) {
    if (receipt.status === "ignored" || (!includeNonSupplier && receipt.ocr_data.is_supplier_invoice === false)) continue;
    const name = (receipt.ocr_data.vendor_name ?? receipt.ocr_data.vendor ?? "").trim();
    if (!name) continue;

    const normalizedName = name.toLocaleLowerCase("fr").replace(/\s+/g, " ");
    const ice = receipt.ocr_data.supplier_ice?.trim() || null;
    const existingEntry = [...suppliers.entries()].find(([, supplier]) =>
      supplier.key === normalizedName || Boolean(ice && supplier.ice === ice),
    );
    const key = existingEntry?.[0] ?? normalizedName;
    const date = receipt.ocr_data.date ?? receipt.created_at?.slice(0, 10) ?? "";
    const amount = Math.abs(Number(receipt.ocr_data.amount_ttc ?? receipt.ocr_data.amount ?? 0));
    const current = existingEntry?.[1];

    if (!current) {
      suppliers.set(key, {
        key,
        name,
        receiptIds: [receipt.id],
        ice,
        fiscalId: receipt.ocr_data.supplier_if?.trim() || null,
        rib: receipt.ocr_data.supplier_rib?.trim() || null,
        iban: receipt.ocr_data.supplier_iban?.trim() || null,
        invoiceCount: 1,
        totalTtc: amount,
        latestDate: date,
      });
      continue;
    }

    current.invoiceCount += 1;
    current.receiptIds.push(receipt.id);
    current.totalTtc += amount;
    current.ice ||= ice;
    current.fiscalId ||= receipt.ocr_data.supplier_if?.trim() || null;
    current.rib ||= receipt.ocr_data.supplier_rib?.trim() || null;
    current.iban ||= receipt.ocr_data.supplier_iban?.trim() || null;
    if (date > current.latestDate) {
      current.latestDate = date;
      current.name = name;
    }
  }

  return [...suppliers.values()].sort((a, b) => a.name.localeCompare(b.name, "fr"));
}


function initForm(ocr: OcrData, expenseNotes = false): CardForm {
  const vendor = ocr.vendor_name ?? ocr.vendor ?? "";
  const desc = ocr.description ?? "";
  const signedAmt = typeof ocr.amount === "number"
    ? String(ocr.amount)
    : ocr.type === "expense" && ocr.amount != null
      ? String(-Math.abs(ocr.amount))
      : String(ocr.amount ?? "");
  const category = expenseNotes ? normalizeExpenseCategory(ocr.category) : ocr.category ?? "Achats";
  const categoryAccount = (expenseNotes ? expenseNoteCategoryToCompte : categoryToCompte)[category] ?? "";
  const compte = expenseNotes && ocr.compte === "6111" ? categoryAccount : ocr.compte ?? categoryAccount;
  const tvaRate = ocr.tva_rate ?? (!expenseNotes && ocr.amount != null ? 20 : null);
  const invoiceDate = ocr.date ?? new Date().toISOString().split("T")[0];
  return {
    supplier: vendor,
    amount: signedAmt,
    discount_amount: String(ocr.discount_amount ?? ""),
    category,
    description: vendor ? (desc ? `${vendor} — ${desc}` : vendor) : desc,
    date: invoiceDate,
    due_date: ocr.due_date ?? (expenseNotes ? "" : addDays(invoiceDate, 60)),
    tva_rate: String(tvaRate ?? ""),
    compte_comptable: compte,
  };
}

const sessionLocalUrls: Record<string, string> = {};

function ConfidenceBadge({ confidence, overallConfidence }: { confidence?: number | null; overallConfidence?: string | null }) {
  const level = overallConfidence
    ?? (confidence == null ? null : confidence >= 0.8 ? "high" : confidence >= 0.5 ? "medium" : "low");
  if (!level) return null;
  if (level === "high")
    return <span className="text-[9.5px] font-semibold px-1.5 py-0.5 rounded-full bg-[#D1FAE5] text-[#065F46]">IA sûre</span>;
  if (level === "medium")
    return <span className="text-[9.5px] font-semibold px-1.5 py-0.5 rounded-full bg-[#FEF3C7] text-[#92400E]">À vérifier</span>;
  return <span className="text-[9.5px] font-semibold px-1.5 py-0.5 rounded-full bg-[#FEE2E2] text-[#991B1B]">Saisie manuelle</span>;
}

function SourceBadge({ provider }: { provider?: string }) {
  if (provider === "gmail") {
    return (
      <span className="inline-flex items-center gap-1 text-[9.5px] font-semibold px-1.5 py-0.5 rounded-full bg-[#FEE2E2] text-[#991B1B]">
        <Mail size={9} /> Gmail
      </span>
    );
  }
  if (provider === "outlook") {
    return (
      <span className="inline-flex items-center gap-1 text-[9.5px] font-semibold px-1.5 py-0.5 rounded-full bg-[#DBEAFE] text-[#1E40AF]">
        <Mail size={9} /> Outlook
      </span>
    );
  }
  return null;
}

function ControlBadge({ checks }: { checks?: InvoiceControlCheck[] }) {
  const availableChecks = checks ?? [];
  const severity = highestInvoiceControlSeverity(availableChecks);
  const relevantChecks = availableChecks.filter(check => check.severity === severity && check.code !== "automatic_checks_complete");
  const primaryCheck = relevantChecks[0];
  const details = relevantChecks.map(check => `${check.title} : ${check.message}`).join("\n");
  const extraCount = Math.max(0, relevantChecks.length - 1);
  if (severity === "critical") {
    return (
      <span title={details} className="inline-flex max-w-[260px] items-center gap-1 rounded-full border border-[#E8C98F] bg-[#FFF7E8] px-2 py-0.5 text-[9.5px] font-bold text-[#946323]">
        <AlertCircle size={10} className="flex-shrink-0" />
        <span className="truncate">Anomalie : {primaryCheck?.title ?? "contrôle bloquant"}</span>
        {extraCount > 0 && <span className="flex-shrink-0">+{extraCount}</span>}
      </span>
    );
  }
  if (severity === "warning") {
    return (
      <span title={details} className="inline-flex max-w-[260px] items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[9.5px] font-bold text-amber-700">
        <AlertCircle size={10} className="flex-shrink-0" />
        <span className="truncate">À vérifier : {primaryCheck?.title ?? "informations incomplètes"}</span>
        {extraCount > 0 && <span className="flex-shrink-0">+{extraCount}</span>}
      </span>
    );
  }
  return <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[9.5px] font-bold text-emerald-700"><ShieldCheck size={10} /> Contrôlé</span>;
}

function ApprovalBadge({ status }: { status?: Receipt["approval_status"] }) {
  if (!status || status === "not_requested") return null;
  const style = status === "approved"
    ? "bg-emerald-50 text-emerald-700"
    : status === "rejected"
      ? "bg-red-50 text-red-700"
      : "bg-blue-50 text-blue-700";
  const label = status === "approved" ? "Validée" : status === "rejected" ? "Refusée" : "Validation en attente";
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-bold ${style}`}><UserCheck size={10} /> {label}</span>;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

type InboxWorkspace = "purchases" | "expenses";

export default function InboxPage({
  dossierId,
  inboxEmail,
  workspace = "purchases",
}: {
  dossierId?: string;
  inboxEmail?: string | null;
  workspace?: InboxWorkspace;
} = {}) {
  const isExpenseNotes = workspace === "expenses";
  const ownerId = useAccountOwnerId();
  const { period: globalPeriod } = useGlobalPeriod();
  const supabase = createClient();
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [receipts, setReceipts] = useState<ReceiptWithUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [tab, setTab] = useState<Tab>("pending");
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoiceSourceFilter, setInvoiceSourceFilter] = useState("all");
  const [invoiceDateFrom, setInvoiceDateFrom] = useState("");
  const [invoiceDateTo, setInvoiceDateTo] = useState("");
  const [forms, setForms] = useState<Record<string, CardForm>>({});
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [savingEdits, setSavingEdits] = useState<Set<string>>(new Set());
  const [dirtyReceipts, setDirtyReceipts] = useState<Set<string>>(new Set());
  const [dismissing, setDismissing] = useState<Set<string>>(new Set());
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [previewReceipt, setPreviewReceipt] = useState<ReceiptWithUrl | null>(null);
  const autoOpenedDocumentRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(ownerId);
    const receiptsQuery = supabase
      .from("receipts")
      .select("*")
      .in("document_area", visibleDocumentAreas(workspace))
      .order("created_at", { ascending: false });
    const { data } = await (dossierId
      ? receiptsQuery.eq("dossier_id", dossierId)
      : receiptsQuery.eq("user_id", ownerId).is("dossier_id", null));
    const list: Receipt[] = data ?? [];
    const withUrls: ReceiptWithUrl[] = await Promise.all(list.map(async (r) => {
      let signedUrl: string | undefined;
      if (r.storage_path) {
        const { data: urlData } = await supabase.storage
          .from("receipts").createSignedUrl(r.storage_path, 60 * 60);
        signedUrl = urlData?.signedUrl ?? undefined;
      }
      return {
        ...r,
        control_status: r.control_status ?? (r.status === "matched" ? "recorded" : "review"),
        approval_status: r.approval_status ?? "not_requested",
        control_checks: evaluateInvoiceControls(
          r.ocr_data,
          list.filter(item => item.id !== r.id && String(item.created_at ?? "") < String(r.created_at ?? "")),
        ),
        signedUrl: sessionLocalUrls[r.id] ?? signedUrl,
      };
    }));
    setReceipts(withUrls);
    setForms((prev) => {
      const next = { ...prev };
      withUrls.filter((r) => r.status === "pending").forEach((r) => {
        if (!next[r.id]) next[r.id] = initForm(r.ocr_data, isExpenseNotes);
      });
      return next;
    });


    setLoading(false);
  }, [dossierId, workspace]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const requestedSearch = new URLSearchParams(window.location.search).get("search");
    if (requestedSearch) setInvoiceSearch(requestedSearch);
  }, []);

  useEffect(() => {
    setInvoiceDateFrom(globalPeriod.start);
    setInvoiceDateTo(globalPeriod.end);
  }, [globalPeriod.start, globalPeriod.end]);

  useEffect(() => {
    if (loading || previewReceipt) return;
    const documentId = new URLSearchParams(window.location.search).get("document_id");
    if (!documentId || autoOpenedDocumentRef.current === documentId) return;
    const receipt = receipts.find(item => item.id === documentId);
    if (!receipt) return;
    autoOpenedDocumentRef.current = documentId;
    setTab(receipt.status === "matched" ? "matched" : receipt.status === "ignored" ? "ignored" : "pending");
    setPreviewReceipt(receipt);
  }, [loading, previewReceipt, receipts]);

  function closePreview() {
    setPreviewReceipt(null);
    const url = new URL(window.location.href);
    if (url.searchParams.has("document_id")) {
      url.searchParams.delete("document_id");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }

  useEffect(() => {
    const handler = () => fileInputRef.current?.click();
    document.addEventListener("inbox-upload", handler);
    return () => document.removeEventListener("inbox-upload", handler);
  }, []);

  useEffect(() => {
    if (!previewReceipt) return;
    const updated = receipts.find((r) => r.id === previewReceipt.id);
    if (updated) setPreviewReceipt(updated);
  }, [receipts]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Upload ────────────────────────────────────────────────────────────────

  async function handleFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    for (const file of arr) {
      const tempId = crypto.randomUUID();
      const objectUrl = URL.createObjectURL(file);
      setUploadingFiles((prev) => [...prev, { tempId, name: file.name, state: "uploading" }]);
      try {
        setUploadingFiles((prev) => prev.map((f) => f.tempId === tempId ? { ...f, state: "processing" } : f));
        const fd = new FormData();
        fd.append("file", file);
        fd.append("document_area", isExpenseNotes ? "supporting_document" : "purchase");
        if (dossierId) fd.append("dossier_id", dossierId);
        const res = await fetch("/api/ocr", { method: "POST", body: fd });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Erreur");
        if (json.receipt?.id) {
          sessionLocalUrls[json.receipt.id] = objectUrl;
        }
        setUploadingFiles((prev) => prev.map((f) => f.tempId === tempId ? { ...f, state: "done" } : f));
        await load();
        setTab("pending");
        setTimeout(() => setUploadingFiles((prev) => prev.filter((f) => f.tempId !== tempId)), 1200);
      } catch (err: any) {
        setUploadingFiles((prev) => prev.map((f) => f.tempId === tempId ? { ...f, state: "error", error: err.message } : f));
        setTimeout(() => setUploadingFiles((prev) => prev.filter((f) => f.tempId !== tempId)), 4000);
      }
    }
  }

  // ── Confirm / Ignore ──────────────────────────────────────────────────────

  async function handleEmailSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/email/sync", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Erreur de synchronisation");
      if (json.imported > 0) {
        toast.success(`${json.imported} document(s) importé(s)`);
        await load();
      } else if (json.not_connected) {
        toast("Connectez votre email dans Paramètres → Intégrations", { icon: <Mail size={16} aria-hidden="true" /> });
        router.push("/parametres?tab=integrations");
      } else if (json.errors?.length) {
        toast.error(json.errors.join(" "), { duration: 5000 });
      } else {
        toast(
          `${json.messagesScanned ?? 0} email(s) vérifié(s), `
          + `${json.attachmentsFound ?? 0} pièce(s) jointe(s), `
          + `${json.skipped ?? 0} déjà importée(s), `
          + `${json.failed ?? 0} échec(s).`,
          { duration: 6000 },
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur de synchronisation");
    } finally {
      setSyncing(false);
    }
  }

  async function confirmReceipt(id: string) {
    const receipt = receipts.find((r) => r.id === id);
    const form = forms[id];
    if (!form || !receipt) return;
    if (receipt.approval_status === "pending") {
      toast.error("Cette facture attend encore la validation de la personne désignée.");
      return;
    }
    if (receipt.approval_status === "rejected") {
      toast.error("Cette facture a été refusée. Corrigez-la ou demandez une nouvelle validation.");
      return;
    }
    setSaving((s) => new Set([...s, id]));

    const isAvoir = !isExpenseNotes && (receipt.ocr_data as any).document_type === "avoir";

    if (isAvoir) {
      const { ht, tva, ttc } = computeAmounts(receipt.ocr_data);
      const year = new Date().getFullYear();
      const { data: lastAv } = await supabase
        .from("avoirs_fournisseurs")
        .select("numero_interne")
        .eq("user_id", userId)
        .ilike("numero_interne", `AV-FOURN-${year}-%`)
        .order("created_at", { ascending: false })
        .limit(1);
      const lastNum = lastAv?.[0]
        ? parseInt(lastAv[0].numero_interne.split("-").pop() ?? "0", 10) : 0;
      const numero = `AV-FOURN-${year}-${String(lastNum + 1).padStart(4, "0")}`;

      const { error } = await supabase.from("avoirs_fournisseurs").insert({
        user_id: userId,
        ...(dossierId ? { dossier_id: dossierId } : {}),
        numero_interne: numero,
        fournisseur: form.supplier || receipt.ocr_data.vendor_name || receipt.ocr_data.vendor || form.description || "Fournisseur",
        ref_fournisseur: receipt.ocr_data.receipt_number ?? null,
        date: form.date,
        montant_ht: ht,
        tva_rate: receipt.ocr_data.tva_rate ?? 0,
        tva_amount: tva,
        total: ttc,
        motif: form.description || "Avoir fournisseur",
        compte_comptable: form.compte_comptable || "4411",
        statut: "recu",
      });

      if (error) {
        toast.error("Erreur lors de l'enregistrement");
        setSaving((s) => { s.delete(id); return new Set(s); });
        return;
      }
      await supabase.from("receipts").update({
        status: "matched",
        ocr_data: {
          ...receipt.ocr_data,
          vendor_name: form.supplier.trim() || null,
          vendor: form.supplier.trim() || null,
        },
      }).eq("id", id);
      setSaving((s) => { s.delete(id); return new Set(s); });
      advanceReviewAfterAction(id);
      dismissCard(id);
      toast.success(`Avoir fournisseur ${numero} enregistré !`);
      return;
    }

    const amt = parseFloat(form.amount);
    if (isNaN(amt)) {
      toast.error("Montant invalide");
      setSaving((s) => { s.delete(id); return new Set(s); });
      return;
    }
    const tvaRate = form.tva_rate ? parseFloat(form.tva_rate) : 0;
    const discountAmount = form.discount_amount ? parseFloat(form.discount_amount) : 0;
    if (!Number.isFinite(discountAmount) || discountAmount < 0) {
      toast.error("Remise invalide");
      setSaving((s) => { s.delete(id); return new Set(s); });
      return;
    }
    if (isExpenseNotes && !form.compte_comptable) {
      toast.error("Sélectionnez le compte comptable correspondant à la nature de la dépense.");
      setSaving((s) => { s.delete(id); return new Set(s); });
      return;
    }
    const confirmedAmounts = computePurchaseAmounts({ amount: amt, discount_amount: discountAmount, tva_rate: tvaRate });
    const confirmedOcr = {
      ...receipt.ocr_data,
      vendor_name: form.supplier.trim() || null,
      vendor: form.supplier.trim() || null,
      amount: amt,
      type: amt >= 0 ? "income" : "expense",
      date: form.date,
      due_date: form.due_date || receipt.ocr_data.due_date || null,
      is_supplier_invoice: receipt.ocr_data.is_supplier_invoice ?? true,
      category: form.category || receipt.ocr_data.category || null,
      description: form.description || receipt.ocr_data.description || null,
      tva_rate: tvaRate,
      tva_amount: confirmedAmounts.tvaAmount,
      discount_amount: confirmedAmounts.discountAmount,
      compte: form.compte_comptable || (receipt.ocr_data as any).compte || null,
    };
    const shouldBookPurchase = isExpenseNotes || shouldBookConfirmedPurchase(confirmedOcr);
    const { error: ocrUpdateError } = await supabase
      .from("receipts")
      .update({ ocr_data: confirmedOcr })
      .eq("id", id);
    if (ocrUpdateError) {
      toast.error("Erreur lors de la confirmation");
      setSaving((s) => { s.delete(id); return new Set(s); });
      return;
    }

    if (shouldBookPurchase) {
      const bookingResponse = await fetch("/api/accounting/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "purchase", receiptId: id, dossierId }),
      });
      const bookingResult = await bookingResponse.json().catch(() => ({}));
      if (!bookingResponse.ok) {
        toast.error(
          bookingResult.message
            ?? bookingResult.error
            ?? "La comptabilisation automatique a échoué.",
          { duration: 5000 },
        );
        setSaving((s) => { s.delete(id); return new Set(s); });
        return;
      }
    }

    const { error: statusUpdateError } = await supabase
      .from("receipts")
      .update({ status: "matched" })
      .eq("id", id);
    if (statusUpdateError) {
      toast.error(`${isExpenseNotes ? "La note de frais" : "La facture"} est comptabilisée, mais son statut n'a pas pu être mis à jour.`);
      setSaving((s) => { s.delete(id); return new Set(s); });
      return;
    }
    if (dossierId) {
      await supabase.from("dossiers").update({ derniere_ecriture: new Date().toISOString() }).eq("id", dossierId);
    }
    setSaving((s) => { s.delete(id); return new Set(s); });
    advanceReviewAfterAction(id);
    dismissCard(id);
    if (shouldBookPurchase) {
      toast.success(isExpenseNotes ? "Note de frais comptabilisée !" : "Facture fournisseur comptabilisée et ajoutée au suivi fournisseurs !");
    } else {
      toast.success(isExpenseNotes ? "Note de frais confirmée !" : "Facture fournisseur confirmée !");
    }
  }

  async function saveReceiptEdits(id: string) {
    const receipt = receipts.find((item) => item.id === id);
    const form = forms[id];
    if (!receipt || !form) return;

    const amount = Number.parseFloat(form.amount);
    if (!Number.isFinite(amount)) {
      toast.error("Montant invalide");
      return;
    }
    const tvaRate = form.tva_rate ? Number.parseFloat(form.tva_rate) : 0;
    const discountAmount = form.discount_amount ? Number.parseFloat(form.discount_amount) : 0;
    if (!Number.isFinite(discountAmount) || discountAmount < 0) {
      toast.error("Remise invalide");
      return;
    }

    const amounts = computePurchaseAmounts({
      amount,
      discount_amount: discountAmount,
      tva_rate: tvaRate,
    });
    const editedOcr: OcrData = {
      ...receipt.ocr_data,
      vendor_name: form.supplier.trim() || null,
      vendor: form.supplier.trim() || null,
      amount,
      type: amount >= 0 ? "income" : "expense",
      date: form.date,
      due_date: form.due_date || receipt.ocr_data.due_date || null,
      is_supplier_invoice: receipt.ocr_data.is_supplier_invoice ?? true,
      category: form.category || receipt.ocr_data.category || null,
      description: form.description || receipt.ocr_data.description || null,
      tva_rate: tvaRate,
      tva_amount: amounts.tvaAmount,
      discount_amount: amounts.discountAmount,
      compte: form.compte_comptable || receipt.ocr_data.compte || null,
    };

    setSavingEdits((current) => new Set([...current, id]));
    const { error } = await supabase
      .from("receipts")
      .update({ ocr_data: editedOcr })
      .eq("id", id);
    setSavingEdits((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });

    if (error) {
      toast.error("Les modifications n’ont pas pu être enregistrées.");
      return;
    }

    setReceipts((current) => current.map((item) => item.id === id ? { ...item, ocr_data: editedOcr } : item));
    setDirtyReceipts((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    toast.success(`Modifications enregistrées — ${isExpenseNotes ? "la note de frais" : "la facture"} reste à traiter.`);
    advanceReviewAfterAction(id);
  }

  async function ignoreReceipt(id: string) {
    const { error } = await supabase.from("receipts").update({ status: "ignored" }).eq("id", id);
    if (error) {
      toast.error(`${isExpenseNotes ? "La note de frais" : "La facture"} n’a pas pu être ignorée.`);
      return;
    }
    advanceReviewAfterAction(id);
    dismissCard(id);
  }

  async function recoverReceipt(id: string) {
    await supabase.from("receipts").update({ status: "pending" }).eq("id", id);
    await load();
    setTab("pending");
  }

  function dismissCard(id: string) {
    setDismissing((s) => new Set([...s, id]));
    setTimeout(async () => {
      setDismissing((s) => { s.delete(id); return new Set(s); });
      await load();
    }, 320);
  }

  function updateForm(id: string, field: keyof CardForm, val: string) {
    setDirtyReceipts((current) => new Set([...current, id]));
    setForms((f) => {
      const updated = { ...f[id], [field]: val };
      if (field === "category") {
        const categoryAccounts = isExpenseNotes ? expenseNoteCategoryToCompte : categoryToCompte;
        updated.compte_comptable = categoryAccounts[val] ?? f[id]?.compte_comptable ?? "";
      }
      return { ...f, [id]: updated };
    });
  }

  // ── Derived state ─────────────────────────────────────────────────────────

  const pending = receipts.filter((r) => r.status === "pending");
  const matched = receipts.filter((r) => r.status === "matched");
  const ignored = receipts.filter((r) => r.status === "ignored");
  const suppliers = supplierSummaries(receipts, isExpenseNotes);
  const normalizedInvoiceSearch = invoiceSearch.trim().toLocaleLowerCase("fr");
  const filteredPending = pending;
  const filteredMatched = matched.filter((receipt) => matchesInvoiceFilters(receipt, normalizedInvoiceSearch, invoiceSourceFilter, invoiceDateFrom, invoiceDateTo));
  const filteredIgnored = ignored.filter((receipt) => matchesInvoiceFilters(receipt, normalizedInvoiceSearch, invoiceSourceFilter, invoiceDateFrom, invoiceDateTo));
  const tabItems = tab === "pending" ? filteredPending : tab === "ignored" ? filteredIgnored : [];
  const hasActiveInvoiceFilters = tab !== "pending" && Boolean(normalizedInvoiceSearch || invoiceSourceFilter !== "all" || invoiceDateFrom || invoiceDateTo);
  const reviewReceipts = previewReceipt?.status === "pending" && !filteredPending.some((receipt) => receipt.id === previewReceipt.id)
    ? [previewReceipt, ...filteredPending]
    : filteredPending;
  const previewPendingIndex = previewReceipt ? reviewReceipts.findIndex((receipt) => receipt.id === previewReceipt.id) : -1;

  function moveReview(direction: -1 | 1) {
    if (previewPendingIndex < 0) return;
    const adjacentReceipt = reviewReceipts[previewPendingIndex + direction];
    if (adjacentReceipt) setPreviewReceipt(adjacentReceipt);
  }

  function advanceReviewAfterAction(id: string) {
    if (previewReceipt?.id !== id) return;
    const currentIndex = reviewReceipts.findIndex((receipt) => receipt.id === id);
    const nextReceipt = currentIndex >= 0
      ? reviewReceipts[currentIndex + 1] ?? reviewReceipts.find((receipt) => receipt.id !== id)
      : undefined;
    if (nextReceipt) {
      setPreviewReceipt(nextReceipt);
    } else {
      closePreview();
    }
  }

  return (
    <div>

      {/* ─── Page header ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(200,146,74,0.12)" }}>
          <Inbox size={18} className="text-[#C8924A]" />
        </div>
        <div>
          <h1 className="text-[18px] font-bold text-[#1A1A2E] leading-none">{isExpenseNotes ? "Notes de frais" : "Achats"}</h1>
          <p className="text-[11px] text-[#9CA3AF] mt-0.5">
            {isExpenseNotes ? "Justificatifs de dépenses — importez, vérifiez et confirmez" : "Factures fournisseurs — importez, vérifiez et confirmez"}
          </p>
        </div>
      </div>

      {/* ─── Section tabs ────────────────────────────────────────────────── */}
      <div className="tabs mb-5 overflow-x-auto">
        {([
          ["pending", "À traiter", pending.length],
          ["matched", "Traités", matched.length],
          ...(!isExpenseNotes ? [["suppliers", "Fournisseurs", suppliers.length] as const] : []),
          ["ignored", "Ignorés", ignored.length],
        ] as const).map(([key, label, count]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`tab flex flex-shrink-0 items-center whitespace-nowrap ${tab === key ? "active" : ""}`}>
            {label}
            {count > 0 && (
              <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                tab === key ? "bg-[rgba(13,21,38,0.08)] text-[#0D1526]" : "bg-[#F3F4F6] text-[#9CA3AF]"
              }`}>{count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ─── Upload zone (À traiter only) ────────────────────────────────── */}
      {tab === "pending" && (
        <>
          <div
            className={`mb-4 border-2 bg-white px-4 py-3.5 transition-all ${dragOver ? "border-[#C8924A] bg-[rgba(200,146,74,0.04)]" : "border-dashed border-[#D1D5DB]"}`}
            style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files); }}
          >
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple className="hidden"
              onChange={(e) => { if (e.target.files?.length) { handleFiles(e.target.files); e.target.value = ""; } }} />
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden"
              onChange={(e) => { if (e.target.files?.length) { handleFiles(e.target.files); e.target.value = ""; } }} />

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 text-left">
                <div className="mb-0.5 text-[13.5px] font-semibold text-[#1A1A2E]">
                  {isExpenseNotes ? "Importez vos notes de frais" : "Importez vos factures fournisseurs"}
                </div>
                <div className="text-[11.5px] text-[#8A909B]">
                  {isExpenseNotes
                    ? "L’IA dédiée aux notes de frais extrait le commerçant, le montant payé, la TVA visible et la date."
                    : "L’IA extrait automatiquement le fournisseur, le montant, la TVA et la date."}
                </div>
                <div className="mt-1 text-[10px] text-[#A1A6B0]">JPG · PNG · PDF · WebP · 10 Mo max · Import multiple</div>
              </div>

              <div className="flex flex-wrap gap-2 lg:flex-shrink-0 lg:justify-end">
                {!dossierId && !isExpenseNotes && (
                  <button data-permission="document:create" onClick={handleEmailSync} disabled={syncing}
                    className="flex items-center gap-1.5 whitespace-nowrap px-3.5 py-2 text-[12px] font-medium transition-colors disabled:opacity-50"
                    style={{ backgroundColor: "#0D1526", color: "#fff", border: "none" }}>
                    <RefreshCw size={13} className={syncing ? "animate-spin" : ""} />
                    {syncing ? "Importation…" : "Importer depuis mes emails"}
                  </button>
                )}
                <button data-permission="document:create" onClick={() => fileInputRef.current?.click()}
                  className="btn btn-outline">
                  <Upload size={13} /> Importer des documents
                </button>
                <button data-permission="document:create" onClick={() => cameraInputRef.current?.click()}
                  className="btn btn-outline">
                  <Camera size={13} /> Prendre une photo
                </button>
              </div>
            </div>
          </div>

          {/* In-progress uploads */}
          {uploadingFiles.length > 0 && (
            <div className="flex flex-col gap-1.5 mb-3">
              {uploadingFiles.map((f) => (
                <div key={f.tempId} className="bg-white border border-[rgba(0,0,0,0.07)] rounded-xl px-4 py-3 flex items-center gap-3" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                  <div className="w-10 h-10 rounded-lg bg-[#F3F4F6] flex items-center justify-center flex-shrink-0">
                    {f.state === "error" ? <X size={16} className="text-[#DC2626]" />
                      : f.state === "done" ? <CheckCircle size={16} className="text-[#059669]" />
                      : <Loader2 size={16} className="animate-spin text-[#C8924A]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-medium text-[#1A1A2E] truncate">{f.name}</div>
                    <div className={`text-[11px] mt-0.5 ${f.state === "error" ? "text-[#DC2626]" : f.state === "done" ? "text-[#059669]" : "text-[#C8924A]"}`}>
                      {f.state === "uploading" && <span className="inline-flex items-center gap-1"><Upload size={11} /> Envoi en cours...</span>}
                      {f.state === "processing" && <span className="inline-flex items-center gap-1"><Search size={11} /> Extraction IA...</span>}
                      {f.state === "done" && (
                        <span className="inline-flex items-center gap-1">
                          <CheckCircle size={11} aria-hidden="true" /> Extrait !
                        </span>
                      )}
                      {f.state === "error" && <span className="inline-flex items-center gap-1"><AlertCircle size={11} /> {f.error ?? "Erreur"}</span>}
                    </div>
                  </div>
                  {f.state === "processing" && (
                    <div className="w-24 h-1 bg-[#F3F4F6] rounded-full overflow-hidden flex-shrink-0">
                      <div className="h-full bg-[#C8924A] rounded-full animate-pulse" style={{ width: "65%" }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

        </>
      )}

      {/* ─── Invoice search ─────────────────────────────────────────────── */}
      {(tab === "matched" || tab === "ignored") && (
        <div className="mb-4 border border-[rgba(0,0,0,0.08)] bg-white p-3.5">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1fr)_150px_145px_145px]">
            <label className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" aria-hidden="true" />
              <input
                type="search"
                className="input w-full pl-9 pr-9"
                value={invoiceSearch}
                onChange={(event) => setInvoiceSearch(event.target.value)}
                placeholder={isExpenseNotes ? "Commerçant, fichier, référence…" : "Fournisseur, fichier, référence…"}
                aria-label={isExpenseNotes ? "Rechercher dans les notes de frais" : "Rechercher dans les factures d'achat"}
              />
              {invoiceSearch && (
                <button
                  type="button"
                  onClick={() => setInvoiceSearch("")}
                  className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center text-[#9CA3AF] transition-colors hover:text-[#1A1A2E]"
                  aria-label="Effacer la recherche"
                >
                  <X size={13} aria-hidden="true" />
                </button>
              )}
            </label>
            <select className="input" value={invoiceSourceFilter} onChange={(event) => setInvoiceSourceFilter(event.target.value)} aria-label="Filtrer par source">
              <option value="all">Toutes les sources</option>
              <option>Import manuel</option>
              <option>Gmail</option>
              <option>Outlook</option>
              <option>Email reçu</option>
            </select>
            <input aria-label="Date de début" type="date" className="input" value={invoiceDateFrom} onChange={(event) => setInvoiceDateFrom(event.target.value)} />
            <input aria-label="Date de fin" type="date" className="input" value={invoiceDateTo} onChange={(event) => setInvoiceDateTo(event.target.value)} />
          </div>
        </div>
      )}

      {/* ─── Loading ─────────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex flex-col gap-2">
          {[1, 2].map((i) => <div key={i} className="h-36 bg-white rounded-xl border border-[rgba(0,0,0,0.07)] animate-pulse" />)}
        </div>
      )}

      {/* ─── Traités: accounting ledger ──────────────────────────────────── */}
      {!loading && tab === "matched" && (
        <LedgerView receipts={filteredMatched} onPreview={setPreviewReceipt} hasActiveFilters={hasActiveInvoiceFilters} expenseNotes={isExpenseNotes} />
      )}

      {/* ─── Suppliers: consolidated purchase directory ─────────────────── */}
      {!loading && tab === "suppliers" && (
        <SuppliersView suppliers={suppliers} receipts={receipts} onSaved={load} />
      )}

      {/* ─── Pending / Ignored: empty state ─────────────────────────────── */}
      {!loading && (tab === "pending" || tab === "ignored") && tabItems.length === 0 && (
        <div className="empty-state">
          {hasActiveInvoiceFilters ? (
            <>
              <div className="mb-3 flex justify-center text-[#9CA3AF]"><Search size={36} /></div>
              <p className="text-[13px] font-medium text-[#6B7280]">
                {isExpenseNotes ? "Aucune note de frais ne correspond aux filtres sélectionnés." : "Aucune facture ne correspond aux filtres sélectionnés."}
              </p>
              <p className="mt-1 text-[11.5px] text-[#9CA3AF]">
                Modifiez la recherche, la source ou la période.
              </p>
            </>
          ) : (
          <>
          <div className="mb-3 flex justify-center text-[#9CA3AF]">
            {tab === "pending" ? (dossierId && inboxEmail ? <Mail size={36} /> : <Inbox size={36} />) : <FolderOpen size={36} />}
          </div>
          <p className="text-[13px] font-medium text-[#6B7280]">
            {tab === "pending"
              ? isExpenseNotes ? "Aucune note de frais reçue" : "Aucune facture reçue"
              : isExpenseNotes ? "Aucune note de frais ignorée" : "Aucune facture ignorée"}
          </p>
          {tab === "pending" && dossierId && inboxEmail ? (
            <>
              <p className="text-[11.5px] text-[#9CA3AF] mt-1 mb-4">
                Donnez cette adresse à vos fournisseurs — leurs factures apparaîtront ici automatiquement.
              </p>
              <div className="flex items-center gap-2 bg-[#F9F9F6] border border-[rgba(0,0,0,0.08)] rounded-lg px-3 py-2.5 max-w-sm mx-auto mb-4">
                <code className="flex-1 text-[12px] font-mono text-[#1A1A2E] text-left truncate">{inboxEmail}</code>
                <button
                  onClick={() => { navigator.clipboard.writeText(inboxEmail); import("react-hot-toast").then(m => m.default.success("Adresse copiée !")); }}
                  className="flex-shrink-0 text-[11px] font-medium text-[#C8924A] hover:text-[#A87040] transition-colors"
                >
                  <span className="inline-flex items-center gap-1"><Clipboard size={12} /> Copier</span>
                </button>
              </div>
              <button onClick={() => fileInputRef.current?.click()} className="btn btn-outline text-[12px]">
                <Upload size={12} /> Ou importer manuellement
              </button>
            </>
          ) : (
            <>
              <p className="text-[11.5px] text-[#9CA3AF] mt-1">
                {tab === "pending"
                  ? isExpenseNotes ? "Toutes vos notes de frais ont été traitées !" : "Toutes vos factures fournisseurs ont été traitées !"
                  : isExpenseNotes ? "Les notes de frais ignorées apparaissent ici." : "Les factures ignorées apparaissent ici."}
              </p>
              {tab === "pending" && (
                <button onClick={() => fileInputRef.current?.click()} className="btn btn-gold mt-4 text-[12px]">
                  <Upload size={12} /> {isExpenseNotes ? "Importer une note de frais" : "Importer une facture"}
                </button>
              )}
            </>
          )}
          </>
          )}
        </div>
      )}

      {/* ─── Cards (pending / ignored) ───────────────────────────────────── */}
      {!loading && (tab === "pending" || tab === "ignored") && tabItems.length > 0 && (
        <div className="flex flex-col gap-3">
          {tabItems.map((r) =>
            tab === "pending" ? (
              <ReceiptCard
                key={r.id}
                receipt={r}
                suppliers={suppliers}
                form={forms[r.id] ?? initForm(r.ocr_data, isExpenseNotes)}
                saving={saving.has(r.id)}
                savingEdits={savingEdits.has(r.id)}
                hasUnsavedChanges={dirtyReceipts.has(r.id)}
                dismissing={dismissing.has(r.id)}
                previewing={previewReceipt?.id === r.id}
                onFormChange={(field, val) => updateForm(r.id, field, val)}
                onConfirm={() => confirmReceipt(r.id)}
                onSave={() => saveReceiptEdits(r.id)}
                onIgnore={() => ignoreReceipt(r.id)}
                onPreview={() => setPreviewReceipt(previewReceipt?.id === r.id ? null : r)}
                expenseNotes={isExpenseNotes}
              />
            ) : (
              <ProcessedCard
                key={r.id}
                receipt={r}
                previewing={previewReceipt?.id === r.id}
                onRecover={() => recoverReceipt(r.id)}
                onPreview={() => setPreviewReceipt(previewReceipt?.id === r.id ? null : r)}
              />
            )
          )}
        </div>
      )}

      {/* ─── Preview panel ───────────────────────────────────────────────── */}
      {previewReceipt && tab === "pending" ? (
        <PurchaseReviewWorkspace
          key={previewReceipt.id}
          receipt={previewReceipt}
          suppliers={suppliers}
          form={forms[previewReceipt.id] ?? initForm(previewReceipt.ocr_data, isExpenseNotes)}
          saving={saving.has(previewReceipt.id)}
          savingEdits={savingEdits.has(previewReceipt.id)}
          hasUnsavedChanges={dirtyReceipts.has(previewReceipt.id)}
          onFormChange={(field, val) => updateForm(previewReceipt.id, field, val)}
          onConfirm={() => confirmReceipt(previewReceipt.id)}
          onSave={() => saveReceiptEdits(previewReceipt.id)}
          onIgnore={() => ignoreReceipt(previewReceipt.id)}
          onClose={closePreview}
          onPrevious={() => moveReview(-1)}
          onNext={() => moveReview(1)}
          hasPrevious={previewPendingIndex > 0}
          hasNext={previewPendingIndex >= 0 && previewPendingIndex < reviewReceipts.length - 1}
          position={previewPendingIndex + 1}
          total={reviewReceipts.length}
          expenseNotes={isExpenseNotes}
        />
      ) : previewReceipt ? (
        <PreviewPanel
          key={previewReceipt.id}
          receipt={previewReceipt}
          onClose={closePreview}
        />
      ) : null}
    </div>
  );
}

// ─── Suppliers View ──────────────────────────────────────────────────────────

type SupplierCoordinatesForm = {
  ice: string;
  fiscalId: string;
  rib: string;
  iban: string;
};

type SupplierSortKey = "name" | "total" | "count" | "latest";
type SupplierViewMode = "cards" | "rows";

function supplierInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join("")
    .toUpperCase();
}

function SuppliersView({ suppliers, receipts, onSaved }: { suppliers: SupplierSummary[]; receipts: ReceiptWithUrl[]; onSaved: () => Promise<void> }) {
  const supabase = createClient();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SupplierSortKey>("name");
  const [sortAscending, setSortAscending] = useState(true);
  const [viewMode, setViewMode] = useState<SupplierViewMode>("rows");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<SupplierCoordinatesForm>({ ice: "", fiscalId: "", rib: "", iban: "" });
  const [savingSupplier, setSavingSupplier] = useState(false);
  const normalizedSearch = search.trim().toLocaleLowerCase("fr");
  const filtered = normalizedSearch
    ? suppliers.filter((supplier) => `${supplier.name} ${supplier.ice ?? ""} ${supplier.fiscalId ?? ""} ${supplier.rib ?? ""} ${supplier.iban ?? ""}`.toLocaleLowerCase("fr").includes(normalizedSearch))
    : suppliers;
  const displayedSuppliers = [...filtered].sort((left, right) => {
    const direction = sortAscending ? 1 : -1;
    if (sortKey === "total") return (left.totalTtc - right.totalTtc) * direction;
    if (sortKey === "count") return (left.invoiceCount - right.invoiceCount) * direction;
    if (sortKey === "latest") return left.latestDate.localeCompare(right.latestDate) * direction;
    return left.name.localeCompare(right.name, "fr") * direction;
  });

  function selectSort(nextKey: SupplierSortKey) {
    if (nextKey === sortKey) {
      setSortAscending(current => !current);
      return;
    }
    setSortKey(nextKey);
    setSortAscending(nextKey === "name");
  }

  function startEditing(supplier: SupplierSummary) {
    setEditingKey(supplier.key);
    setEditForm({
      ice: supplier.ice ?? "",
      fiscalId: supplier.fiscalId ?? "",
      rib: supplier.rib ?? "",
      iban: supplier.iban ?? "",
    });
  }

  async function saveSupplier(supplier: SupplierSummary) {
    const targetReceipts = receipts.filter(receipt => supplier.receiptIds.includes(receipt.id));
    if (!targetReceipts.length) {
      toast.error("Aucune facture liée à ce fournisseur.");
      return;
    }

    setSavingSupplier(true);
    const coordinates = {
      supplier_ice: editForm.ice.trim() || null,
      supplier_if: editForm.fiscalId.trim() || null,
      supplier_rib: editForm.rib.trim() || null,
      supplier_iban: editForm.iban.trim() || null,
    };
    const results = await Promise.all(targetReceipts.map(receipt =>
      supabase
        .from("receipts")
        .update({ ocr_data: { ...receipt.ocr_data, ...coordinates } })
        .eq("id", receipt.id),
    ));
    setSavingSupplier(false);

    if (results.some(result => result.error)) {
      toast.error("Certaines coordonnées n’ont pas pu être enregistrées.");
      await onSaved();
      return;
    }

    setEditingKey(null);
    await onSaved();
    toast.success("Coordonnées du fournisseur mises à jour.");
  }

  if (suppliers.length === 0) {
    return (
      <div className="empty-state">
        <Building2 size={34} className="mb-3 text-[#9CA3AF]" aria-hidden="true" />
        <p className="text-[13px] font-medium text-[#6B7280]">Aucun fournisseur identifié</p>
        <p className="mt-1 text-[11.5px] text-[#9CA3AF]">Les fournisseurs apparaîtront ici dès qu’une facture d’achat sera reçue.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative w-full lg:max-w-[390px] lg:flex-none">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8A909B]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="input w-full pl-9"
            placeholder="Rechercher un fournisseur, ICE, IF ou RIB…"
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#6B7280]">Trier par</span>
          {([
            ["name", "Nom"],
            ["total", "Total achats"],
            ["count", "Factures"],
            ["latest", "Dernière facture"],
          ] as [SupplierSortKey, string][]).map(([key, label]) => {
            const active = sortKey === key;
            const SortIcon = sortAscending ? ArrowUp : ArrowDown;
            return (
              <button
                key={key}
                type="button"
                onClick={() => selectSort(key)}
                className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11.5px] font-semibold transition ${active ? "border-[#C8924A]/40 bg-[#FFF7ED] text-[#C8924A]" : "border-[rgba(0,0,0,0.16)] bg-[#FAFAF6] text-[#6B7280] shadow-[0_1px_2px_rgba(13,21,38,0.05)] hover:border-[#C8924A]/30 hover:bg-[#F0EDE5] hover:text-[#C8924A]"}`}
              >
                {label}
                {active && <SortIcon size={11} />}
              </button>
            );
          })}
          <div className="ui-control ml-auto flex h-8 items-center border border-[rgba(0,0,0,0.16)] bg-[#F1F2F3] p-0.5" aria-label="Mode d’affichage">
            <button type="button" onClick={() => setViewMode("cards")} aria-label="Afficher en cartes" aria-pressed={viewMode === "cards"} title="Vue cartes" className={`flex h-7 w-8 items-center justify-center transition-colors ${viewMode === "cards" ? "bg-white text-[#C8924A] shadow-sm" : "text-[#777E8B] hover:text-[#1A1A2E]"}`}>
              <LayoutGrid size={14} />
            </button>
            <button type="button" onClick={() => setViewMode("rows")} aria-label="Afficher horizontalement" aria-pressed={viewMode === "rows"} title="Vue horizontale" className={`flex h-7 w-8 items-center justify-center transition-colors ${viewMode === "rows" ? "bg-white text-[#C8924A] shadow-sm" : "text-[#777E8B] hover:text-[#1A1A2E]"}`}>
              <Rows3 size={14} />
            </button>
          </div>
        </div>
      </div>

      {displayedSuppliers.length === 0 ? (
        <div className="empty-state">Aucun fournisseur ne correspond à « {search.trim()} ».</div>
      ) : (
        <div className={`grid grid-cols-1 gap-2.5 ${viewMode === "cards" ? "sm:grid-cols-2 lg:grid-cols-3" : ""}`}>
          {displayedSuppliers.map((supplier) => (
            <div
              key={supplier.key}
              className={`client-card group relative flex flex-col overflow-hidden !p-0 transition-all hover:border-[#C8924A]/40 ${viewMode === "rows" ? "md:flex-row md:items-stretch" : ""}`}
            >
              <div className={`flex min-w-0 gap-3 p-4 ${viewMode === "rows" ? "md:w-[280px] md:flex-shrink-0" : ""}`}>
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center bg-[#0D1526] text-[13px] font-bold text-[#C8924A]">
                  {supplierInitials(supplier.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold text-[#1A1A2E]">{supplier.name}</div>
                  <div className="mt-1 space-y-0.5">
                    <div className="truncate text-[11px] text-[#6B7280]">ICE: {supplier.ice || "—"}</div>
                    <div className="truncate text-[11px] text-[#6B7280]">IF: {supplier.fiscalId || "—"}</div>
                  </div>
                </div>
              </div>

              <div className={`grid grid-cols-3 gap-4 border-t border-[rgba(0,0,0,0.08)] px-4 py-3 ${viewMode === "rows" ? "md:w-[330px] md:flex-shrink-0 md:border-l md:border-t-0 md:items-center" : ""}`}>
                <div className="text-[11px] text-[#6B7280]"><strong className="block text-[12px] font-semibold text-[#1A1A2E]">{fmt(supplier.totalTtc)} MAD</strong>Total achats</div>
                <div className="text-[11px] text-[#6B7280]"><strong className="block text-[12px] font-semibold text-[#1A1A2E]">{supplier.invoiceCount}</strong>Factures</div>
                <div className="text-[11px] text-[#6B7280]"><strong className="block text-[12px] font-semibold text-[#1A1A2E]">{supplier.latestDate ? fmtDate(supplier.latestDate) : "—"}</strong>Dernière</div>
              </div>

              <div className={`min-w-0 flex-1 border-t border-[rgba(0,0,0,0.06)] px-4 py-3 ${viewMode === "rows" ? "md:border-l md:border-t-0" : ""}`}>
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.45px] text-[#9CA3AF]">Coordonnées du fournisseur</div>
                {editingKey === supplier.key ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input aria-label="ICE du fournisseur" value={editForm.ice} onChange={event => setEditForm(current => ({ ...current, ice: event.target.value }))} className="input h-8 w-full text-[11px]" placeholder="ICE" />
                    <input aria-label="IF du fournisseur" value={editForm.fiscalId} onChange={event => setEditForm(current => ({ ...current, fiscalId: event.target.value }))} className="input h-8 w-full text-[11px]" placeholder="IF" />
                    <input aria-label="RIB du fournisseur" value={editForm.rib} onChange={event => setEditForm(current => ({ ...current, rib: event.target.value }))} className="input h-8 w-full text-[11px]" placeholder="RIB" />
                    <input aria-label="IBAN du fournisseur" value={editForm.iban} onChange={event => setEditForm(current => ({ ...current, iban: event.target.value }))} className="input h-8 w-full text-[11px]" placeholder="IBAN" />
                    <div className="flex gap-2 sm:col-span-2">
                      <button data-permission="document:create" disabled={savingSupplier} onClick={() => saveSupplier(supplier)} className="inline-flex items-center gap-1 rounded-md bg-[#0D1526] px-2.5 py-1.5 text-[10.5px] font-semibold text-white disabled:opacity-50">
                        {savingSupplier ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle size={11} />} Enregistrer
                      </button>
                      <button disabled={savingSupplier} onClick={() => setEditingKey(null)} className="rounded-md border border-black/10 px-2.5 py-1.5 text-[10.5px] font-semibold text-[#6B7280] disabled:opacity-50">Annuler</button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1 text-[11px] text-[#6B7280]">
                    <div className="truncate" title={supplier.rib || undefined}><span className="font-semibold text-[#4B5260]">RIB:</span> {supplier.rib || "—"}</div>
                    <div className="truncate" title={supplier.iban || undefined}><span className="font-semibold text-[#4B5260]">IBAN:</span> {supplier.iban || "—"}</div>
                  </div>
                )}
              </div>

              <div className={`flex items-center justify-between gap-3 border-t border-[rgba(0,0,0,0.06)] px-4 py-3 ${viewMode === "rows" ? "md:w-[140px] md:flex-shrink-0 md:flex-col md:items-start md:justify-center md:border-l md:border-t-0" : ""}`}>
                <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-[#C8924A]"><FileText size={12} /> {supplier.invoiceCount} facture{supplier.invoiceCount > 1 ? "s" : ""}</span>
                {editingKey !== supplier.key && (
                  <button data-permission="document:create" onClick={() => startEditing(supplier)} className="inline-flex items-center gap-1 text-[10.5px] font-medium text-[#C8924A] opacity-70 transition-opacity group-hover:opacity-100">
                    <Pencil size={10} /> Modifier →
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Accounting Ledger View ───────────────────────────────────────────────────

function LedgerView({ receipts, onPreview, hasActiveFilters, expenseNotes = false }: { receipts: ReceiptWithUrl[]; onPreview: (receipt: ReceiptWithUrl) => void; hasActiveFilters?: boolean; expenseNotes?: boolean }) {
  const rows = receipts.map((r) => {
    const ocr = r.ocr_data;
    const { ht, tva, remise, ttc } = computeAmounts(ocr);
    const journal = ocr.type === "income" ? "VTE" : "ACH";
    return {
      id: r.id,
      journal,
      date: ocr.date ?? r.created_at?.split("T")[0] ?? "",
      vendor: ocr.vendor_name ?? ocr.vendor ?? "",
      ref: ocr.receipt_number ?? "",
      description: (ocr.description as string | null) ?? "",
      ht,
      tva,
      remise,
      ttc,
      tvaRate: ocr.tva_rate ?? 0,
      category: (ocr.category as string | null) ?? "",
      compte: (ocr as any).compte ?? "",
      paymentMethod: (ocr.payment_method as string | null) ?? "",
      receipt: r,
      controlStatus: r.control_status ?? "recorded",
    };
  });

  const totalHt = rows.reduce((s, r) => s + r.ht, 0);
  const totalTva = rows.reduce((s, r) => s + r.tva, 0);
  const totalDiscount = rows.reduce((s, r) => s + r.remise, 0);
  const totalTtc = rows.reduce((s, r) => s + r.ttc, 0);

  function exportCSV() {
    const headers = ["Journal", "Date", "Fournisseur", "Référence", "Description", "HT (MAD)", "TVA %", "TVA (MAD)", "Remise TTC (MAD)", "TTC net (MAD)", "Catégorie", "Compte", "Mode paiement"];
    const csvRows = [
      headers.join(","),
      ...rows.map((r) => [
        r.journal,
        r.date,
        `"${r.vendor.replace(/"/g, '""')}"`,
        r.ref,
        `"${r.description.replace(/"/g, '""')}"`,
        r.ht.toFixed(2),
        r.tvaRate,
        r.tva.toFixed(2),
        r.remise.toFixed(2),
        r.ttc.toFixed(2),
        `"${r.category.replace(/"/g, '""')}"`,
        r.compte,
        r.paymentMethod,
      ].join(",")),
    ];
    downloadFile(csvRows.join("\n"), `mohasib-export-${today()}.csv`, "text/csv;charset=utf-8;");
  }

  function exportFEC() {
    const headers = "JournalCode|JournalLib|EcritureNum|EcritureDate|CompteNum|CompteLib|PieceRef|PieceDate|EcritureLib|Debit|Credit|ValidDate";
    const fecRows = rows.map((r, i) => {
      const num = String(i + 1).padStart(6, "0");
      const date = r.date.replace(/-/g, "");
      const debit = r.ttc.toFixed(2).replace(".", ",");
      const lib = r.journal === "VTE" ? "Ventes" : "Achats";
      return [r.journal, lib, num, date, r.compte || "6110", r.category || "", r.ref, date, r.description || r.vendor, debit, "0,00", date].join("|");
    });
    downloadFile([headers, ...fecRows].join("\r\n"), `mohasib-fec-${today()}.txt`, "text/plain;charset=utf-8;");
  }

  function downloadFile(content: string, name: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  }

  function today() { return new Date().toISOString().split("T")[0]; }

  if (receipts.length === 0) {
    return (
      <div className="bg-white border border-[rgba(0,0,0,0.07)] rounded-xl px-5 py-12 text-center" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
        {hasActiveFilters ? <Search size={32} className="mx-auto mb-3 text-[#9CA3AF]" aria-hidden="true" /> : <CheckCircle size={32} className="mx-auto mb-3 text-[#059669]" aria-hidden="true" />}
        <p className="text-[13px] font-medium text-[#6B7280]">
          {hasActiveFilters
            ? expenseNotes ? "Aucune note de frais traitée ne correspond aux filtres sélectionnés." : "Aucune facture traitée ne correspond aux filtres sélectionnés."
            : expenseNotes ? "Aucune note de frais traitée" : "Aucune facture traitée"}
        </p>
        <p className="text-[11.5px] text-[#9CA3AF] mt-1">
          {hasActiveFilters
            ? "Modifiez la recherche, la source ou la période."
            : expenseNotes ? "Importez vos notes de frais pour les traiter." : "Importez vos factures fournisseurs pour les traiter."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">

      {/* Summary metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {([
          { label: "Total HT", value: fmt(totalHt), sub: "MAD", color: "#1A1A2E" },
          { label: "Total TVA", value: fmt(totalTva), sub: "MAD", color: "#D97706" },
          { label: "Total remises", value: fmt(totalDiscount), sub: "MAD", color: "#7C3AED" },
          { label: "Total TTC net", value: fmt(totalTtc), sub: "MAD", color: "#C8924A" },
          { label: "Écritures confirmées", value: String(rows.length), sub: "entrées", color: "#059669" },
        ]).map((m) => (
          <div key={m.label} className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl p-4" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div className="text-[10.5px] text-[#9CA3AF] uppercase tracking-[0.5px] mb-2">{m.label}</div>
            <div className="text-[20px] font-bold leading-none" style={{ color: m.color }}>{m.value}</div>
            <div className="text-[10px] text-[#9CA3AF] mt-1">{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Export buttons */}
      <div className="flex items-center justify-between">
        <span className="text-[11.5px] text-[#9CA3AF]">{rows.length} écriture{rows.length > 1 ? "s" : ""}</span>
        <div className="flex gap-2">
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] text-[#374151] border border-[rgba(0,0,0,0.12)] rounded-lg hover:bg-[#F9F9F6] transition-colors"
          >
            <Download size={12} /> Export CSV
          </button>
          <button
            onClick={exportFEC}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] text-[#374151] border border-[rgba(0,0,0,0.12)] rounded-lg hover:bg-[#F9F9F6] transition-colors"
          >
            <Download size={12} /> Export FEC
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-[11.5px] border-collapse min-w-[1180px]">
            <thead>
              <tr className="bg-[#F9F9F6] border-b border-[rgba(0,0,0,0.08)]">
                {[
                  ["Journal", "text-left"],
                  ["Date", "text-left"],
                  ["Fournisseur / Réf.", "text-left"],
                  ["Description", "text-left"],
                  ["Montant HT", "text-right"],
                  ["TVA %", "text-center"],
                  ["TVA MAD", "text-right"],
                  ["Remise TTC", "text-right"],
                  ["TTC net", "text-right"],
                  ["Catégorie", "text-left"],
                  ["Compte comptable", "text-left"],
                  ["Mode de paiement", "text-left"],
                  ["Statut", "text-left"],
                  ["Contrôle", "text-right"],
                ].map(([label, align]) => (
                  <th key={label} className={`${align} px-3 py-2.5 font-semibold text-[#6B7280] whitespace-nowrap text-[10.5px] uppercase tracking-[0.4px]`}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr
                  key={row.id}
                  className={`border-b border-[rgba(0,0,0,0.04)] transition-colors hover:bg-[rgba(200,146,74,0.05)] ${idx % 2 === 1 ? "bg-[#FAFAFA]" : "bg-white"}`}
                >
                  <td className="px-3 py-2.5 font-mono font-bold text-[#C8924A] whitespace-nowrap">{row.journal}</td>
                  <td className="px-3 py-2.5 text-[#374151] whitespace-nowrap">{row.date ? fmtDate(row.date) : "—"}</td>
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-[#1A1A2E] truncate max-w-[130px]">{row.vendor || "—"}</div>
                    {row.ref && <div className="text-[10px] text-[#9CA3AF] font-mono mt-0.5">#{row.ref}</div>}
                  </td>
                  <td className="px-3 py-2.5 text-[#374151]">
                    <div className="truncate max-w-[160px]">{row.description || "—"}</div>
                  </td>
                  <td className="px-3 py-2.5 text-right text-[#1A1A2E]">{fmt(row.ht)}</td>
                  <td className="px-3 py-2.5 text-center">
                    {row.tvaRate > 0 ? (
                      <span className="inline-block px-1.5 py-0.5 rounded-full text-[9.5px] font-bold bg-[#FEF3C7] text-[#92400E]">{row.tvaRate}%</span>
                    ) : (
                      <span className="text-[#D1D5DB] text-[10px]">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[#9CA3AF]">
                    {row.tva > 0 ? fmt(row.tva) : <span className="text-[#D1D5DB]">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[#7C3AED]">
                    {row.remise > 0 ? fmt(row.remise) : <span className="text-[#D1D5DB]">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right font-bold text-[#1A1A2E]">{fmt(row.ttc)}</td>
                  <td className="px-3 py-2.5">
                    {row.category ? (
                      <span className="inline-block px-2 py-0.5 rounded-full text-[9.5px] font-medium bg-[#F3F4F6] text-[#374151] whitespace-nowrap max-w-[120px] truncate">
                        {row.category}
                      </span>
                    ) : <span className="text-[#D1D5DB]">—</span>}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[10.5px] text-[#6B7280] whitespace-nowrap">{row.compte || "—"}</td>
                  <td className="px-3 py-2.5 text-[#374151] whitespace-nowrap capitalize">{row.paymentMethod || "—"}</td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-1 text-[9.5px] font-semibold text-[#059669] whitespace-nowrap">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#059669] flex-shrink-0" />
                      {row.controlStatus === "paid" ? "Payé" : "Comptabilisé"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <button onClick={() => onPreview(row.receipt)} className="inline-flex items-center gap-1 rounded-md border border-black/10 px-2 py-1 text-[10px] font-semibold text-[#6B7280] hover:border-[#C8924A] hover:text-[#C8924A]">
                      <ShieldCheck size={11} /> Ouvrir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Preview panel (fixed right) ──────────────────────────────────────────────

function PreviewPanel({ receipt: r, onClose }: { receipt: ReceiptWithUrl; onClose: () => void }) {
  const ocr = r.ocr_data;
  const isPdf = r.mime_type === "application/pdf";
  const previewUrl = r.signedUrl ?? (r.storage_path ? `/api/receipts/${r.id}/content` : undefined);

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-30 md:hidden" onClick={onClose} />
      <div className="fixed top-16 right-0 bottom-0 z-40 w-full md:w-[420px] lg:w-[480px] bg-white border-l border-[rgba(0,0,0,0.09)] flex flex-col"
        style={{ boxShadow: "-4px 0 24px rgba(0,0,0,0.08)" }}>
        <div className="flex items-start gap-3 px-4 py-3.5 border-b border-[rgba(0,0,0,0.08)] flex-shrink-0">
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-[#1A1A2E] truncate">
              {ocr.vendor_name ?? ocr.vendor ?? r.file_name ?? "Document"}
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[#9CA3AF] flex-wrap">
              {ocr.date && <span className="inline-flex items-center gap-1"><CalendarDays size={11} /> {fmtDate(ocr.date)}</span>}
              {ocr.receipt_number && <span>#{ocr.receipt_number}</span>}
              {r.file_name && <span className="truncate max-w-[180px]">{r.file_name}</span>}
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-[#9CA3AF] hover:text-[#374151] hover:bg-[#F3F4F6] transition-colors flex-shrink-0">
            <X size={14} />
          </button>
        </div>
        <ReceiptControlPanel receipt={r} />
        <div className="min-h-0 flex-1 overflow-auto bg-[#F3F4F6] flex items-start justify-center">
          {!previewUrl ? (
            <div className="flex flex-col items-center justify-center h-full w-full text-center p-8">
              <FileText size={40} className="text-[#D1D5DB] mb-3" />
              <p className="text-[12.5px] text-[#9CA3AF]">Aucun aperçu disponible</p>
            </div>
          ) : isPdf ? (
            <iframe src={previewUrl} className="w-full h-full" style={{ minHeight: "100%" }} title="Document PDF" />
          ) : (
            <div className="p-4 w-full flex items-start justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="document" className="max-w-full rounded-lg shadow-md" />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Purchase verification workspace ─────────────────────────────────────────

function PurchaseReviewWorkspace({
  receipt,
  suppliers,
  form,
  saving,
  savingEdits,
  hasUnsavedChanges,
  onFormChange,
  onConfirm,
  onSave,
  onIgnore,
  onClose,
  onPrevious,
  onNext,
  hasPrevious,
  hasNext,
  position,
  total,
  expenseNotes,
}: {
  receipt: ReceiptWithUrl;
  suppliers: SupplierSummary[];
  form: CardForm;
  saving: boolean;
  savingEdits: boolean;
  hasUnsavedChanges: boolean;
  onFormChange: (field: keyof CardForm, val: string) => void;
  onConfirm: () => void;
  onSave: () => void;
  onIgnore: () => void;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
  hasPrevious: boolean;
  hasNext: boolean;
  position: number;
  total: number;
  expenseNotes: boolean;
}) {
  const [mobilePane, setMobilePane] = useState<"document" | "data">("document");
  const ocr = receipt.ocr_data;
  const isPdf = receipt.mime_type === "application/pdf";
  const previewUrl = receipt.signedUrl
    ?? (receipt.storage_path ? `/api/receipts/${receipt.id}/content` : undefined);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#F3F4F6]" role="dialog" aria-modal="true" aria-label={expenseNotes ? "Vérification de la note de frais" : "Vérification de la facture fournisseur"}>
      <header className="flex h-16 flex-shrink-0 items-center gap-3 border-b border-black/10 bg-white px-4 md:px-5">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-[0.7px] text-[#C8924A]">{expenseNotes ? "Vérification de la note de frais" : "Vérification de la facture"}</div>
          <div className="truncate text-[14px] font-semibold text-[#1A1A2E]">
            {ocr.vendor_name ?? ocr.vendor ?? receipt.file_name ?? (expenseNotes ? "Note de frais" : "Facture fournisseur")}
          </div>
        </div>
        <div className="hidden items-center gap-2 text-[11px] text-[#8A909B] lg:flex">
          {ocr.date && <span>{fmtDate(ocr.date)}</span>}
          {ocr.receipt_number && <span>#{ocr.receipt_number}</span>}
        </div>
        <div className="flex flex-shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onPrevious}
            disabled={!hasPrevious}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-black/10 bg-white text-[#6B7280] transition-colors hover:border-[#C8924A] hover:text-[#C8924A] disabled:cursor-not-allowed disabled:opacity-35"
            aria-label={expenseNotes ? "Note de frais précédente" : "Facture précédente"}
            title={expenseNotes ? "Note de frais précédente" : "Facture précédente"}
          >
            <ChevronLeft size={17} />
          </button>
          <span className="min-w-[48px] text-center text-[10.5px] font-semibold tabular-nums text-[#8A909B]" aria-live="polite">
            {position} / {total}
          </span>
          <button
            type="button"
            onClick={onNext}
            disabled={!hasNext}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-black/10 bg-white text-[#6B7280] transition-colors hover:border-[#C8924A] hover:text-[#C8924A] disabled:cursor-not-allowed disabled:opacity-35"
            aria-label={expenseNotes ? "Note de frais suivante" : "Facture suivante"}
            title={expenseNotes ? "Note de frais suivante" : "Facture suivante"}
          >
            <ChevronRight size={17} />
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-black/10 bg-white text-[#6B7280] transition-colors hover:border-[#C8924A] hover:text-[#C8924A]"
          aria-label="Fermer la vérification"
        >
          <X size={16} />
        </button>
      </header>

      <div className="grid grid-cols-2 border-b border-black/10 bg-white p-1 md:hidden">
        {(["document", "data"] as const).map((pane) => (
          <button
            key={pane}
            type="button"
            onClick={() => setMobilePane(pane)}
            aria-pressed={mobilePane === pane}
            className={`min-h-10 rounded-md text-[12px] font-semibold transition-colors ${mobilePane === pane ? "bg-[#0D1526] text-white" : "text-[#6B7280]"}`}
          >
            {pane === "document" ? "Document" : "Données extraites"}
          </button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 md:grid-cols-[minmax(0,1.15fr)_minmax(430px,0.85fr)]">
        <section className={`${mobilePane === "document" ? "flex" : "hidden"} min-h-0 flex-col bg-[#E5E7EB] md:flex`} aria-label="Document original">
          <div className="flex h-10 flex-shrink-0 items-center justify-between border-b border-black/10 bg-[#F9FAFB] px-4">
            <span className="text-[10.5px] font-bold uppercase tracking-[0.55px] text-[#6B7280]">Document original</span>
            {previewUrl && (
              <a href={previewUrl} target="_blank" rel="noreferrer" className="text-[10.5px] font-semibold text-[#C8924A] hover:underline">
                Ouvrir en plein écran
              </a>
            )}
          </div>
          <div className="flex min-h-0 flex-1 items-start justify-center overflow-auto">
            {!previewUrl ? (
              <div className="flex h-full flex-col items-center justify-center p-8 text-center">
                <FileText size={40} className="mb-3 text-[#9CA3AF]" />
                <p className="text-[12.5px] text-[#6B7280]">Aucun aperçu disponible</p>
              </div>
            ) : isPdf ? (
              <iframe src={previewUrl} className="h-full min-h-[520px] w-full bg-white" title={expenseNotes ? "Note de frais PDF" : "Facture fournisseur PDF"} />
            ) : (
              <div className="flex min-h-full w-full items-start justify-center p-4 md:p-6">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl} alt={expenseNotes ? "Note de frais à vérifier" : "Facture fournisseur à vérifier"} className="h-auto max-w-full bg-white shadow-lg" />
              </div>
            )}
          </div>
        </section>

        <section className={`${mobilePane === "data" ? "block" : "hidden"} min-h-0 overflow-y-auto border-l border-black/10 bg-[#FAFAF6] md:block`} aria-label="Données extraites à vérifier">
          <div className="border-b border-black/10 bg-white px-4 py-3">
            <div className="text-[12px] font-bold text-[#1A1A2E]">Comparez puis corrigez les données extraites</div>
            <p className="mt-0.5 text-[10.5px] text-[#8A909B]">Le document reste visible à gauche pendant vos modifications.</p>
          </div>
          <ReceiptCard
            receipt={receipt}
            suppliers={suppliers}
            form={form}
            saving={saving}
            savingEdits={savingEdits}
            hasUnsavedChanges={hasUnsavedChanges}
            dismissing={false}
            previewing
            embedded
            onFormChange={onFormChange}
            onConfirm={onConfirm}
            onSave={onSave}
            onIgnore={onIgnore}
            onPreview={onClose}
            expenseNotes={expenseNotes}
          />
        </section>
      </div>
    </div>,
    document.body,
  );
}

type ReceiptControlPayload = {
  checks: InvoiceControlCheck[];
  events: Array<{ id: string; event_type: string; message: string; created_at: string; actor_label?: string | null }>;
};

function ReceiptControlPanel({ receipt }: { receipt: ReceiptWithUrl }) {
  const [payload, setPayload] = useState<ReceiptControlPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/receipts/${receipt.id}/control`)
      .then(async response => ({ response, result: await response.json().catch(() => ({})) }))
      .then(({ response, result }) => {
        if (cancelled) return;
        setLoading(false);
        if (!response.ok) {
          toast.error(result.error || "Impossible de charger les contrôles.");
          return;
        }
        setPayload(result);
      });
    return () => { cancelled = true; };
  }, [receipt.id]);

  if (loading) {
    return <div className="flex items-center gap-2 border-b border-black/10 px-4 py-3 text-[11px] text-[#9CA3AF]"><Loader2 size={13} className="animate-spin" /> Chargement de l’activité…</div>;
  }
  if (!payload) return null;

  return (
    <div className="max-h-[46%] flex-shrink-0 overflow-y-auto border-b border-black/10 bg-white px-4 py-3">
      <div className="mb-4">
        <div className="flex items-center gap-1.5 text-[10.5px] font-bold text-[#0D1526]"><ShieldCheck size={12} /> Contrôles de la facture</div>
        <div className="mt-2 space-y-2">
          {payload.checks
            .filter(check => check.code !== "automatic_checks_complete" || payload.checks.length === 1)
            .map(check => (
              <div
                key={check.code}
                className={`rounded-lg border px-3 py-2 ${
                  check.severity === "critical"
                    ? "border-red-200 bg-red-50"
                    : check.severity === "warning"
                      ? "border-amber-200 bg-amber-50"
                      : "border-emerald-200 bg-emerald-50"
                }`}
              >
                <div className={`flex items-center gap-1.5 text-[10.5px] font-bold ${
                  check.severity === "critical"
                    ? "text-red-700"
                    : check.severity === "warning"
                      ? "text-amber-700"
                      : "text-emerald-700"
                }`}>
                  {check.severity === "info" ? <ShieldCheck size={11} /> : <AlertCircle size={11} />}
                  {check.title}
                </div>
                <p className="mt-1 text-[10px] leading-relaxed text-[#4B5563]">{check.message}</p>
              </div>
            ))}
        </div>
      </div>
      <div>
        <div className="flex items-center gap-1.5 text-[10.5px] font-bold text-[#0D1526]"><Clock3 size={12} /> Activité</div>
        <div className="mt-2 space-y-2 border-l border-[#D8DADF] pl-3">
          {payload.events.length === 0 ? <p className="text-[10px] text-[#9CA3AF]">Aucune activité enregistrée.</p> : payload.events.map(event => (
            <div key={event.id}>
              <p className="text-[10px] font-semibold text-[#4B5563]">{event.message}</p>
              <p className="text-[9px] text-[#9CA3AF]">{new Date(event.created_at).toLocaleString("fr-MA")}{event.actor_label ? ` · ${event.actor_label}` : ""}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Compte Comptable searchable select ───────────────────────────────────────

function CompteSelect({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [dropRect, setDropRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = cgncAccounts.find((a) => a.code === value);
  const filtered = query.trim()
    ? cgncAccounts.filter((a) =>
        a.code.startsWith(query) ||
        a.label.toLowerCase().includes(query.toLowerCase())
      )
    : cgncAccounts;

  function handleFocus() {
    if (inputRef.current) {
      const r = inputRef.current.getBoundingClientRect();
      setDropRect({ top: r.bottom + window.scrollY + 4, left: r.left + window.scrollX, width: r.width });
    }
    setQuery("");
    setOpen(true);
  }

  return (
    <div>
      <input
        ref={inputRef}
        className="input text-[12px]"
        placeholder="Sélectionner un compte..."
        value={open ? query : selected ? `${selected.code} — ${selected.label}` : ""}
        onFocus={handleFocus}
        onChange={(e) => setQuery(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && dropRect && createPortal(
        <div
          style={{ position: "absolute", top: dropRect.top, left: dropRect.left, width: dropRect.width, zIndex: 9999 }}
          className="bg-white border border-[rgba(0,0,0,0.12)] rounded-lg shadow-xl max-h-48 overflow-y-auto"
        >
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-[11.5px] text-[#9CA3AF]">Aucun résultat</div>
          ) : filtered.map((a) => (
            <button
              key={a.code}
              type="button"
              className={`w-full text-left px-3 py-2 text-[11.5px] hover:bg-[#FAFAF6] ${a.code === value ? "bg-[rgba(200,146,74,0.08)]" : ""}`}
              onMouseDown={(e) => { e.preventDefault(); onChange(a.code); setOpen(false); setQuery(""); }}
            >
              <span className="font-mono font-semibold text-[#C8924A]">{a.code}</span>
              <span className="text-[#6B7280]"> — {a.label}</span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

// ─── Pending Receipt Card ─────────────────────────────────────────────────────

interface CardProps {
  receipt: ReceiptWithUrl;
  suppliers: SupplierSummary[];
  form: CardForm;
  saving: boolean;
  savingEdits: boolean;
  hasUnsavedChanges: boolean;
  dismissing: boolean;
  previewing: boolean;
  onFormChange: (field: keyof CardForm, val: string) => void;
  onConfirm: () => void;
  onSave: () => void;
  onIgnore: () => void;
  onPreview: () => void;
  embedded?: boolean;
  expenseNotes?: boolean;
}

function SupplierSelect({
  receiptId,
  suppliers,
  value,
  onChange,
  expenseNotes = false,
}: {
  receiptId: string;
  suppliers: SupplierSummary[];
  value: string;
  onChange: (value: string) => void;
  expenseNotes?: boolean;
}) {
  const normalize = (name: string) => name.trim().toLocaleLowerCase("fr").replace(/\s+/g, " ");
  const existingSuppliers = suppliers.filter((supplier) => supplier.receiptIds.some((id) => id !== receiptId));
  const selectedSupplier = existingSuppliers.find((supplier) => supplier.receiptIds.includes(receiptId))
    ?? existingSuppliers.find((supplier) => normalize(supplier.name) === normalize(value));
  const [addingNew, setAddingNew] = useState(() => Boolean(value) && !selectedSupplier);

  return (
    <div className={`grid gap-2 ${addingNew ? "sm:grid-cols-2" : "grid-cols-1"}`}>
      <select
        className="input h-9 py-0"
        value={addingNew ? "__new__" : selectedSupplier?.name ?? ""}
        onChange={(event) => {
          if (event.target.value === "__new__") {
            setAddingNew(true);
            onChange("");
            return;
          }
          setAddingNew(false);
          onChange(event.target.value);
        }}
        aria-label={expenseNotes ? "Sélectionner un commerçant ou bénéficiaire" : "Sélectionner un fournisseur"}
      >
        <option value="">{expenseNotes ? "Sélectionner un commerçant…" : "Sélectionner un fournisseur…"}</option>
        {existingSuppliers.map((supplier) => (
          <option key={supplier.key} value={supplier.name}>{supplier.name}</option>
        ))}
        <option value="__new__">{expenseNotes ? "+ Nouveau commerçant" : "+ Nouveau fournisseur"}</option>
      </select>

      {addingNew && (
        <input
          className="input h-9 py-0"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={expenseNotes ? "Nom du nouveau commerçant" : "Nom du nouveau fournisseur"}
          aria-label={expenseNotes ? "Nom du nouveau commerçant" : "Nom du nouveau fournisseur"}
          autoFocus={!value}
        />
      )}
      {addingNew && <p className="text-[9.5px] text-[#8A909B] sm:col-start-2">Ajouté à la liste après enregistrement.</p>}
    </div>
  );
}

function ReceiptCard({ receipt: r, suppliers, form, saving, savingEdits, hasUnsavedChanges, dismissing, previewing, onFormChange, onConfirm, onSave, onIgnore, onPreview, embedded = false, expenseNotes = false }: CardProps) {
  const [referenceTime] = useState(() => Date.now());
  const ocr = r.ocr_data;
  const amt = parseFloat(form.amount);
  const isExpense = isNaN(amt) ? true : amt < 0;
  const isAvoir = !expenseNotes && (ocr as any).document_type === "avoir";
  const emailProvider = (ocr as any).email_provider as string | undefined;
  const tvaRate = Number(form.tva_rate || 0);
  const entryPreview = computePurchaseAmounts({
    amount: Number.isFinite(amt) ? amt : 0,
    discount_amount: Number(form.discount_amount || 0),
    tva_rate: tvaRate,
  });
  const categoryAccounts = expenseNotes ? expenseNoteCategoryToCompte : categoryToCompte;
  const expenseAccount = form.compte_comptable || categoryAccounts[form.category] || (expenseNotes ? "" : "6111");
  const expenseLabel = cgncAccounts.find((account) => account.code === expenseAccount)?.label ?? (expenseNotes ? "Compte à sélectionner" : "Compte de charge");

  return (
    <div
      className={`bg-white overflow-hidden transition-all duration-300 ${embedded ? "min-h-full" : ""}`}
      style={{
        boxShadow: embedded ? "none" : "0 1px 3px rgba(0,0,0,0.06)",
        border: embedded ? "none" : isAvoir ? "1px solid rgba(124,58,237,0.3)" : "1px solid rgba(0,0,0,0.20)",
        borderRadius: embedded ? 0 : "12px",
        transform: dismissing ? `translateX(${isExpense ? "-100%" : "100%"})` : "translateX(0)",
        opacity: dismissing ? 0 : 1,
        position: "relative",
      }}
    >
      {isAvoir && (
        <div className="px-4 pt-3 pb-0">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full"
            style={{ background: "rgba(124,58,237,0.10)", color: "#7C3AED" }}>
            Avoir fournisseur détecté
          </span>
        </div>
      )}
      {!embedded && (
        <button
          onClick={onPreview}
          className={`absolute top-4 right-4 flex items-center gap-1 text-[12px] border rounded-md transition-colors ${
            previewing
              ? "bg-[rgba(200,146,74,0.12)] text-[#C8924A] border-[rgba(200,146,74,0.3)]"
              : "bg-white text-[#6B7280] border-[rgba(0,0,0,0.15)] hover:bg-[#FAFAF6]"
          }`}
          style={{ padding: "4px 10px" }}
        >
          <Eye size={12} /> Vérifier
        </button>
      )}

      <div className="flex items-start gap-3 px-4 pt-4 pb-3">
        <div className={`flex-1 min-w-0 ${embedded ? "" : "pr-20"}`}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13.5px] font-bold text-[#1A1A2E] truncate">
              {form.supplier || r.file_name || (expenseNotes ? "Note de frais sans titre" : "Facture sans titre")}
            </span>
            <ConfidenceBadge confidence={ocr.confidence} overallConfidence={(ocr as any).overall_confidence} />
            <SourceBadge provider={emailProvider} />
            <ControlBadge checks={r.control_checks} />
            <ApprovalBadge status={r.approval_status} />
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {ocr.date && <span className="text-[11px] text-[#9CA3AF]">{fmtDate(ocr.date)}</span>}
            {ocr.receipt_number && <span className="text-[11px] text-[#9CA3AF]">#{ocr.receipt_number}</span>}
            {(ocr as any).email_from && (
              <span className="text-[10.5px] text-[#9CA3AF] truncate max-w-[200px]">
                De : {(ocr as any).email_from}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 px-4 pb-4 lg:grid-cols-6">
        <div className="col-span-2 lg:col-span-6">
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.5px] text-[#9CA3AF]">{expenseNotes ? "Commerçant / bénéficiaire" : "Fournisseur"}</label>
          <SupplierSelect
            receiptId={r.id}
            suppliers={suppliers}
            value={form.supplier}
            onChange={(value) => onFormChange("supplier", value)}
            expenseNotes={expenseNotes}
          />
        </div>

        <div className="lg:col-span-3">
          <label className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-[0.5px] mb-1 block">Montant TTC net (MAD)</label>
          <div className="relative">
            <input
              type="number" step="0.01"
              className={`input pr-8 font-semibold ${isExpense ? "text-[#DC2626]" : "text-[#059669]"}`}
              value={expenseNotes ? form.amount : form.amount.replace(/^-/, "")}
              onChange={(e) => {
                const value = expenseNotes ? e.target.value : e.target.value.replace(/^-/, "");
                const keepExpenseSign = isExpense || form.amount.startsWith("-");
                onFormChange("amount", !expenseNotes && keepExpenseSign && value ? `-${value}` : value);
              }}
            />
            {expenseNotes && (
              <span className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-bold ${isExpense ? "text-[#DC2626]" : "text-[#059669]"}`}>
                {isExpense ? "−" : "+"}
              </span>
            )}
          </div>
        </div>

        <div className="lg:col-span-3">
          <label className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-[0.5px] mb-1 block">Date</label>
          <input type="date" className="input" value={form.date} onChange={(e) => onFormChange("date", e.target.value)} />
        </div>

        <div className="lg:col-span-3">
          <label className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-[0.5px] mb-1 block flex items-center gap-1">
            Échéance
            {form.due_date && (() => {
              const days = Math.ceil((new Date(form.due_date).getTime() - referenceTime) / 86400000);
              if (days < 0) return <span className="text-[9px] font-bold text-[#DC2626]">En retard</span>;
              if (days <= 7) return <span className="text-[9px] font-bold text-[#D97706]">{days}j</span>;
              return null;
            })()}
          </label>
          <input
            type="date"
            className={`input ${form.due_date && Math.ceil((new Date(form.due_date).getTime() - referenceTime) / 86400000) < 0 ? "border-[#FCA5A5]" : form.due_date && Math.ceil((new Date(form.due_date).getTime() - referenceTime) / 86400000) <= 7 ? "border-[#FDE68A] bg-[#FFFBEB]" : ""}`}
            value={form.due_date}
            onChange={(e) => onFormChange("due_date", e.target.value)}
          />
        </div>

        <div className="lg:col-span-3">
          <label className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-[0.5px] mb-1 block">Description</label>
          <input className="input" value={form.description} onChange={(e) => onFormChange("description", e.target.value)} placeholder="Description de la dépense" />
        </div>

        <div className="lg:col-span-2">
          <label className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-[0.5px] mb-1 block">Catégorie</label>
          <select className="input" value={form.category} onChange={(e) => onFormChange("category", e.target.value)}>
            {ALL_CATS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>

        <div className="lg:col-span-2">
          <label className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-[0.5px] mb-1 block">TVA</label>
          <select className="input" value={form.tva_rate} onChange={(e) => onFormChange("tva_rate", e.target.value)}>
            {TVA_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div className="lg:col-span-2">
          <label className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-[0.5px] mb-1 block">Remise TTC (MAD)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            className="input"
            value={form.discount_amount}
            onChange={(e) => onFormChange("discount_amount", e.target.value)}
            placeholder="0,00"
          />
        </div>

        <div className="col-span-2 lg:col-span-6">
          <label className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-[0.5px] mb-1 block">Compte comptable</label>
          <CompteSelect value={form.compte_comptable} onChange={(val) => onFormChange("compte_comptable", val)} />
        </div>
      </div>

      {!isAvoir && (
        <div className="mx-4 mb-4">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.5px] text-[#9CA3AF]">Aperçu de l’écriture créée</div>
          <div className="overflow-x-auto rounded-lg border border-[rgba(0,0,0,0.10)]">
            <table className="w-full min-w-[520px] text-[11px]">
              <thead className="bg-white text-[9.5px] uppercase tracking-wide text-[#9CA3AF]">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Compte</th>
                  <th className="px-3 py-2 text-left font-semibold">Libellé</th>
                  <th className="px-3 py-2 text-right font-semibold">Débit</th>
                  <th className="px-3 py-2 text-right font-semibold">Crédit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="px-3 py-2 font-mono font-semibold text-[#1A1A2E]">{expenseAccount}</td>
                  <td className="px-3 py-2 text-[#4B5563]">{expenseLabel}</td>
                  <td className="px-3 py-2 text-right font-semibold">{fmt(entryPreview.totalHt)} MAD</td>
                  <td className="px-3 py-2 text-right text-[#9CA3AF]">—</td>
                </tr>
                {entryPreview.tvaAmount > 0 && (
                  <tr>
                    <td className="px-3 py-2 font-mono font-semibold text-[#1A1A2E]">3455</td>
                    <td className="px-3 py-2 text-[#4B5563]">État TVA récupérable</td>
                    <td className="px-3 py-2 text-right font-semibold">{fmt(entryPreview.tvaAmount)} MAD</td>
                    <td className="px-3 py-2 text-right text-[#9CA3AF]">—</td>
                  </tr>
                )}
                {entryPreview.discountAmount > 0 && (
                  <tr>
                    <td className="px-3 py-2 font-mono font-semibold text-[#1A1A2E]">6119</td>
                    <td className="px-3 py-2 text-[#4B5563]">RRR obtenus sur achats</td>
                    <td className="px-3 py-2 text-right text-[#9CA3AF]">—</td>
                    <td className="px-3 py-2 text-right font-semibold">{fmt(entryPreview.discountAmount)} MAD</td>
                  </tr>
                )}
                <tr>
                  <td className="px-3 py-2 font-mono font-semibold text-[#1A1A2E]">4411</td>
                  <td className="px-3 py-2 text-[#4B5563]">Fournisseurs</td>
                  <td className="px-3 py-2 text-right text-[#9CA3AF]">—</td>
                  <td className="px-3 py-2 text-right font-semibold">{fmt(entryPreview.totalTtc)} MAD</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className={`flex items-center justify-end gap-2 px-4 pb-4 ${embedded ? "sticky bottom-0 z-10 border-t border-black/10 bg-white pt-3 shadow-[0_-8px_20px_rgba(13,21,38,0.06)]" : ""}`}>
        <button
          onClick={onIgnore}
          className="rounded-md border border-black/15 bg-white px-2.5 py-1.5 text-[11.5px] font-medium text-[#6B7280] transition-colors hover:bg-[#F3F4F6] hover:text-[#374151]"
        >
          Ignorer
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving || savingEdits || !hasUnsavedChanges}
          className="inline-flex items-center gap-1 rounded-md border border-black/15 bg-[#F9FAFB] px-2.5 py-1.5 text-[11.5px] font-medium text-[#4B5563] transition-colors hover:bg-[#E5E7EB] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {savingEdits ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
          {savingEdits ? "Enregistrement…" : "Enregistrer"}
        </button>
        <button
          onClick={onConfirm}
          disabled={saving || savingEdits || (!isAvoir && (!form.description || !form.amount || (expenseNotes && !form.compte_comptable)))}
          className="inline-flex items-center gap-1 rounded-md border border-[#0D1526] bg-[#0D1526] px-2.5 py-1.5 text-[11.5px] font-semibold text-white transition-colors hover:bg-[#1C2940] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving
            ? <Loader2 size={12} className="animate-spin" />
            : isAvoir ? "Enregistrer l'avoir" : "Confirmer"}
        </button>
      </div>
    </div>
  );
}

// ─── Ignored Card ─────────────────────────────────────────────────────────────

function ProcessedCard({
  receipt: r,
  previewing,
  onRecover,
  onPreview,
}: {
  receipt: ReceiptWithUrl;
  previewing: boolean;
  onRecover?: () => void;
  onPreview: () => void;
}) {
  const ocr = r.ocr_data;
  const amt = typeof ocr.amount === "number" ? ocr.amount : null;
  const emailProvider = (ocr as any).email_provider as string | undefined;

  return (
    <div className="bg-white border border-[rgba(0,0,0,0.07)] rounded-xl px-4 py-3 flex items-center gap-3" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[12.5px] font-medium text-[#1A1A2E] truncate">
            {ocr.vendor_name ?? ocr.vendor ?? r.file_name ?? "Facture"}
          </span>
          <SourceBadge provider={emailProvider} />
          <ControlBadge checks={r.control_checks} />
          <ApprovalBadge status={r.approval_status} />
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {ocr.date && <span className="text-[10.5px] text-[#9CA3AF]">{fmtDate(ocr.date)}</span>}
          {ocr.category && <span className="text-[10.5px] text-[#9CA3AF]">{ocr.category}</span>}
        </div>
      </div>

      {amt != null && (
        <span className={`text-[12.5px] font-bold flex-shrink-0 ${amt < 0 ? "text-[#DC2626]" : "text-[#059669]"}`}>
          {amt < 0 ? "−" : "+"}{fmt(amt)} MAD
        </span>
      )}

      <span className="badge flex-shrink-0 b-draft">Ignoré</span>

      <button
        onClick={onPreview}
        title="Aperçu du document"
        className={`flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg border transition-colors ${
          previewing
            ? "bg-[rgba(200,146,74,0.12)] text-[#C8924A] border-[rgba(200,146,74,0.3)]"
            : "text-[#6B7280] border-[rgba(0,0,0,0.1)] hover:text-[#C8924A] hover:border-[#C8924A] hover:bg-[rgba(200,146,74,0.06)]"
        }`}
      >
        <Eye size={13} />
      </button>

      {onRecover && (
        <button onClick={onRecover} className="text-[11px] text-[#C8924A] hover:underline flex-shrink-0">
          Récupérer
        </button>
      )}
    </div>
  );
}
