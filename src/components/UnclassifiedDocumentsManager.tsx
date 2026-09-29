"use client";

import { useCallback, useEffect, useState } from "react";
import { FileQuestion, Eye, Loader2, ReceiptText, ShoppingBag, Landmark, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { useAccountOwnerId } from "@/hooks/useAccountOwner";
import type { Receipt } from "@/types";
import BankImportModal from "@/app/(app)/transactions/BankImportModal";

type QuarantinedReceipt = Receipt & { file_name: string | null; mime_type: string | null };

export default function UnclassifiedDocumentsManager({ dossierId }: { dossierId?: string }) {
  const supabase = createClient();
  const ownerId = useAccountOwnerId();
  const [documents, setDocuments] = useState<QuarantinedReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [bankFile, setBankFile] = useState<File | null>(null);
  const [bankReceiptId, setBankReceiptId] = useState<string | null>(null);
  const [bankModalOpen, setBankModalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("receipts")
      .select("*")
      .eq("document_area", "unclassified")
      .order("created_at", { ascending: false });
    query = dossierId
      ? query.eq("dossier_id", dossierId)
      : query.eq("user_id", ownerId).is("dossier_id", null);
    const { data, error } = await query;
    if (error) toast.error("Impossible de charger les documents à classer.");
    setDocuments((data ?? []) as QuarantinedReceipt[]);
    setLoading(false);
  }, [dossierId, ownerId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const handler = (event: Event) => {
      const section = (event as CustomEvent<{ section?: string }>).detail?.section;
      if (section === "unclassified") void load();
    };
    document.addEventListener("mohasib:document-uploaded", handler);
    return () => document.removeEventListener("mohasib:document-uploaded", handler);
  }, [load]);

  async function classify(id: string, target: "purchases" | "expense_notes") {
    setProcessingId(id);
    const response = await fetch(`/api/ocr/unclassified/${id}/classify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target }),
    });
    const result = await response.json().catch(() => ({}));
    setProcessingId(null);
    if (!response.ok) {
      toast.error(result.error ?? "Classement impossible.");
      return;
    }
    toast.success(target === "purchases" ? "Document envoyé vers Achats." : "Document envoyé vers Notes de frais.");
    await load();
  }

  async function openAsBankStatement(receipt: QuarantinedReceipt) {
    setProcessingId(receipt.id);
    try {
      const response = await fetch(`/api/receipts/${receipt.id}/content`);
      if (!response.ok) throw new Error("Lecture impossible");
      const blob = await response.blob();
      setBankFile(new File([blob], receipt.file_name || "releve-bancaire.pdf", {
        type: receipt.mime_type || blob.type || "application/pdf",
      }));
      setBankReceiptId(receipt.id);
      setBankModalOpen(true);
    } catch {
      toast.error("Impossible d’ouvrir le document dans l’import bancaire.");
    } finally {
      setProcessingId(null);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Supprimer définitivement ce document à classer ?")) return;
    setProcessingId(id);
    const response = await fetch(`/api/receipts/${id}`, { method: "DELETE" });
    setProcessingId(null);
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      toast.error(result.error ?? "Suppression impossible.");
      return;
    }
    toast.success("Document supprimé.");
    await load();
  }

  async function finishBankImport() {
    if (bankReceiptId) {
      const response = await fetch(`/api/receipts/${bankReceiptId}`, { method: "DELETE" });
      if (!response.ok) {
        toast.error("Le relevé a été importé, mais sa copie à classer n’a pas pu être supprimée.");
      }
    }
    setBankModalOpen(false);
    setBankFile(null);
    setBankReceiptId(null);
    await load();
  }

  return (
    <div>
      <div className="mb-5 flex items-center gap-2.5">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
          <FileQuestion size={18} />
        </div>
        <div>
          <h1 className="text-[18px] font-bold leading-none text-[#1A1A2E]">Documents à classer</h1>
          <p className="mt-1 text-[11.5px] text-[#8A909B]">Ces documents n’ont pas été classés automatiquement afin d’éviter une écriture dans la mauvaise section.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-48 items-center justify-center text-[#8A909B]"><Loader2 className="animate-spin" size={22} /></div>
      ) : documents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/15 bg-white px-6 py-14 text-center">
          <FileQuestion className="mx-auto mb-3 text-[#C8924A]" size={30} />
          <p className="text-[13px] font-semibold text-[#1A1A2E]">Aucun document à classer</p>
          <p className="mt-1 text-[11.5px] text-[#8A909B]">Tous les documents ont une destination confirmée.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {documents.map(document => {
            const busy = processingId === document.id;
            return (
              <article key={document.id} className="rounded-xl border border-black/10 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-[#1A1A2E]">{document.file_name || "Document sans nom"}</p>
                    <p className="mt-1 text-[11px] text-[#8A909B]">
                      {document.ocr_data.classification_reason || "Le type du document n’a pas pu être déterminé avec fiabilité."}
                    </p>
                    <a href={`/api/receipts/${document.id}/content`} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[#C8924A] hover:underline">
                      <Eye size={12} /> Vérifier le document
                    </a>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button disabled={busy} onClick={() => void classify(document.id, "purchases")} className="btn btn-outline inline-flex items-center gap-1.5 disabled:opacity-50">
                      <ShoppingBag size={13} /> Achats
                    </button>
                    <button disabled={busy} onClick={() => void classify(document.id, "expense_notes")} className="btn btn-outline inline-flex items-center gap-1.5 disabled:opacity-50">
                      <ReceiptText size={13} /> Note de frais
                    </button>
                    <button disabled={busy} onClick={() => void openAsBankStatement(document)} className="btn btn-gold inline-flex items-center gap-1.5 disabled:opacity-50">
                      {busy ? <Loader2 size={13} className="animate-spin" /> : <Landmark size={13} />} Relevé bancaire
                    </button>
                    <button disabled={busy} onClick={() => void remove(document.id)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50" aria-label="Supprimer le document">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <BankImportModal
        open={bankModalOpen}
        onClose={() => { setBankModalOpen(false); setBankFile(null); setBankReceiptId(null); }}
        userId={ownerId}
        dossierId={dossierId}
        initialFile={bankFile}
        onImported={() => { void finishBankImport(); }}
      />
    </div>
  );
}
