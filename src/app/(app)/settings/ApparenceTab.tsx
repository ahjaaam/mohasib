"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { Check } from "lucide-react";

interface Props {
  userId: string;
  company: any;
}

const COLOR_PRESETS = [
  { label: "Navy", value: "#0D1526" },
  { label: "Gold", value: "#C8924A" },
  { label: "Emerald", value: "#059669" },
  { label: "Slate", value: "#475569" },
  { label: "Rose", value: "#E11D48" },
];

const TEMPLATES = [
  { id: "classique", label: "Classique", desc: "Mise en page épurée, logo à gauche" },
  { id: "moderne", label: "Moderne", desc: "En-tête coloré, accents dorés" },
  { id: "minimaliste", label: "Minimaliste", desc: "Ultra épuré, centré" },
];

const FONTS = [
  { id: "Classique", label: "Classique", sub: "Arial" },
  { id: "Moderne", label: "Moderne", sub: "Inter" },
  { id: "Élégant", label: "Élégant", sub: "Garamond" },
];

export default function ApparenceTab({ userId, company }: Props) {
  const supabase = createClient();
  const [saving, setSaving] = useState(false);

  const [template, setTemplate] = useState(company.invoice_template ?? "classique");
  const [color, setColor] = useState(company.invoice_color ?? "#C8924A");
  const [font, setFont] = useState(company.invoice_font ?? "Classique");
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
      invoice_template: template,
      invoice_color: color,
      invoice_font: font,
      ...shows,
    }, { onConflict: "user_id" });
    setSaving(false);
    if (error) toast.error(error.message);
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
      {/* Template */}
      <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl p-5">
        <h3 className="text-[13px] font-semibold text-[#1A1A2E] mb-4">Modèle de facture</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {TEMPLATES.map(t => (
            <button
              key={t.id}
              onClick={() => setTemplate(t.id)}
              className={`relative border-2 rounded-xl p-4 text-left transition-all ${
                template === t.id
                  ? "border-[#C8924A] bg-[rgba(200,146,74,0.05)]"
                  : "border-[rgba(0,0,0,0.08)] hover:border-[rgba(200,146,74,0.4)]"
              }`}
            >
              {/* Mini preview */}
              <div className="w-full aspect-[3/2] rounded-lg mb-3 overflow-hidden border border-[rgba(0,0,0,0.06)]">
                {t.id === "classique" && (
                  <div className="w-full h-full bg-white p-2 flex flex-col gap-1">
                    <div className="flex justify-between items-start">
                      <div className="w-8 h-4 bg-[#C8924A] rounded" />
                      <div className="flex flex-col gap-0.5 items-end">
                        <div className="w-12 h-1 bg-[#E5E7EB] rounded" />
                        <div className="w-8 h-1 bg-[#E5E7EB] rounded" />
                      </div>
                    </div>
                    <div className="mt-2 w-full h-1 bg-[#E5E7EB] rounded" />
                    <div className="w-3/4 h-1 bg-[#E5E7EB] rounded" />
                    <div className="mt-2 flex gap-1">
                      {[1,2,3].map(i => <div key={i} className="flex-1 h-1 bg-[#F3F4F6] rounded" />)}
                    </div>
                  </div>
                )}
                {t.id === "moderne" && (
                  <div className="w-full h-full bg-white flex flex-col">
                    <div className="bg-[#0D1526] p-2 flex justify-between items-center">
                      <div className="w-8 h-3 bg-[#C8924A] rounded" />
                      <div className="w-10 h-2 bg-white/20 rounded" />
                    </div>
                    <div className="flex-1 p-2 flex flex-col gap-1">
                      <div className="w-full h-1 bg-[#E5E7EB] rounded" />
                      <div className="w-3/4 h-1 bg-[#E5E7EB] rounded" />
                      <div className="mt-1 w-full h-1 bg-[#F3F4F6] rounded" />
                    </div>
                  </div>
                )}
                {t.id === "minimaliste" && (
                  <div className="w-full h-full bg-white p-3 flex flex-col items-center gap-2">
                    <div className="w-6 h-3 bg-[#E5E7EB] rounded" />
                    <div className="w-full h-px bg-[#E5E7EB]" />
                    <div className="w-3/4 h-1 bg-[#E5E7EB] rounded" />
                    <div className="w-1/2 h-1 bg-[#F3F4F6] rounded" />
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[12.5px] font-semibold text-[#1A1A2E]">{t.label}</div>
                  <div className="text-[11px] text-[#6B7280]">{t.desc}</div>
                </div>
                {template === t.id && (
                  <div className="w-5 h-5 rounded-full bg-[#C8924A] flex items-center justify-center flex-shrink-0">
                    <Check size={11} className="text-white" />
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Color */}
      <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl p-5">
        <h3 className="text-[13px] font-semibold text-[#1A1A2E] mb-4">Couleur d&apos;accent</h3>
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
        {/* Preview */}
        <div className="flex items-center gap-2 mt-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: color }} />
          <span className="text-[11.5px] text-[#6B7280]">Aperçu de la couleur sur vos factures</span>
        </div>
      </div>

      {/* Font */}
      <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl p-5">
        <h3 className="text-[13px] font-semibold text-[#1A1A2E] mb-3">Police de caractères</h3>
        <div className="flex gap-2 flex-wrap">
          {FONTS.map(f => (
            <button
              key={f.id}
              onClick={() => setFont(f.id)}
              className={`px-4 py-2 rounded-lg border text-left transition-all ${
                font === f.id
                  ? "border-[#C8924A] bg-[rgba(200,146,74,0.05)]"
                  : "border-[rgba(0,0,0,0.1)] hover:border-[rgba(200,146,74,0.4)]"
              }`}
            >
              <div className="text-[12.5px] font-medium text-[#1A1A2E]">{f.label}</div>
              <div className="text-[10.5px] text-[#9CA3AF]">{f.sub}</div>
            </button>
          ))}
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
