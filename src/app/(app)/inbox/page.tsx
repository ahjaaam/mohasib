"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Receipt, OcrData } from "@/types";
import { TRANSACTION_CATEGORIES } from "@/lib/utils";
import { cgncAccounts, categoryToCompte } from "@/lib/cgnc-accounts";
import { Upload, CheckCircle, X, Loader2, Camera, FileText, Eye, Download, Inbox, Mail, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import { useAccountOwnerId } from "@/hooks/useAccountOwner";

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
  const ttc = Math.abs(ocr.amount ?? 0);
  const tvaRate = ocr.tva_rate ?? 0;
  let ht = ttc;
  let tva = 0;
  if (ocr.tva_amount != null && ocr.tva_amount > 0) {
    tva = ocr.tva_amount;
    ht = ttc - tva;
  } else if (tvaRate > 0) {
    ht = ttc / (1 + tvaRate / 100);
    tva = ttc - ht;
  }
  return { ht, tva, ttc };
}

const ALL_CATS = TRANSACTION_CATEGORIES.expense;
const TVA_OPTIONS = [
  { label: "Aucune TVA", value: "" },
  { label: "7%", value: "7" },
  { label: "10%", value: "10" },
  { label: "14%", value: "14" },
  { label: "20%", value: "20" },
];

type Tab = "pending" | "matched" | "ignored";

interface ReceiptWithUrl extends Receipt { signedUrl?: string; }

