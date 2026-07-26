"use client";

import { useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload, X } from "lucide-react";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/client";
import { translateError } from "@/lib/errors";
import {
  CATALOG_IMPORT_HEADERS,
  MAX_CATALOG_IMPORT_ROWS,
  parseCatalogImportRows,
  type CatalogImportPreviewRow,
} from "@/lib/invoice-items-import";

interface Props {
  userId: string;
  dossierId?: string;
  existingNames: string[];
  onImported: () => void | Promise<void>;
}

const TEMPLATE_ROWS = [
  ["Abonnement mensuel", "Accompagnement et support mensuels", "Service", 1500, "mois", 20],
  ["Audit comptable", "Mission d’audit ponctuelle", "Conseil", 3500, "service", 20],
];

function downloadTemplate() {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([[...CATALOG_IMPORT_HEADERS], ...TEMPLATE_ROWS]);
  sheet["!cols"] = [
    { wch: 28 },
    { wch: 42 },
    { wch: 20 },
    { wch: 20 },
    { wch: 14 },
    { wch: 12 },
  ];
  sheet["!autofilter"] = { ref: `A1:F${TEMPLATE_ROWS.length + 1}` };
  XLSX.utils.book_append_sheet(workbook, sheet, "Articles");
  XLSX.writeFile(workbook, "modele-import-articles-prestations.xlsx");
}

async function readWorkbook(file: File, existingNames: string[]) {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) throw new Error("Le classeur ne contient aucune feuille.");
  const rows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, {
    header: 1,
    defval: "",
    raw: true,
  }) as unknown[][];
  return parseCatalogImportRows(rows, existingNames);
}

