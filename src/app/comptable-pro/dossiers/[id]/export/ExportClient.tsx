"use client";

import { useState } from "react";
import { Download } from "lucide-react";

const DOCS = ["Journal des ventes", "Journal des achats", "Grand livre", "Balance comptable", "Déclaration TVA", "Bilan + CPC"];

interface Props {
  dossier: { id: string; raison_sociale: string };
}

export default function ExportClient({ dossier }: Props) {
  const now = new Date();
  const [period, setPeriod] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [selected, setSelected] = useState<Set<string>>(new Set(DOCS));

  function toggle(doc: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(doc)) next.delete(doc); else next.add(doc);
      return next;
    });
  }

  return (
    <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl p-5">
      <h2 className="text-[14px] font-semibold text-[#1A1A2E] mb-4">
        Exporter les données de {dossier.raison_sociale}
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-5">
        {DOCS.map(doc => (
          <label key={doc} className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
            selected.has(doc)
              ? "border-[#C8924A] bg-[#FFFBF5]"
              : "border-[rgba(0,0,0,0.07)] bg-white hover:border-[#C8924A]/40"
          }`}>
            <input type="checkbox" checked={selected.has(doc)} onChange={() => toggle(doc)} className="accent-[#C8924A]" />
            <span className="text-[12.5px] text-[#1A1A2E]">{doc}</span>
          </label>
        ))}
      </div>
      <div className="flex items-end gap-3">
        <div>
          <label className="block text-[12px] font-medium text-[#374151] mb-1">Période</label>
          <input type="month" className="input" value={period} onChange={e => setPeriod(e.target.value)} />
        </div>
        <button className="btn btn-gold flex items-center gap-2">
          <Download size={14} /> Générer l'export ZIP
        </button>
      </div>
    </div>
  );
}
