"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import type { Receipt, OcrData, Transaction } from "@/types";
import { TRANSACTION_CATEGORIES } from "@/lib/utils";
import { cgncAccounts, categoryToCompte } from "@/lib/cgnc-accounts";
import { Upload, CheckCircle, X, Loader2, Camera, FileText, Eye, RefreshCw, Download } from "lucide-react";
import toast from "react-hot-toast";
import { translateError } from "@/lib/errors";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return Math.abs(n).toLocaleString("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(d: string) {
  try { return new Date(d).toLocaleDateString("fr-MA", { day: "2-digit", month: "2-digit", year: "numeric" }); }
  catch { return d; }
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

const ALL_CATS = [...TRANSACTION_CATEGORIES.expense, ...TRANSACTION_CATEGORIES.income];
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
  const category = ocr.category ?? "Autre dépense";
  const compte = ocr.compte ?? categoryToCompte[category] ?? "";
  return {
    amount: signedAmt,
    category,
    description: vendor ? (desc ? `${vendor} — ${desc}` : vendor) : desc,
    date: ocr.date ?? new Date().toISOString().split("T")[0],
    tva_rate: String(ocr.tva_rate ?? ""),
    compte_comptable: compte,
  };
}

const sessionLocalUrls: Record<string, string> = {};

