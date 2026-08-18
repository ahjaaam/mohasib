"use client";

import { useRef, useState } from "react";
import { CheckCircle2, FileSpreadsheet, FileText, Loader2, Upload, X, XCircle } from "lucide-react";

type ImportState = "ready" | "uploading" | "done" | "error";
type ImportFile = { file: File; state: ImportState; invoiceNumber?: string; clientCreated?: boolean; error?: string };

const ACCEPTED = ".pdf,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp";
const MAX_FILES = 20;
const MAX_SIZE = 20 * 1024 * 1024;

function fileIcon(name: string) {
  return /\.(xls|xlsx)$/i.test(name) ? <FileSpreadsheet size={16} /> : <FileText size={16} />;
}

export default function BulkInvoiceImportModal({ open, dossierId, onClose, onImported }: {
  open: boolean;
  dossierId?: string | null;
  onClose: () => void;
  onImported: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<ImportFile[]>([]);
  const [importing, setImporting] = useState(false);

  if (!open) return null;

  function addFiles(selected: FileList | null) {
    if (!selected) return;
    const existing = new Set(files.map(item => `${item.file.name}:${item.file.size}`));
    const next = [...files];
    for (const file of Array.from(selected)) {
      if (next.length >= MAX_FILES) break;
      if (file.size > MAX_SIZE) {
        next.push({ file, state: "error", error: "Fichier supérieur à 20 Mo" });
        continue;
      }
      const key = `${file.name}:${file.size}`;
      if (!existing.has(key)) {
        existing.add(key);
        next.push({ file, state: "ready" });
      }
    }
    setFiles(next);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function runImport() {
    const pendingIndexes = files.map((item, index) => item.state === "ready" ? index : -1).filter(index => index >= 0);
    if (!pendingIndexes.length) return;
    setImporting(true);
    let imported = 0;

    for (const index of pendingIndexes) {
      setFiles(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, state: "uploading" } : item));
      const item = files[index];
      const form = new FormData();
      form.set("file", item.file);
      if (dossierId) form.set("dossierId", dossierId);
      try {
        const response = await fetch("/api/invoices/import", { method: "POST", body: form });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error ?? "Import impossible");
        imported++;
        setFiles(current => current.map((entry, itemIndex) => itemIndex === index
          ? { ...entry, state: "done", invoiceNumber: result.invoice?.invoice_number, clientCreated: Boolean(result.clientCreated) }
          : entry));
      } catch (error) {
        setFiles(current => current.map((entry, itemIndex) => itemIndex === index
          ? { ...entry, state: "error", error: error instanceof Error ? error.message : "Import impossible" }
          : entry));
      }
    }

    setImporting(false);
    if (imported) onImported();
  }

  const readyCount = files.filter(item => item.state === "ready").length;
  const doneCount = files.filter(item => item.state === "done").length;

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/55 p-4" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !importing) onClose();
    }}>
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-[16px] font-bold text-[#1A1A2E]">Importer des factures clients</h2>
            <p className="mt-0.5 text-[11px] text-[#8A909B]">PDF, Word, Excel ou images · jusqu’à 20 fichiers</p>
          </div>
          <button disabled={importing} onClick={onClose} className="rounded-md p-2 text-[#6B7280] hover:bg-gray-100 disabled:opacity-50"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto p-5">
          <button type="button" onClick={() => inputRef.current?.click()} disabled={importing || files.length >= MAX_FILES}
            className="flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#D8C3A3] bg-[#FFFCF7] px-5 py-7 text-center hover:bg-[#FFF8ED] disabled:opacity-50">
            <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-[#FAF0DF] text-[#C8924A]"><Upload size={18} /></span>
            <span className="text-[13px] font-semibold text-[#1A1A2E]">Sélectionner plusieurs factures</span>
            <span className="mt-1 text-[10.5px] text-[#8A909B]">DOCX, XLS, XLSX, PDF, JPG, PNG ou WEBP · 20 Mo maximum par fichier</span>
          </button>
          <input ref={inputRef} type="file" multiple accept={ACCEPTED} className="hidden" onChange={event => addFiles(event.target.files)} />

          {files.length > 0 && (
            <div className="mt-4 overflow-hidden rounded-xl border border-black/10">
              {files.map((item, index) => (
                <div key={`${item.file.name}-${item.file.size}`} className="flex items-center gap-3 border-b border-gray-100 px-3 py-2.5 last:border-b-0">
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[#F4F1EA] text-[#C8924A]">{fileIcon(item.file.name)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11.5px] font-semibold text-[#1A1A2E]">{item.file.name}</div>
                    <div className={`truncate text-[10px] ${item.state === "error" ? "text-red-600" : "text-[#9CA3AF]"}`}>
                      {item.state === "ready" && `${(item.file.size / 1024 / 1024).toFixed(1)} Mo · Prête`}
                      {item.state === "uploading" && "Analyse et import en cours…"}
                      {item.state === "done" && `Importée comme ${item.invoiceNumber ?? "brouillon"}${item.clientCreated ? " · nouveau client à vérifier" : ""}`}
                      {item.state === "error" && item.error}
                    </div>
                  </div>
                  {item.state === "uploading" && <Loader2 size={15} className="animate-spin text-[#C8924A]" />}
                  {item.state === "done" && <CheckCircle2 size={15} className="text-emerald-600" />}
                  {item.state === "error" && <XCircle size={15} className="text-red-500" />}
                  {item.state === "ready" && <button disabled={importing} onClick={() => setFiles(current => current.filter((_, itemIndex) => itemIndex !== index))} className="rounded p-1 text-[#9CA3AF] hover:bg-red-50 hover:text-red-600"><X size={14} /></button>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 px-5 py-4">
          <span className="text-[10.5px] text-[#8A909B]">{doneCount ? `${doneCount} facture${doneCount > 1 ? "s" : ""} importée${doneCount > 1 ? "s" : ""}` : "Les factures seront ajoutées comme brouillons à vérifier."}</span>
          <div className="flex gap-2">
            <button disabled={importing} onClick={onClose} className="btn btn-outline">{doneCount ? "Fermer" : "Annuler"}</button>
            <button disabled={importing || readyCount === 0} onClick={runImport} className="btn btn-gold">
              {importing && <Loader2 size={14} className="animate-spin" />}
              {importing ? "Import en cours…" : `Importer ${readyCount || ""}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
