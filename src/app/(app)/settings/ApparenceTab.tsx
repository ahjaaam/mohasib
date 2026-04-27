"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { translateError } from "@/lib/errors";

interface Props {
  userId: string;
  company: any;
}

const COLOR_PRESETS = [
  { label: "Gold", value: "#C8924A" },
  { label: "Navy", value: "#0D1526" },
  { label: "Emerald", value: "#059669" },
  { label: "Slate", value: "#475569" },
  { label: "Rose", value: "#E11D48" },
];

export default function ApparenceTab({ userId, company }: Props) {
  const supabase = createClient();
  const [saving, setSaving] = useState(false);

  const [color, setColor] = useState(company.invoice_color ?? "#C8924A");
  const [shows, setShows] = useState({
    show_logo: company.show_logo ?? true,
    show_cnss: company.show_cnss ?? true,
    show_capital: company.show_capital ?? false,
    show_rib: company.show_rib ?? true,
    show_mentions: company.show_mentions ?? true,
    show_page_number: company.show_page_number ?? true,
  });

  const toggleShow = (k: keyof typeof shows) => setShows(s => ({ ...s, [k]: !s[k] }));

  async function save() {
    setSaving(true);
    const { error } = await supabase.from("companies").upsert({
      user_id: userId,
      invoice_color: color,
      ...shows,
    }, { onConflict: "user_id" });
    setSaving(false);
    if (error) toast.error(translateError(error));
    else toast.success("✓ Apparence enregistrée");
  }

  const Toggle = ({ k, label }: { k: keyof typeof shows; label: string }) => (
    <div className="flex items-center justify-between py-2 border-b border-[rgba(0,0,0,0.05)] last:border-0">
      <span className="text-[12.5px] text-[#1A1A2E]">{label}</span>
      <button
        onClick={() => toggleShow(k)}
        className={`w-10 h-5 rounded-full transition-colors relative flex-shrink-0 ${shows[k] ? "bg-[#C8924A]" : "bg-[#D1D5DB]"}`}
      >
        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${shows[k] ? "translate-x-5" : "translate-x-0.5"}`} />
      </button>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Color */}
      <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl p-5">
        <h3 className="text-[13px] font-semibold text-[#1A1A2E] mb-0.5">Couleur de vos factures</h3>
        <p className="text-[11.5px] text-[#9CA3AF] mb-4">Cette couleur sera utilisée sur vos factures</p>
        <div className="flex items-center gap-2 flex-wrap mb-3">
          {COLOR_PRESETS.map(p => (
            <button
              key={p.value}
              onClick={() => setColor(p.value)}
              title={p.label}
              className={`w-8 h-8 rounded-full border-2 transition-all ${color === p.value ? "border-[#1A1A2E] scale-110" : "border-transparent"}`}
              style={{ backgroundColor: p.value }}
            />
          ))}
          <div className="flex items-center gap-2 ml-2">
            <input
              type="color"
              value={color}
              onChange={e => setColor(e.target.value)}
              className="w-8 h-8 rounded-full border-none cursor-pointer"
            />
            <input
              className="input w-[100px]"
              value={color}
              onChange={e => setColor(e.target.value)}
              placeholder="#C8924A"
            />
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: color }} />
          <span className="text-[11.5px] text-[#6B7280]">Aperçu de la couleur sur vos factures</span>
        </div>
      </div>

      {/* Show/Hide */}
      <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl p-5">
        <h3 className="text-[13px] font-semibold text-[#1A1A2E] mb-3">Éléments affichés sur les factures</h3>
        <Toggle k="show_logo" label="Afficher le logo" />
        <Toggle k="show_cnss" label="Afficher le numéro CNSS" />
        <Toggle k="show_capital" label="Afficher le capital social" />
        <Toggle k="show_rib" label="Afficher le RIB bancaire" />
        <Toggle k="show_mentions" label="Afficher les mentions légales" />
        <Toggle k="show_page_number" label="Afficher le numéro de page" />
      </div>

      {/* Dark mode coming soon */}
      <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl p-5 opacity-60">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-[13px] font-semibold text-[#1A1A2E]">Thème de l&apos;application</h3>
          <span className="text-[10px] px-2 py-0.5 bg-[#F3F4F6] text-[#6B7280] rounded-full font-medium">Bientôt disponible</span>
        </div>
        <p className="text-[12px] text-[#9CA3AF]">🌙 Thème sombre — Bientôt disponible</p>
      </div>

      <button onClick={save} disabled={saving} className="btn btn-gold w-full justify-center py-2.5 disabled:opacity-60">
        {saving ? "Enregistrement..." : "Enregistrer l'apparence"}
      </button>
    </div>
  );
}
