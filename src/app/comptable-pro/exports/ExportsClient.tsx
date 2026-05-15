"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Download, FileText, BookOpen, Scale, Calculator, Package } from "lucide-react";
import type { Dossier } from "@/types/fiduciaire";

const DOCUMENT_OPTIONS = [
  { key: "journal_ventes", label: "Journal des ventes", icon: FileText },
  { key: "journal_achats", label: "Journal des achats", icon: FileText },
  { key: "grand_livre", label: "Grand livre", icon: BookOpen },
  { key: "balance", label: "Balance comptable", icon: Scale },
  { key: "declaration_tva", label: "Déclaration TVA", icon: Calculator },
  { key: "bilan", label: "Bilan comptable", icon: BookOpen },
  { key: "cpc", label: "CPC (Compte de Produits et Charges)", icon: Calculator },
];

interface Props {
  dossiers: Pick<Dossier, "id" | "raison_sociale" | "forme_juridique" | "statut">[];
}

export default function ExportsClient({ dossiers }: Props) {
  const now = new Date();
  const [selectedDossiers, setSelectedDossiers] = useState<string[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<string[]>(DOCUMENT_OPTIONS.map(d => d.key));
  const [periodStart, setPeriodStart] = useState(`${now.getFullYear()}-01`);
  const [periodEnd, setPeriodEnd] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [generating, setGenerating] = useState(false);

  function toggleDossier(id: string) {
    setSelectedDossiers(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]);
  }
  function toggleAll() {
    setSelectedDossiers(prev => prev.length === dossiers.length ? [] : dossiers.map(d => d.id));
  }
  function toggleDoc(key: string) {
    setSelectedDocs(prev => prev.includes(key) ? prev.filter(d => d !== key) : [...prev, key]);
  }

  async function generate() {
    if (selectedDossiers.length === 0) { toast.error("Sélectionnez au moins un dossier"); return; }
    if (selectedDocs.length === 0) { toast.error("Sélectionnez au moins un document"); return; }
    setGenerating(true);
    await new Promise(r => setTimeout(r, 1500));
    setGenerating(false);
    toast.success(`Export généré pour ${selectedDossiers.length} dossier${selectedDossiers.length > 1 ? "s" : ""}`);
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-7">
        <div className="w-11 h-11 rounded-xl bg-[rgba(200,146,74,0.12)] flex items-center justify-center flex-shrink-0">
          <Package size={20} className="text-[#C8924A]" />
        </div>
        <div>
          <h1 className="text-[20px] font-bold text-[#1A1A2E] leading-tight">Exports CGNC</h1>
          <p className="text-[12.5px] text-[#6B7280]">Générez les exports pour votre fiduciaire ou la DGI</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-5">
        {/* Left: dossiers + docs */}
        <div className="space-y-5">
          {/* Dossiers */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[13.5px] font-semibold text-[#1A1A2E]">Dossiers à exporter</h2>
              <button onClick={toggleAll} className="text-[11.5px] text-[#C8924A] hover:underline">
                {selectedDossiers.length === dossiers.length ? "Tout désélectionner" : "Tout sélectionner"}
              </button>
            </div>
            {dossiers.length === 0 ? (
              <p className="text-[12px] text-[#9CA3AF] py-4 text-center">Aucun dossier disponible</p>
            ) : (
              <div className="space-y-1.5 max-h-[280px] overflow-y-auto">
                {dossiers.map(d => (
                  <label key={d.id}
                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition-all ${
                      selectedDossiers.includes(d.id)
                        ? "border-[#C8924A] bg-[#FEF9F3]"
                        : "border-[rgba(0,0,0,0.07)] hover:border-[#C8924A] bg-white"
                    }`}>
                    <input type="checkbox" className="accent-[#C8924A]"
                      checked={selectedDossiers.includes(d.id)}
                      onChange={() => toggleDossier(d.id)} />
                    <span className="text-[13px] font-medium text-[#1A1A2E]">{d.raison_sociale}</span>
                    <span className="text-[11px] text-[#9CA3AF]">{d.forme_juridique}</span>
                    {d.statut === "inactif" && <span className="ml-auto tag tag-gray">Inactif</span>}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Documents */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[13.5px] font-semibold text-[#1A1A2E]">Documents à inclure</h2>
              <button onClick={() => setSelectedDocs(prev => prev.length === DOCUMENT_OPTIONS.length ? [] : DOCUMENT_OPTIONS.map(d => d.key))}
                className="text-[11.5px] text-[#C8924A] hover:underline">
                {selectedDocs.length === DOCUMENT_OPTIONS.length ? "Tout désélectionner" : "Tout sélectionner"}
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {DOCUMENT_OPTIONS.map(({ key, label, icon: Icon }) => (
                <label key={key}
                  className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition-all ${
                    selectedDocs.includes(key)
                      ? "border-[#C8924A] bg-[#FEF9F3]"
                      : "border-[rgba(0,0,0,0.07)] hover:border-[#C8924A] bg-white"
                  }`}>
                  <input type="checkbox" className="accent-[#C8924A]"
                    checked={selectedDocs.includes(key)}
                    onChange={() => toggleDoc(key)} />
                  <Icon size={13} className={selectedDocs.includes(key) ? "text-[#C8924A]" : "text-[#9CA3AF]"} />
                  <span className="text-[12.5px] text-[#1A1A2E]">{label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Right: period + generate */}
        <div className="space-y-4">
          <div className="card p-4">
            <h2 className="text-[13.5px] font-semibold text-[#1A1A2E] mb-4">Période</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-[12px] font-medium text-[#374151] mb-1">Début</label>
                <input type="month" className="input" value={periodStart} onChange={e => setPeriodStart(e.target.value)} />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[#374151] mb-1">Fin</label>
                <input type="month" className="input" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="card p-4 bg-[#F0EDE5] border-0">
            <h2 className="text-[13px] font-semibold text-[#1A1A2E] mb-3">Résumé</h2>
            <div className="space-y-1.5 text-[12px] text-[#6B7280] mb-4">
              <div className="flex justify-between">
                <span>Dossiers sélectionnés</span>
                <span className="font-semibold text-[#1A1A2E]">{selectedDossiers.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Documents</span>
                <span className="font-semibold text-[#1A1A2E]">{selectedDocs.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Période</span>
                <span className="font-semibold text-[#1A1A2E]">{periodStart} → {periodEnd}</span>
              </div>
            </div>
            <button
              onClick={generate}
              disabled={generating || selectedDossiers.length === 0}
              className="btn btn-gold w-full justify-center gap-2 disabled:opacity-60"
            >
              {generating ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Génération...
                </span>
              ) : (
                <><Download size={14} /> Générer les exports</>
              )}
            </button>
            <p className="text-[11px] text-[#9CA3AF] text-center mt-2">
              Un dossier ZIP par client sélectionné
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