function ConfidenceBadge({ confidence }: { confidence?: number | null }) {
  if (confidence == null) return null;
  if (confidence >= 0.8)
    return <span className="text-[9.5px] font-semibold px-1.5 py-0.5 rounded-full bg-[#D1FAE5] text-[#065F46]">IA sûre</span>;
  if (confidence >= 0.5)
    return <span className="text-[9.5px] font-semibold px-1.5 py-0.5 rounded-full bg-[#FEF3C7] text-[#92400E]">Vérifiez</span>;
  return <span className="text-[9.5px] font-semibold px-1.5 py-0.5 rounded-full bg-[#FEE2E2] text-[#991B1B]">À vérifier</span>;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function InboxPage() {
  const supabase = createClient();
  const [userId, setUserId] = useState("");
  const [receipts, setReceipts] = useState<ReceiptWithUrl[]>([]);
  const [transactions, setTransactions] = useState<Record<string, Transaction>>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("pending");
  const [forms, setForms] = useState<Record<string, CardForm>>({});
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [dismissing, setDismissing] = useState<Set<string>>(new Set());
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [batchModal, setBatchModal] = useState(false);
  const [batchSaving, setBatchSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [previewReceipt, setPreviewReceipt] = useState<ReceiptWithUrl | null>(null);
  const [emailSyncing, setEmailSyncing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    const { data } = await supabase
      .from("receipts").select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
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

    // Fetch linked transactions for matched receipts
    const matchedIds = list.filter((r) => r.status === "matched").map((r) => r.id);
    if (matchedIds.length > 0) {
      const { data: txData } = await supabase
        .from("transactions")
        .select("*")
        .in("receipt_id", matchedIds);
      const txMap: Record<string, Transaction> = {};
      for (const tx of txData ?? []) {
        if (tx.receipt_id) txMap[tx.receipt_id] = tx;
      }
      setTransactions(txMap);
    }

    setLoading(false);
  }, []);

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
  }, [receipts]);

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

  // ── Email sync ────────────────────────────────────────────────────────────

  async function handleEmailSync() {
    setEmailSyncing(true);
    try {
      const [gmailRes, outlookRes] = await Promise.allSettled([
        fetch("/api/oauth/gmail/sync", { method: "POST" }).then((r) => r.json()),
        fetch("/api/oauth/outlook/sync", { method: "POST" }).then((r) => r.json()),
      ]);
      const gmailJson = gmailRes.status === "fulfilled" ? gmailRes.value : null;
      const outlookJson = outlookRes.status === "fulfilled" ? outlookRes.value : null;

      const totalImported = (gmailJson?.imported ?? 0) + (outlookJson?.imported ?? 0);
      const totalFound = (gmailJson?.messagesFound ?? 0);

      if (totalFound === 0 && totalImported === 0) {
        toast("Aucun email de facture trouvé", { icon: "📭" });
      } else {
        toast.success(`${totalFound} email(s) trouvé(s) — ${totalImported} document(s) importé(s)`);
      }
      if (totalImported > 0) {
        await load();
        setTab("pending");
      }
    } catch {
      toast.error("Erreur de synchronisation email");
    } finally {
      setEmailSyncing(false);
    }
  }

  // ── Confirm / Ignore ──────────────────────────────────────────────────────

  async function confirmReceipt(id: string) {
    const form = forms[id];
    if (!form) return;
    setSaving((s) => new Set([...s, id]));
    const amt = parseFloat(form.amount);
    if (isNaN(amt)) {
      toast.error("Montant invalide");
      setSaving((s) => { s.delete(id); return new Set(s); });
      return;
    }
    const row = {
      user_id: userId,
      type: amt >= 0 ? "income" : "expense",
      description: form.description || "Dépense",
      amount: Math.abs(amt),
      date: form.date,
      category: form.category || null,
      currency: "MAD",
      receipt_id: id,
      compte_comptable: form.compte_comptable || null,
    };
    let { error } = await supabase.from("transactions").insert(row);
    if (error?.message.includes("compte_comptable")) {
      const { compte_comptable: _c, ...rowWithout } = row;
      ({ error } = await supabase.from("transactions").insert(rowWithout));
    }
    if (error) {
      toast.error("Erreur lors de la création");
      setSaving((s) => { s.delete(id); return new Set(s); });
      return;
    }
    await supabase.from("receipts").update({ status: "matched" }).eq("id", id);
    setSaving((s) => { s.delete(id); return new Set(s); });
    if (previewReceipt?.id === id) setPreviewReceipt(null);
    dismissCard(id, "right");
    toast.success("Transaction créée !");
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

  // ── Batch confirm ─────────────────────────────────────────────────────────

  async function confirmAll() {
    setBatchSaving(true);
    const pend = receipts.filter((r) => r.status === "pending");
    const rows = pend.map((r) => {
      const form = forms[r.id] ?? initForm(r.ocr_data);
      const amt = parseFloat(form.amount);
      return {
        user_id: userId,
        type: isNaN(amt) || amt >= 0 ? "income" : "expense" as const,
        description: form.description || "Dépense",
        amount: isNaN(amt) ? 0 : Math.abs(amt),
        date: form.date,
        category: form.category || null,
        currency: "MAD",
        receipt_id: r.id,
        compte_comptable: form.compte_comptable || null,
      };
    });
    let { error: batchErr } = await supabase.from("transactions").insert(rows);
    if (batchErr?.message.includes("compte_comptable")) {
      const simpleRows = rows.map(({ compte_comptable: _c, ...r }) => r);
      ({ error: batchErr } = await supabase.from("transactions").insert(simpleRows));
    }
    if (batchErr) { toast.error(translateError(batchErr)); setBatchSaving(false); return; }
    await supabase.from("receipts").update({ status: "matched" }).eq("user_id", userId).eq("status", "pending");
    setBatchSaving(false);
    setBatchModal(false);
    setPreviewReceipt(null);
    toast.success(`${rows.length} transactions créées !`);
    await load();
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

      {/* ─── Upload zone ─────────────────────────────────────────────────── */}
      <div
        className={`bg-white border-2 rounded-xl p-5 mb-4 transition-all ${dragOver ? "border-[#C8924A] bg-[rgba(200,146,74,0.04)]" : "border-dashed border-[rgba(200,146,74,0.35)]"}`}
        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files); }}
      >
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple className="hidden"
          onChange={(e) => { if (e.target.files?.length) { handleFiles(e.target.files); e.target.value = ""; } }} />
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={(e) => { if (e.target.files?.length) { handleFiles(e.target.files); e.target.value = ""; } }} />

        <div className="text-center mb-4">
          <div className="text-[13.5px] font-semibold text-[#1A1A2E] mb-0.5">Ajoutez vos reçus et factures</div>
          <div className="text-[11.5px] text-[#9CA3AF]">L&apos;IA extrait automatiquement toutes les informations</div>
        </div>

        <div className="flex gap-2 justify-center flex-wrap">
          <button onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[12px] font-medium transition-colors"
            style={{ backgroundColor: "#C8924A", color: "#fff", border: "none" }}>
            <Upload size={13} /> Importer un fichier
          </button>
          <button onClick={() => cameraInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[rgba(0,0,0,0.12)] text-[12px] font-medium text-[#374151] bg-white hover:border-[#C8924A] hover:text-[#C8924A] transition-colors">
            <Camera size={13} /> Prendre une photo
          </button>
          <button
            onClick={handleEmailSync}
            disabled={emailSyncing}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[rgba(0,0,0,0.12)] text-[12px] font-medium text-[#374151] bg-white hover:border-[#C8924A] hover:text-[#C8924A] transition-colors disabled:opacity-50"
          >
            {emailSyncing
              ? <Loader2 size={13} className="animate-spin" />
              : <RefreshCw size={13} />
            }
            Synchroniser emails
          </button>
        </div>

        <div className="text-center mt-3 text-[10.5px] text-[#9CA3AF]">
          JPG · PNG · PDF · WebP — max 10 MB · Plusieurs fichiers à la fois
        </div>
      </div>

      {/* ─── In-progress uploads ─────────────────────────────────────────── */}
      {uploadingFiles.length > 0 && (
        <div className="flex flex-col gap-1.5 mb-3">
          {uploadingFiles.map((f) => (
            <div key={f.tempId} className="bg-white border border-[rgba(0,0,0,0.07)] rounded-xl px-4 py-3 flex items-center gap-3" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
              <div className="w-10 h-10 rounded-lg bg-[#F3F4F6] flex items-center justify-center flex-shrink-0">
                {f.state === "error"
                  ? <X size={16} className="text-[#DC2626]" />
                  : f.state === "done"
                    ? <CheckCircle size={16} className="text-[#059669]" />
                    : <Loader2 size={16} className="animate-spin text-[#C8924A]" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-medium text-[#1A1A2E] truncate">{f.name}</div>
                <div className={`text-[11px] mt-0.5 ${f.state === "error" ? "text-[#DC2626]" : f.state === "done" ? "text-[#059669]" : "text-[#C8924A]"}`}>
                  {f.state === "uploading" && "📤 Envoi en cours..."}
                  {f.state === "processing" && "🔍 Extraction IA..."}
                  {f.state === "done" && "✓ Extrait !"}
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

      {/* ─── Batch confirm bar ───────────────────────────────────────────── */}
      {pending.length >= 3 && tab === "pending" && (
        <div className="flex items-center justify-between bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl px-4 py-3 mb-4">
          <span className="text-[12.5px] font-semibold text-[#1E40AF]">
            {pending.length} reçus en attente
          </span>
          <button onClick={() => setBatchModal(true)} className="btn btn-sm" style={{ backgroundColor: "#1D4ED8", color: "#fff", border: "none" }}>
            ✓ Tout confirmer
          </button>
        </div>
      )}

      {/* ─── Tabs ────────────────────────────────────────────────────────── */}
      <div className="flex gap-0 border-b border-[rgba(0,0,0,0.08)] mb-4">
        {([
          ["pending", "À traiter", pending.length],
          ["matched", "Traités", matched.length],
          ["ignored", "Ignorés", ignored.length],
        ] as const).map(([key, label, count]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-[12.5px] border-b-2 transition-all select-none ${
              tab === key
                ? "text-[#C8924A] border-[#C8924A] font-medium"
                : "text-[#6B7280] border-transparent hover:text-[#1A1A2E]"
            }`}>
            {label}
            {count > 0 && (
              <span className={`ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                tab === key ? "bg-[#C8924A] text-white" : "bg-[#F3F4F6] text-[#6B7280]"
              }`}>{count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ─── Loading ─────────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex flex-col gap-2">
          {[1, 2].map((i) => <div key={i} className="h-36 bg-white rounded-xl border border-[rgba(0,0,0,0.07)] animate-pulse" />)}
        </div>
      )}

      {/* ─── Traités: accounting ledger ──────────────────────────────────── */}
      {!loading && tab === "matched" && (
        <LedgerView receipts={matched} transactions={transactions} />
      )}

      {/* ─── Pending / Ignored: empty state ─────────────────────────────── */}
      {!loading && tab !== "matched" && tabItems.length === 0 && (
        <div className="bg-white border border-[rgba(0,0,0,0.07)] rounded-xl px-5 py-12 text-center" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
          <div className="text-4xl mb-3">{tab === "pending" ? "📥" : "🗂️"}</div>
          <p className="text-[13px] font-medium text-[#6B7280]">
            {tab === "pending" ? "Boîte de réception vide" : "Aucun reçu ignoré"}
          </p>
          <p className="text-[11.5px] text-[#9CA3AF] mt-1">
            {tab === "pending" ? "Tous vos reçus ont été traités !" : "Les reçus ignorés apparaissent ici."}
          </p>
          {tab === "pending" && (
            <button onClick={() => fileInputRef.current?.click()} className="btn btn-gold mt-4 text-[12px]">
              <Upload size={12} /> Importer un reçu
            </button>
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

      {/* ─── Batch confirm modal ─────────────────────────────────────────── */}
      {batchModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5">
            <h3 className="text-[14px] font-bold text-[#1A1A2E] mb-4">
              Confirmer {pending.length} transactions ?
            </h3>
            <div className="flex flex-col gap-1.5 mb-4 max-h-48 overflow-y-auto">
              {pending.map((r) => {
                const form = forms[r.id] ?? initForm(r.ocr_data);
                const amt = parseFloat(form.amount);
                return (
                  <div key={r.id} className="flex items-center justify-between text-[12px] py-1 border-b border-[rgba(0,0,0,0.05)] last:border-0">
                    <span className="text-[#374151] truncate flex-1 mr-2">
                      {form.description || (r.ocr_data.vendor_name ?? r.ocr_data.vendor) || "Reçu"}
                    </span>
                    <span className={`font-semibold flex-shrink-0 ${isNaN(amt) || amt >= 0 ? "text-[#059669]" : "text-[#DC2626]"}`}>
                      {isNaN(amt) ? "—" : `${amt >= 0 ? "+" : ""}${fmt(amt)} MAD`}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between py-2 border-t border-[rgba(0,0,0,0.08)] mb-4">
              <span className="text-[12.5px] font-semibold text-[#1A1A2E]">Total dépenses</span>
              <span className="text-[13px] font-bold text-[#DC2626]">
                −{pending.reduce((s, r) => {
                  const f = forms[r.id] ?? initForm(r.ocr_data);
                  const a = parseFloat(f.amount);
                  return s + (isNaN(a) || a >= 0 ? 0 : Math.abs(a));
                }, 0).toLocaleString("fr-MA", { minimumFractionDigits: 2 })} MAD
              </span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setBatchModal(false)} className="btn btn-outline flex-1">Annuler</button>
              <button onClick={confirmAll} disabled={batchSaving} className="btn btn-gold flex-1">
                {batchSaving
                  ? <Loader2 size={13} className="animate-spin" />
                  : <><CheckCircle size={13} /> Tout confirmer</>}
              </button>
            </div>
          </div>
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

function LedgerView({
  receipts,
  transactions,
}: {
  receipts: ReceiptWithUrl[];
  transactions: Record<string, Transaction>;
}) {
  const rows = receipts.map((r) => {
    const ocr = r.ocr_data;
    const tx = transactions[r.id];
    const { ht, tva, ttc } = computeAmounts(ocr);
    const journal = (ocr.type === "income" || (tx?.type === "income")) ? "VTE" : "ACH";
    return {
      id: r.id,
      journal,
      date: ocr.date ?? tx?.date ?? r.created_at?.split("T")[0] ?? "",
      vendor: ocr.vendor_name ?? ocr.vendor ?? "",
      ref: ocr.receipt_number ?? "",
      description: tx?.description ?? ocr.description ?? "",
      ht,
      tva,
      ttc,
      tvaRate: ocr.tva_rate ?? 0,
      category: tx?.category ?? ocr.category ?? "",
      compte: tx?.compte_comptable ?? ocr.compte ?? "",
      paymentMethod: ocr.payment_method ?? tx?.payment_method ?? "",
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
        <div className="text-4xl mb-3">✅</div>
        <p className="text-[13px] font-medium text-[#6B7280]">Aucun reçu traité</p>
        <p className="text-[11.5px] text-[#9CA3AF] mt-1">Importez vos reçus pour les traiter.</p>
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
            <div className="text-[20px] font-bold font-mono leading-none" style={{ color: m.color }}>{m.value}</div>
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
                  <td className="px-3 py-2.5 text-right font-mono text-[#1A1A2E]">{fmt(row.ht)}</td>
                  <td className="px-3 py-2.5 text-center">
                    {row.tvaRate > 0 ? (
                      <span className="inline-block px-1.5 py-0.5 rounded-full text-[9.5px] font-bold bg-[#FEF3C7] text-[#92400E]">{row.tvaRate}%</span>
                    ) : (
                      <span className="text-[#D1D5DB] text-[10px]">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-[#9CA3AF]">
                    {row.tva > 0 ? fmt(row.tva) : <span className="text-[#D1D5DB]">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-bold text-[#1A1A2E]">{fmt(row.ttc)}</td>
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
            <tfoot>
              <tr className="bg-[#1A1A2E]">
                <td colSpan={4} className="px-3 py-3 text-[10.5px] font-semibold text-white/50 uppercase tracking-[0.5px]">
                  Totaux — {rows.length} écriture{rows.length > 1 ? "s" : ""}
                </td>
                <td className="px-3 py-3 text-right font-mono font-bold text-white whitespace-nowrap">{fmt(totalHt)}</td>
                <td />
                <td className="px-3 py-3 text-right font-mono font-bold text-white/60 whitespace-nowrap">{fmt(totalTva)}</td>
                <td className="px-3 py-3 text-right font-mono font-bold whitespace-nowrap" style={{ color: "#C8924A" }}>{fmt(totalTtc)}</td>
                <td colSpan={4} />
              </tr>
            </tfoot>
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

  return (
    <div
      className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl overflow-hidden transition-all duration-300"
      style={{
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        transform: dismissing ? `translateX(${isExpense ? "-100%" : "100%"})` : "translateX(0)",
        opacity: dismissing ? 0 : 1,
        position: "relative",
      }}
    >
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
              {ocr.vendor_name ?? ocr.vendor ?? r.file_name ?? "Reçu sans titre"}
            </span>
            <ConfidenceBadge confidence={ocr.confidence} />
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {ocr.date && <span className="text-[11px] text-[#9CA3AF]">{fmtDate(ocr.date)}</span>}
            {ocr.receipt_number && <span className="text-[11px] text-[#9CA3AF]">#{ocr.receipt_number}</span>}
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

        <div className="col-span-2">
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
          disabled={saving || !form.description || !form.amount}
          className="flex items-center gap-1.5 text-[13px] font-medium text-[#15803D] bg-white border border-[#15803D] rounded-lg transition-colors cursor-pointer hover:bg-[#F0FDF4] disabled:opacity-50"
          style={{ padding: "8px 16px" }}
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : "Confirmer"}
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

  return (
    <div className="bg-white border border-[rgba(0,0,0,0.07)] rounded-xl px-4 py-3 flex items-center gap-3" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
      <div className="flex-1 min-w-0">
        <span className="text-[12.5px] font-medium text-[#1A1A2E] truncate block">
          {ocr.vendor_name ?? ocr.vendor ?? r.file_name ?? "Reçu"}
        </span>
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