interface CardForm {
  amount: string;
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


function initForm(ocr: OcrData): CardForm {
  const vendor = ocr.vendor_name ?? ocr.vendor ?? "";
  const desc = ocr.description ?? "";
  const signedAmt = typeof ocr.amount === "number"
    ? String(ocr.amount)
    : ocr.type === "expense" && ocr.amount != null
      ? String(-Math.abs(ocr.amount))
      : String(ocr.amount ?? "");
  const category = ocr.category ?? "Achats";
  const compte = ocr.compte ?? categoryToCompte[category] ?? "";
  const tvaRate = ocr.tva_rate ?? (ocr.amount != null ? 20 : null);
  const invoiceDate = ocr.date ?? new Date().toISOString().split("T")[0];
  return {
    amount: signedAmt,
    category,
    description: vendor ? (desc ? `${vendor} — ${desc}` : vendor) : desc,
    date: invoiceDate,
    due_date: ocr.due_date ?? addDays(invoiceDate, 60),
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

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function InboxPage({ dossierId, inboxEmail }: { dossierId?: string; inboxEmail?: string | null } = {}) {
  const ownerId = useAccountOwnerId();
  const supabase = createClient();
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [receipts, setReceipts] = useState<ReceiptWithUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [tab, setTab] = useState<Tab>("pending");
  const [forms, setForms] = useState<Record<string, CardForm>>({});
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [dismissing, setDismissing] = useState<Set<string>>(new Set());
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [previewReceipt, setPreviewReceipt] = useState<ReceiptWithUrl | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(ownerId);
    const receiptsQuery = supabase.from("receipts").select("*").order("created_at", { ascending: false });
    const { data } = await (dossierId
      ? receiptsQuery.eq("dossier_id", dossierId)
      : receiptsQuery.eq("user_id", ownerId).is("dossier_id", null));
    const list: Receipt[] = data ?? [];
    const withUrls: ReceiptWithUrl[] = await Promise.all(list.map(async (r) => {
      let signedUrl: string | undefined;
      if (r.storage_path) {
        const { data: urlData } = supabase.storage
          .from("receipts").getPublicUrl(r.storage_path);
        signedUrl = urlData?.publicUrl ?? undefined;
      }
      return { ...r, signedUrl: signedUrl ?? sessionLocalUrls[r.id] };
    }));
    setReceipts(withUrls);
    setForms((prev) => {
      const next = { ...prev };
      withUrls.filter((r) => r.status === "pending").forEach((r) => {
        if (!next[r.id]) next[r.id] = initForm(r.ocr_data);
      });
      return next;
    });


    setLoading(false);
  }, [dossierId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

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
        toast("Connectez votre email dans Paramètres → Intégrations", { icon: "📧" });
        router.push("/settings?tab=integrations");
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
    setSaving((s) => new Set([...s, id]));

    const isAvoir = (receipt.ocr_data as any).document_type === "avoir";

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
        fournisseur: receipt.ocr_data.vendor_name ?? receipt.ocr_data.vendor ?? form.description ?? "Fournisseur",
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
      await supabase.from("receipts").update({ status: "matched" }).eq("id", id);
      setSaving((s) => { s.delete(id); return new Set(s); });
      if (previewReceipt?.id === id) setPreviewReceipt(null);
      dismissCard(id, "right");
      toast.success(`Avoir fournisseur ${numero} enregistré !`);
      return;
    }

    const amt = parseFloat(form.amount);
    if (isNaN(amt)) {
      toast.error("Montant invalide");
      setSaving((s) => { s.delete(id); return new Set(s); });
      return;
    }
    const confirmedOcr = {
      ...receipt.ocr_data,
      amount: amt,
      type: amt >= 0 ? "income" : "expense",
      date: form.date,
      due_date: form.due_date || receipt.ocr_data.due_date || null,
      is_supplier_invoice: receipt.ocr_data.is_supplier_invoice ?? true,
      category: form.category || receipt.ocr_data.category || null,
      description: form.description || receipt.ocr_data.description || null,
      tva_rate: form.tva_rate ? parseFloat(form.tva_rate) : receipt.ocr_data.tva_rate,
      compte: form.compte_comptable || (receipt.ocr_data as any).compte || null,
    };
    const { error } = await supabase
      .from("receipts")
      .update({ status: "matched", ocr_data: confirmedOcr })
      .eq("id", id);
    if (error) {
      toast.error("Erreur lors de la confirmation");
      setSaving((s) => { s.delete(id); return new Set(s); });
      return;
    }
    if (dossierId) {
      await supabase.from("dossiers").update({ derniere_ecriture: new Date().toISOString() }).eq("id", dossierId);
    }
    setSaving((s) => { s.delete(id); return new Set(s); });
    if (previewReceipt?.id === id) setPreviewReceipt(null);
    dismissCard(id, "right");
    if (confirmedOcr.is_supplier_invoice !== false) {
      toast.success("Ajoutée au suivi des paiements fournisseurs !");
    } else {
      toast.success("Facture confirmée !");
    }
  }

  async function ignoreReceipt(id: string) {
    await supabase.from("receipts").update({ status: "ignored" }).eq("id", id);
    if (previewReceipt?.id === id) setPreviewReceipt(null);
    dismissCard(id, "left");
  }

  async function recoverReceipt(id: string) {
    await supabase.from("receipts").update({ status: "pending" }).eq("id", id);
    await load();
    setTab("pending");
  }

  function dismissCard(id: string, _dir: "left" | "right") {
    setDismissing((s) => new Set([...s, id]));
    setTimeout(async () => {
      setDismissing((s) => { s.delete(id); return new Set(s); });
      await load();
    }, 320);
  }

  function updateForm(id: string, field: keyof CardForm, val: string) {
    setForms((f) => {
      const updated = { ...f[id], [field]: val };
      if (field === "category") {
        updated.compte_comptable = categoryToCompte[val] ?? f[id]?.compte_comptable ?? "";
      }
      return { ...f, [id]: updated };
    });
  }

  // ── Derived state ─────────────────────────────────────────────────────────

  const pending = receipts.filter((r) => r.status === "pending");
  const matched = receipts.filter((r) => r.status === "matched");
  const ignored = receipts.filter((r) => r.status === "ignored");
  const tabItems = tab === "pending" ? pending : tab === "matched" ? matched : ignored;

  return (
    <div>

      {/* ─── Page header ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(200,146,74,0.12)" }}>
          <Inbox size={18} className="text-[#C8924A]" />
        </div>
        <div>
          <h1 className="text-[18px] font-bold text-[#1A1A2E] leading-none">Boîte de réception</h1>
          <p className="text-[11px] text-[#9CA3AF] mt-0.5">Factures fournisseurs — importez, vérifiez et confirmez</p>
        </div>
      </div>

      {/* ─── Section tabs ────────────────────────────────────────────────── */}
      <div className="tabs mb-5 overflow-x-auto">
        {([
          ["pending", "À traiter", pending.length],
          ["matched", "Traités", matched.length],
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
                <div className="mb-0.5 text-[13.5px] font-semibold text-[#1A1A2E]">Importez vos factures fournisseurs</div>
                <div className="text-[11.5px] text-[#8A909B]">L&apos;IA extrait automatiquement le fournisseur, le montant, la TVA et la date.</div>
                <div className="mt-1 text-[10px] text-[#A1A6B0]">JPG · PNG · PDF · WebP · 10 Mo max · Import multiple</div>
              </div>

              <div className="flex flex-wrap gap-2 lg:flex-shrink-0 lg:justify-end">
                {!dossierId && (
                  <button data-permission="document:create" onClick={handleEmailSync} disabled={syncing}
                    className="flex items-center gap-1.5 whitespace-nowrap px-3.5 py-2 text-[12px] font-medium transition-colors disabled:opacity-50"
                    style={{ backgroundColor: "#0D1526", color: "#fff", border: "none" }}>
                    <RefreshCw size={13} className={syncing ? "animate-spin" : ""} />
                    {syncing ? "Synchronisation…" : "Sync mes emails"}
                  </button>
                )}
                <button data-permission="document:create" onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 whitespace-nowrap border border-[rgba(0,0,0,0.18)] bg-[#FAFAF6] px-3.5 py-2 text-[12px] font-medium text-[#374151] shadow-[0_1px_2px_rgba(13,21,38,0.05)] transition-colors hover:border-[#C8924A] hover:bg-[#F0EDE5] hover:text-[#C8924A]">
                  <Upload size={13} /> Importer des documents
                </button>
                <button data-permission="document:create" onClick={() => cameraInputRef.current?.click()}
                  className="flex items-center gap-1.5 whitespace-nowrap border border-[rgba(0,0,0,0.18)] bg-[#FAFAF6] px-3.5 py-2 text-[12px] font-medium text-[#374151] shadow-[0_1px_2px_rgba(13,21,38,0.05)] transition-colors hover:border-[#C8924A] hover:bg-[#F0EDE5] hover:text-[#C8924A]">
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
                      {f.state === "uploading" && "📤 Envoi en cours..."}
                      {f.state === "processing" && "🔍 Extraction IA..."}
                      {f.state === "done" && (
                        <span className="inline-flex items-center gap-1">
                          <CheckCircle size={11} aria-hidden="true" /> Extrait !
                        </span>
                      )}
                      {f.state === "error" && `❌ ${f.error ?? "Erreur"}`}
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

      {/* ─── Loading ─────────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex flex-col gap-2">
          {[1, 2].map((i) => <div key={i} className="h-36 bg-white rounded-xl border border-[rgba(0,0,0,0.07)] animate-pulse" />)}
        </div>
      )}

      {/* ─── Traités: accounting ledger ──────────────────────────────────── */}
      {!loading && tab === "matched" && (
        <LedgerView receipts={matched} />
      )}

      {/* ─── Pending / Ignored: empty state ─────────────────────────────── */}
      {!loading && tab !== "matched" && tabItems.length === 0 && (
        <div className="empty-state">
          <div className="text-4xl mb-3">{tab === "pending" ? (dossierId && inboxEmail ? "📧" : "📥") : "🗂️"}</div>
          <p className="text-[13px] font-medium text-[#6B7280]">
            {tab === "pending" ? "Aucune facture reçue" : "Aucune facture ignorée"}
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
                  📋 Copier
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
                  ? "Toutes vos factures fournisseurs ont été traitées !"
                  : "Les factures ignorées apparaissent ici."}
              </p>
              {tab === "pending" && (
                <button onClick={() => fileInputRef.current?.click()} className="btn btn-gold mt-4 text-[12px]">
                  <Upload size={12} /> Importer une facture
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* ─── Cards (pending / ignored) ───────────────────────────────────── */}
      {!loading && tab !== "matched" && tabItems.length > 0 && (
        <div className="flex flex-col gap-3">
          {tabItems.map((r) =>
            tab === "pending" ? (
              <ReceiptCard
                key={r.id}
                receipt={r}
                form={forms[r.id] ?? initForm(r.ocr_data)}
                saving={saving.has(r.id)}
                dismissing={dismissing.has(r.id)}
                previewing={previewReceipt?.id === r.id}
                onFormChange={(field, val) => updateForm(r.id, field, val)}
                onConfirm={() => confirmReceipt(r.id)}
                onIgnore={() => ignoreReceipt(r.id)}
                onPreview={() => setPreviewReceipt(previewReceipt?.id === r.id ? null : r)}
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
      {previewReceipt && (
        <PreviewPanel
          receipt={previewReceipt}
          onClose={() => setPreviewReceipt(null)}
        />
      )}
    </div>
  );
}

// ─── Accounting Ledger View ───────────────────────────────────────────────────

function LedgerView({ receipts }: { receipts: ReceiptWithUrl[] }) {
  const rows = receipts.map((r) => {
    const ocr = r.ocr_data;
    const { ht, tva, ttc } = computeAmounts(ocr);
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
      ttc,
      tvaRate: ocr.tva_rate ?? 0,
      category: (ocr.category as string | null) ?? "",
      compte: (ocr as any).compte ?? "",
      paymentMethod: (ocr.payment_method as string | null) ?? "",
    };
  });

  const totalHt = rows.reduce((s, r) => s + r.ht, 0);
  const totalTva = rows.reduce((s, r) => s + r.tva, 0);
  const totalTtc = rows.reduce((s, r) => s + r.ttc, 0);

  function exportCSV() {
    const headers = ["Journal", "Date", "Fournisseur", "Référence", "Description", "HT (MAD)", "TVA %", "TVA (MAD)", "TTC (MAD)", "Catégorie", "Compte", "Mode paiement"];
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
        <CheckCircle size={32} className="mx-auto mb-3 text-[#059669]" aria-hidden="true" />
        <p className="text-[13px] font-medium text-[#6B7280]">Aucune facture traitée</p>
        <p className="text-[11.5px] text-[#9CA3AF] mt-1">Importez vos factures fournisseurs pour les traiter.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">

      {/* Summary metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {([
          { label: "Total HT", value: fmt(totalHt), sub: "MAD", color: "#1A1A2E" },
          { label: "Total TVA", value: fmt(totalTva), sub: "MAD", color: "#D97706" },
          { label: "Total TTC", value: fmt(totalTtc), sub: "MAD", color: "#C8924A" },
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
          <table className="w-full text-[11.5px] border-collapse min-w-[1100px]">
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
                  ["TTC MAD", "text-right"],
                  ["Catégorie", "text-left"],
                  ["Compte comptable", "text-left"],
                  ["Mode de paiement", "text-left"],
                  ["Statut", "text-left"],
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
                      Confirmé
                    </span>
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

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-30 md:hidden" onClick={onClose} />
      <div className="fixed top-[52px] right-0 bottom-0 z-40 w-full md:w-[420px] lg:w-[480px] bg-white border-l border-[rgba(0,0,0,0.09)] flex flex-col"
        style={{ boxShadow: "-4px 0 24px rgba(0,0,0,0.08)" }}>
        <div className="flex items-start gap-3 px-4 py-3.5 border-b border-[rgba(0,0,0,0.08)] flex-shrink-0">
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-[#1A1A2E] truncate">
              {ocr.vendor_name ?? ocr.vendor ?? r.file_name ?? "Document"}
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[#9CA3AF] flex-wrap">
              {ocr.date && <span>📅 {fmtDate(ocr.date)}</span>}
              {ocr.receipt_number && <span>#{ocr.receipt_number}</span>}
              {r.file_name && <span className="truncate max-w-[180px]">{r.file_name}</span>}
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-[#9CA3AF] hover:text-[#374151] hover:bg-[#F3F4F6] transition-colors flex-shrink-0">
            <X size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-auto bg-[#F3F4F6] flex items-start justify-center">
          {!r.signedUrl ? (
            <div className="flex flex-col items-center justify-center h-full w-full text-center p-8">
              <FileText size={40} className="text-[#D1D5DB] mb-3" />
              <p className="text-[12.5px] text-[#9CA3AF]">Aucun aperçu disponible</p>
            </div>
          ) : isPdf ? (
            <iframe src={r.signedUrl} className="w-full h-full" style={{ minHeight: "100%" }} title="Document PDF" />
          ) : (
            <div className="p-4 w-full flex items-start justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={r.signedUrl} alt="document" className="max-w-full rounded-lg shadow-md" />
            </div>
          )}
        </div>
      </div>
    </>
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
  form: CardForm;
  saving: boolean;
  dismissing: boolean;
  previewing: boolean;
  onFormChange: (field: keyof CardForm, val: string) => void;
  onConfirm: () => void;
  onIgnore: () => void;
  onPreview: () => void;
}

function ReceiptCard({ receipt: r, form, saving, dismissing, previewing, onFormChange, onConfirm, onIgnore, onPreview }: CardProps) {
  const ocr = r.ocr_data;
  const amt = parseFloat(form.amount);
  const isExpense = isNaN(amt) ? true : amt < 0;
  const isAvoir = (ocr as any).document_type === "avoir";
  const emailProvider = (ocr as any).email_provider as string | undefined;

  return (
    <div
      className="bg-white overflow-hidden transition-all duration-300"
      style={{
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        border: isAvoir ? "1px solid rgba(124,58,237,0.3)" : "1px solid rgba(0,0,0,0.20)",
        borderRadius: "12px",
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
      <button
        onClick={onPreview}
        className={`absolute top-4 right-4 flex items-center gap-1 text-[12px] border rounded-md transition-colors ${
          previewing
            ? "bg-[rgba(200,146,74,0.12)] text-[#C8924A] border-[rgba(200,146,74,0.3)]"
            : "bg-white text-[#6B7280] border-[rgba(0,0,0,0.15)] hover:bg-[#FAFAF6]"
        }`}
        style={{ padding: "4px 10px" }}
      >
        <Eye size={12} /> Aperçu
      </button>

      <div className="flex items-start gap-3 px-4 pt-4 pb-3">
        <div className="flex-1 min-w-0 pr-20">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13.5px] font-bold text-[#1A1A2E] truncate">
              {ocr.vendor_name ?? ocr.vendor ?? r.file_name ?? "Facture sans titre"}
            </span>
            <ConfidenceBadge confidence={ocr.confidence} overallConfidence={(ocr as any).overall_confidence} />
            <SourceBadge provider={emailProvider} />
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

      <div className="px-4 pb-4 grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-[0.5px] mb-1 block">Montant (MAD)</label>
          <div className="relative">
            <input
              type="number" step="0.01"
              className={`input pr-8 font-semibold ${isExpense ? "text-[#DC2626]" : "text-[#059669]"}`}
              value={form.amount}
              onChange={(e) => onFormChange("amount", e.target.value)}
            />
            <span className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-bold ${isExpense ? "text-[#DC2626]" : "text-[#059669]"}`}>
              {isExpense ? "−" : "+"}
            </span>
          </div>
        </div>

        <div>
          <label className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-[0.5px] mb-1 block">Date</label>
          <input type="date" className="input" value={form.date} onChange={(e) => onFormChange("date", e.target.value)} />
        </div>

        <div>
          <label className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-[0.5px] mb-1 block flex items-center gap-1">
            Échéance
            {form.due_date && (() => {
              const days = Math.ceil((new Date(form.due_date).getTime() - Date.now()) / 86400000);
              if (days < 0) return <span className="text-[9px] font-bold text-[#DC2626]">En retard</span>;
              if (days <= 7) return <span className="text-[9px] font-bold text-[#D97706]">{days}j</span>;
              return null;
            })()}
          </label>
          <input
            type="date"
            className={`input ${form.due_date && Math.ceil((new Date(form.due_date).getTime() - Date.now()) / 86400000) < 0 ? "border-[#FCA5A5] bg-[#FEF2F2]" : form.due_date && Math.ceil((new Date(form.due_date).getTime() - Date.now()) / 86400000) <= 7 ? "border-[#FDE68A] bg-[#FFFBEB]" : ""}`}
            value={form.due_date}
            onChange={(e) => onFormChange("due_date", e.target.value)}
          />
        </div>

        <div>
          <label className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-[0.5px] mb-1 block">Description</label>
          <input className="input" value={form.description} onChange={(e) => onFormChange("description", e.target.value)} placeholder="Description de la dépense" />
        </div>

        <div>
          <label className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-[0.5px] mb-1 block">Catégorie</label>
          <select className="input" value={form.category} onChange={(e) => onFormChange("category", e.target.value)}>
            {ALL_CATS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-[0.5px] mb-1 block">TVA</label>
          <select className="input" value={form.tva_rate} onChange={(e) => onFormChange("tva_rate", e.target.value)}>
            {TVA_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div className="col-span-2">
          <label className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-[0.5px] mb-1 block">Compte comptable</label>
          <CompteSelect value={form.compte_comptable} onChange={(val) => onFormChange("compte_comptable", val)} />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 px-4 pb-4">
        <button
          onClick={onIgnore}
          className="text-[13px] font-medium text-[#DC2626] bg-white border border-[#DC2626] rounded-lg transition-colors cursor-pointer hover:bg-[#FEE2E2]"
          style={{ padding: "8px 16px" }}
        >
          Ignorer
        </button>
        <button
          onClick={onConfirm}
          disabled={saving || (!isAvoir && (!form.description || !form.amount))}
          className="flex items-center gap-1.5 text-[13px] font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          style={{
            padding: "8px 16px",
            color: isAvoir ? "#7C3AED" : "#15803D",
            background: "white",
            border: `1px solid ${isAvoir ? "#7C3AED" : "#15803D"}`,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = isAvoir ? "rgba(124,58,237,0.06)" : "#F0FDF4")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
        >
          {saving
            ? <Loader2 size={13} className="animate-spin" />
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
