"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Receipt } from "@/types";
import { TRANSACTION_CATEGORIES } from "@/lib/utils";
import { Upload, CheckCircle, X, Loader2, Paperclip, MailOpen } from "lucide-react";

function fmt(n: number) { return n.toLocaleString("fr-MA") + " MAD"; }
function fmtDate(d: string) {
  try { return new Date(d).toLocaleDateString("fr-MA"); } catch { return d; }
}

const today = new Date().toISOString().split("T")[0];
const allCats = [...TRANSACTION_CATEGORIES.income, ...TRANSACTION_CATEGORIES.expense];

interface ReceiptWithUrl extends Receipt {
  signedUrl?: string;
}

interface InlineForm {
  date: string;
  desc: string;
  cat: string;
  amount: string;
}

export default function InboxPage() {
  const supabase = createClient();
  const [userId, setUserId] = useState("");
  const [pending, setPending] = useState<ReceiptWithUrl[]>([]);
  const [matched, setMatched] = useState<ReceiptWithUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [forms, setForms] = useState<Record<string, InlineForm>>({});
  const dropRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const { data } = await supabase
      .from("receipts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    const receipts: Receipt[] = data ?? [];

    // Get signed URLs for receipts with storage_path
    const withUrls: ReceiptWithUrl[] = await Promise.all(
      receipts.map(async (r) => {
        if (!r.storage_path) return r;
        const { data: urlData } = await supabase.storage
          .from("receipts")
          .createSignedUrl(r.storage_path, 3600);
        return { ...r, signedUrl: urlData?.signedUrl };
      })
    );

    setPending(withUrls.filter((r) => r.status === "pending"));
    setMatched(withUrls.filter((r) => r.status !== "pending"));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  // Topbar "Importer" button
  useEffect(() => {
    const handler = () => fileInputRef.current?.click();
    document.addEventListener("inbox-upload", handler);
    return () => document.removeEventListener("inbox-upload", handler);
  }, []);

  function initForm(r: ReceiptWithUrl): InlineForm {
    const ocr = r.ocr_data;
    return {
      date: ocr.date ?? today,
      desc: ocr.vendor
        ? `${ocr.vendor}${ocr.description ? " — " + ocr.description : ""}`
        : ocr.description ?? "",
      cat: ocr.category ?? "Autre dépense",
      amount: ocr.amount != null
        ? (ocr.type === "expense" ? `-${ocr.amount}` : String(ocr.amount))
        : "",
    };
  }

  function toggleExpand(r: ReceiptWithUrl) {
    if (expandedId === r.id) {
      setExpandedId(null);
    } else {
      setExpandedId(r.id);
      if (!forms[r.id]) setForms((f) => ({ ...f, [r.id]: initForm(r) }));
    }
  }

  async function createTransaction(receiptId: string) {
    const form = forms[receiptId];
    if (!form?.desc || !form?.amount) return;
    setSavingId(receiptId);

    const amt = parseFloat(form.amount);
    const type = amt >= 0 ? "income" : "expense";

    const { error } = await supabase.from("transactions").insert({
      user_id: userId,
      type,
      description: form.desc,
      amount: Math.abs(amt),
      date: form.date,
      category: form.cat || null,
      currency: "MAD",
      ...(receiptId ? { receipt_id: receiptId } : {}),
    });

    if (!error) {
      await supabase.from("receipts").update({ status: "matched" }).eq("id", receiptId);
    }
    setSavingId(null);
    setExpandedId(null);
    load();
  }

  async function ignoreReceipt(id: string) {
    await supabase.from("receipts").update({ status: "ignored" }).eq("id", id);
    load();
  }

  async function handleUpload(file: File) {
    setUploading(true);
    setUploadError(null);
    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch("/api/ocr", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) { setUploadError(json.error ?? "Erreur d'upload"); return; }
      await load();
    } catch {
      setUploadError("Impossible d'uploader le fichier.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // Drag & drop
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  }

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2.5 mb-4">
        <div className="kpi">
          <div className="kpi-label">En attente</div>
          <div className="kpi-value text-[#C8924A]">{loading ? "—" : pending.length}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Traités</div>
          <div className="kpi-value text-[#059669]">{loading ? "—" : matched.filter((r) => r.status === "matched").length}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Ignorés</div>
          <div className="kpi-value text-[#6B7280]">{loading ? "—" : matched.filter((r) => r.status === "ignored").length}</div>
        </div>
      </div>

      {/* Upload zone */}
      <div
        ref={dropRef}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
        className="border-2 border-dashed border-[rgba(200,146,74,0.35)] rounded-xl p-6 mb-4 text-center cursor-pointer hover:border-[#C8924A] hover:bg-[rgba(200,146,74,0.03)] transition-all bg-white"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-2 text-[#C8924A]">
            <Loader2 size={24} className="animate-spin" />
            <span className="text-[12.5px] font-medium">Analyse OCR en cours...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-[#6B7280]">
            <Upload size={22} className="text-[#C8924A]" />
            <span className="text-[13px] font-medium text-[#1A1A2E]">Déposez un reçu ou une facture ici</span>
            <span className="text-[11.5px]">JPG, PNG, WebP · Extraction automatique par IA</span>
          </div>
        )}
      </div>
      {uploadError && (
        <p className="text-[12px] text-[#DC2626] bg-[#FEE2E2] rounded-lg px-3 py-2 mb-3">{uploadError}</p>
      )}

      {/* Email integration teaser */}
      <div className="alert-blue flex items-center gap-2 mb-4">
        <MailOpen size={14} className="text-[#1D4ED8] flex-shrink-0" />
        <span>
          <strong>Intégration e-mail bientôt disponible</strong> — vos factures et reçus seront importés automatiquement depuis votre boîte mail.
        </span>
      </div>

      {/* Pending receipts */}
      {loading ? (
        <div className="text-center py-10 text-[#6B7280] text-[12.5px]">Chargement...</div>
      ) : pending.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-center">
          <div className="text-4xl mb-3">📥</div>
          <p className="text-[#6B7280] font-medium text-[13px]">Boîte de réception vide</p>
          <p className="text-[11.5px] text-[#9CA3AF] mt-1">Importez un reçu ci-dessus pour le traiter.</p>
        </div>
      ) : (
        <div>
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.6px] text-[#6B7280] mb-2">
            À traiter — {pending.length}
          </div>
          <div className="flex flex-col gap-2">
            {pending.map((r) => (
              <ReceiptCard
                key={r.id}
                receipt={r}
                expanded={expandedId === r.id}
                form={forms[r.id]}
                saving={savingId === r.id}
                onToggle={() => toggleExpand(r)}
                onFormChange={(field, val) =>
                  setForms((f) => ({ ...f, [r.id]: { ...f[r.id], [field]: val } }))
                }
                onCreate={() => createTransaction(r.id)}
                onIgnore={() => ignoreReceipt(r.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Matched receipts */}
      {matched.length > 0 && (
        <div className="mt-5">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.6px] text-[#6B7280] mb-2">
            Traités — {matched.length}
          </div>
          <div className="flex flex-col gap-1.5">
            {matched.map((r) => (
              <div key={r.id} className="bg-white border border-[rgba(0,0,0,0.07)] rounded-xl px-4 py-3 flex items-center gap-3 opacity-60">
                <Paperclip size={13} className="text-[#9CA3AF] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-[12.5px] text-[#1A1A2E]">
                    {r.ocr_data.vendor ?? r.file_name ?? "Reçu"}
                  </span>
                  {r.ocr_data.amount != null && (
                    <span className="text-[11.5px] text-[#6B7280] ml-2">{fmt(r.ocr_data.amount)}</span>
                  )}
                </div>
                <span className={`badge ${r.status === "matched" ? "b-paid" : "b-draft"}`}>
                  {r.status === "matched" ? "Associé" : "Ignoré"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface CardProps {
  receipt: ReceiptWithUrl;
  expanded: boolean;
  form?: InlineForm;
  saving: boolean;
  onToggle: () => void;
  onFormChange: (field: keyof InlineForm, val: string) => void;
  onCreate: () => void;
  onIgnore: () => void;
}

function ReceiptCard({ receipt: r, expanded, form, saving, onToggle, onFormChange, onCreate, onIgnore }: CardProps) {
  const ocr = r.ocr_data;

  return (
    <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl overflow-hidden">
      {/* Summary row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Thumbnail */}
        <div className="w-10 h-10 rounded-lg bg-[#F3F4F6] flex items-center justify-center flex-shrink-0 overflow-hidden">
          {r.signedUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={r.signedUrl} alt="reçu" className="w-full h-full object-cover" />
          ) : (
            <Paperclip size={16} className="text-[#9CA3AF]" />
          )}
        </div>

        {/* Meta */}
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-[#1A1A2E] truncate">
            {ocr.vendor ?? r.file_name ?? "Reçu sans titre"}
          </div>
          <div className="text-[11.5px] text-[#6B7280] flex gap-2 mt-0.5 flex-wrap">
            {ocr.date && <span>{fmtDate(ocr.date)}</span>}
            {ocr.category && <span className="badge b-draft">{ocr.category}</span>}
          </div>
        </div>

        {/* Amount */}
        {ocr.amount != null && (
          <div className={`text-[14px] font-bold flex-shrink-0 ${ocr.type === "income" ? "text-[#059669]" : "text-[#DC2626]"}`}>
            {ocr.type === "income" ? "+" : "-"}{fmt(ocr.amount)}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-1.5 flex-shrink-0">
          <button
            onClick={onToggle}
            className={`btn text-[11.5px] py-1 px-2.5 ${expanded ? "btn-outline" : "btn-gold"}`}
          >
            {expanded ? "Fermer" : "Créer transaction"}
          </button>
          <button
            onClick={onIgnore}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[#9CA3AF] hover:text-[#DC2626] hover:bg-[#FEE2E2] transition-colors"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Expanded inline form */}
      {expanded && form && (
        <div className="border-t border-[rgba(0,0,0,0.06)] px-4 py-3 bg-[#FAFAF6]">
          <div className="grid gap-2" style={{ gridTemplateColumns: "110px 1fr 130px 120px auto" }}>
            <div className="flex flex-col gap-1">
              <label className="text-[10.5px] font-medium text-[#6B7280]">Date</label>
              <input type="date" className="input" value={form.date}
                onChange={(e) => onFormChange("date", e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10.5px] font-medium text-[#6B7280]">Description</label>
              <input className="input" value={form.desc}
                onChange={(e) => onFormChange("desc", e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10.5px] font-medium text-[#6B7280]">Catégorie</label>
              <select className="input" value={form.cat}
                onChange={(e) => onFormChange("cat", e.target.value)}>
                {allCats.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10.5px] font-medium text-[#6B7280]">Montant (MAD)</label>
              <input type="number" step="0.01" className="input" value={form.amount}
                onChange={(e) => onFormChange("amount", e.target.value)} />
            </div>
            <div className="flex flex-col justify-end">
              <button onClick={onCreate} disabled={saving || !form.desc || !form.amount} className="btn btn-gold whitespace-nowrap">
                {saving ? <Loader2 size={12} className="animate-spin" /> : <><CheckCircle size={12} /> Valider</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