export default function InvoiceItemsImport({ userId, dossierId, existingNames, onImported }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<CatalogImportPreviewRow[]>([]);
  const [reading, setReading] = useState(false);
  const [importing, setImporting] = useState(false);
  const validRows = preview.filter((row) => row.errors.length === 0);
  const invalidRows = preview.length - validRows.length;

  function reset() {
    setOpen(false);
    setFileName("");
    setPreview([]);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function selectFile(file?: File) {
    if (!file) return;
    const extension = file.name.toLocaleLowerCase();
    if (!extension.endsWith(".xlsx") && !extension.endsWith(".xls")) {
      toast.error("Sélectionnez un fichier Excel .xlsx ou .xls.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Le fichier ne doit pas dépasser 5 Mo.");
      return;
    }

    setOpen(true);
    setFileName(file.name);
    setPreview([]);
    setReading(true);
    try {
      const rows = await readWorkbook(file, existingNames);
      setPreview(rows);
      if (!rows.length) toast.error("Aucune ligne à importer dans ce fichier.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible de lire ce fichier Excel.");
    } finally {
      setReading(false);
    }
  }

  async function importRows() {
    if (!validRows.length) return;
    setImporting(true);
    const { error } = await supabase.from("invoice_items_catalog").insert(
      validRows.map((row) => ({
        user_id: userId,
        ...(dossierId ? { dossier_id: dossierId } : {}),
        name: row.name,
        description: row.description,
        category: row.category,
        unit: row.unit,
        unit_price: row.unit_price,
        tva_rate: row.tva_rate,
        is_active: true,
      })),
    );
    setImporting(false);

    if (error) {
      toast.error(translateError(error));
      return;
    }

    toast.success(
      `${validRows.length} article${validRows.length > 1 ? "s" : ""} importé${validRows.length > 1 ? "s" : ""}`,
    );
    reset();
    await onImported();
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        className="hidden"
        onChange={(event) => selectFile(event.target.files?.[0])}
      />

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={downloadTemplate} className="btn inline-flex items-center gap-1.5">
          <Download size={13} /> Télécharger le modèle Excel
        </button>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="btn btn-gold inline-flex items-center gap-1.5"
        >
          <Upload size={13} /> Importer un fichier Excel
        </button>
      </div>
      <p className="mt-2 text-[11px] text-[#9CA3AF]">
        Jusqu’à {MAX_CATALOG_IMPORT_ROWS.toLocaleString("fr-MA")} lignes par fichier. Les doublons et les lignes invalides seront ignorés.
      </p>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={reset}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="catalog-import-title"
            className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-black/[0.07] px-5 py-4">
              <div>
                <h3 id="catalog-import-title" className="flex items-center gap-2 text-[15px] font-semibold text-[#1A1A2E]">
                  <FileSpreadsheet size={17} className="text-[#C8924A]" /> Importer des articles
                </h3>
                <p className="mt-1 text-[11px] text-[#6B7280]">{fileName}</p>
              </div>
              <button type="button" onClick={reset} aria-label="Fermer" className="rounded-lg p-2 text-[#6B7280] hover:bg-[#F3F4F6]">
                <X size={16} />
              </button>
            </div>

            <div className="p-5">
              {reading && (
                <div className="flex items-center justify-center gap-2 py-12 text-[13px] text-[#6B7280]">
                  <Loader2 size={17} className="animate-spin" /> Lecture du fichier…
                </div>
              )}

              {!reading && preview.length === 0 && (
                <div className="rounded-xl bg-[#FEF2F2] px-4 py-3 text-[12px] text-[#B91C1C]">
                  Aucune donnée exploitable. Vérifiez le fichier ou repartez du modèle Excel.
                </div>
              )}

              {!reading && preview.length > 0 && (
                <>
                  <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <div className="rounded-xl bg-[#F8FAFC] p-3">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-[#6B7280]">Lignes détectées</div>
                      <div className="mt-1 text-xl font-bold text-[#1A1A2E]">{preview.length}</div>
                    </div>
                    <div className="rounded-xl bg-[#F0FDF4] p-3">
                      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-[#047857]">
                        <CheckCircle2 size={12} /> Prêtes à importer
                      </div>
                      <div className="mt-1 text-xl font-bold text-[#047857]">{validRows.length}</div>
                    </div>
                    <div className="rounded-xl bg-[#FFF7ED] p-3">
                      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-[#B45309]">
                        <AlertCircle size={12} /> Ignorées
                      </div>
                      <div className="mt-1 text-xl font-bold text-[#B45309]">{invalidRows}</div>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-black/[0.07]">
                    <table className="w-full min-w-[720px] text-left text-[11px]">
                      <thead className="bg-[#FAFAF6] text-[10px] uppercase tracking-wide text-[#6B7280]">
                        <tr>
                          <th className="px-3 py-2">Ligne</th>
                          <th className="px-3 py-2">Article</th>
                          <th className="px-3 py-2">Prix HT</th>
                          <th className="px-3 py-2">Unité</th>
                          <th className="px-3 py-2">TVA</th>
                          <th className="px-3 py-2">Résultat</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.slice(0, 12).map((row) => (
                          <tr key={row.sourceRow} className="border-t border-black/[0.06]">
                            <td className="px-3 py-2 text-[#9CA3AF]">{row.sourceRow}</td>
                            <td className="px-3 py-2">
                              <div className="font-semibold text-[#1A1A2E]">{row.name || "—"}</div>
                              <div className="max-w-[260px] truncate text-[#6B7280]">{row.description || row.category || "—"}</div>
                            </td>
                            <td className="whitespace-nowrap px-3 py-2">{row.unit_price.toLocaleString("fr-MA")} MAD</td>
                            <td className="px-3 py-2">{row.unit}</td>
                            <td className="px-3 py-2">{row.tva_rate}%</td>
                            <td className="px-3 py-2">
                              {row.errors.length ? (
                                <span className="text-[#B45309]">{row.errors.join(" · ")}</span>
                              ) : (
                                <span className="font-medium text-[#047857]">Prête</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {preview.length > 12 && (
                    <p className="mt-2 text-center text-[11px] text-[#9CA3AF]">
                      Aperçu des 12 premières lignes sur {preview.length}.
                    </p>
                  )}
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-black/[0.07] px-5 py-4">
              <button type="button" onClick={reset} disabled={importing} className="btn">
                Annuler
              </button>
              <button
                type="button"
                onClick={importRows}
                disabled={reading || importing || validRows.length === 0}
                className="btn btn-gold inline-flex items-center gap-1.5"
              >
                {importing ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                {importing ? "Import en cours…" : `Importer ${validRows.length} ligne${validRows.length > 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
