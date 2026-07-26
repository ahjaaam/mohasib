"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { translateError } from "@/lib/errors";
import { Upload } from "lucide-react";

interface Props {
  dossierId: string;
  dossier: {
    logo_url?: string | null;
    address?: string | null;
    city?: string | null;
    postal_code?: string | null;
    bank_name?: string | null;
    rib?: string | null;
    invoice_prefix?: string | null;
    invoice_payment_delay?: string | null;
    invoice_mentions_legales?: string | null;
    invoice_color?: string | null;
  };
}

const BANQUES = ["Attijariwafa", "CIH", "BMCE", "BCP", "Société Générale", "BMCI", "CDG", "Al Barid Bank", "Autre"];
const DELAIS = ["Immédiat", "15 jours", "30 jours", "45 jours", "60 jours"];
const COLOR_PRESETS = [
  { label: "Gold", value: "#C8924A" },
  { label: "Navy", value: "#0D1526" },
  { label: "Emerald", value: "#059669" },
  { label: "Slate", value: "#475569" },
  { label: "Rose", value: "#E11D48" },
];

export default function DossierInvoiceSettingsTab({ dossierId, dossier }: Props) {
  const supabase = createClient();
  const logoRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState({
    logo_url: dossier.logo_url ?? "",
    address: dossier.address ?? "",
    city: dossier.city ?? "",
    postal_code: dossier.postal_code ?? "",
    bank_name: dossier.bank_name ?? "",
    rib: dossier.rib ?? "",
    invoice_prefix: dossier.invoice_prefix ?? "F-",
    invoice_payment_delay: dossier.invoice_payment_delay ?? "30 jours",
    invoice_mentions_legales: dossier.invoice_mentions_legales ?? "Paiement à 30 jours. Tout retard de paiement entraînera des pénalités conformément à la loi marocaine.",
    invoice_color: dossier.invoice_color ?? "#C8924A",
  });

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  async function uploadLogo(file: File) {
    if (file.size > 2 * 1024 * 1024) { toast.error("Logo trop lourd (max 2MB)"); return; }
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `dossier-${dossierId}/logo.${ext}`;
    const { error } = await supabase.storage.from("logos").upload(path, file, { upsert: true });
    if (error) { toast.error("Erreur upload logo"); setUploading(false); return; }
    const { data } = supabase.storage.from("logos").getPublicUrl(path);
    set("logo_url", data.publicUrl);
    setUploading(false);
    toast.success("Logo mis à jour");
  }

  function validate() {
    if (form.rib && !/^\d{24}$/.test(form.rib)) return "RIB : exactement 24 chiffres";
    return null;
  }

  async function save() {
    const err = validate();
    if (err) { toast.error(err); return; }
    setSaving(true);
    const { error } = await supabase.from("dossiers").update(form).eq("id", dossierId);
    setSaving(false);
    if (error) toast.error(translateError(error));
    else toast.success("Paramètres de facturation enregistrés");
  }

  const previewPrefix = form.invoice_prefix || "F-";
  const previewNumber = `${previewPrefix}${new Date().getFullYear()}-001`;

  return (
    <div className="flex flex-col gap-4">
      {/* Logo */}
      <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl p-5">
        <h3 className="text-[13px] font-semibold text-[#1A1A2E] mb-3">Logo de l&apos;entreprise</h3>
        <div className="flex items-center gap-5">
          <div
            onClick={() => logoRef.current?.click()}
            className="w-[100px] h-[100px] border-2 border-dashed border-[rgba(0,0,0,0.14)] rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-[#C8924A] transition-colors bg-[#FAFAF6] flex-shrink-0"
          >
            {form.logo_url ? (
              <img src={form.logo_url} alt="Logo" className="w-full h-full object-contain rounded-xl p-2" />
            ) : (
              <>
                <Upload size={20} className="text-[#9CA3AF] mb-1" />
                <span className="text-[10px] text-[#9CA3AF] text-center px-2">Cliquez pour télécharger</span>
              </>
            )}
          </div>
          <div>
            <p className="text-[12px] text-[#6B7280] mb-1">PNG, JPG, SVG — max 2MB</p>
            <p className="text-[11px] text-[#9CA3AF]">Utilisé sur vos factures</p>
            <button onClick={() => logoRef.current?.click()} disabled={uploading} className="btn btn-outline btn-sm mt-2">
              {uploading ? "Téléchargement..." : "Choisir un fichier"}
            </button>
          </div>
        </div>
        <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/svg+xml" className="hidden"
          onChange={e => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
      </div>

      {/* Address */}
      <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl p-5">
        <h3 className="text-[13px] font-semibold text-[#1A1A2E] mb-1">Adresse</h3>
        <p className="text-[11.5px] text-[#6B7280] mb-4">Affichée dans l&apos;en-tête de vos factures</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <label className="text-[11px] font-medium text-[#6B7280]">Adresse complète</label>
            <input className="input" value={form.address} onChange={e => set("address", e.target.value)} placeholder="Rue, N°, Quartier..." />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-[#6B7280]">Ville</label>
            <input className="input" value={form.city} onChange={e => set("city", e.target.value)} placeholder="Casablanca" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-[#6B7280]">Code postal</label>
            <input className="input" value={form.postal_code} onChange={e => set("postal_code", e.target.value)} placeholder="20000" />
          </div>
        </div>
        <p className="mt-3 text-[10.5px] text-[#9CA3AF]">
          ICE, IF, RC, CNSS et téléphone/email de contact viennent de l&apos;identité de votre dossier, gérée par votre comptable.
        </p>
      </div>

      {/* Invoice settings */}
      <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl p-5">
        <h3 className="text-[13px] font-semibold text-[#1A1A2E] mb-4">Paramètres des factures</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-[#6B7280]">Préfixe numérotation</label>
            <input className="input" value={form.invoice_prefix} onChange={e => set("invoice_prefix", e.target.value)} placeholder="F-" />
            <span className="text-[10.5px] text-[#9CA3AF]">Aperçu : {previewNumber}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-[#6B7280]">Délai de paiement par défaut</label>
            <select className="input" value={form.invoice_payment_delay} onChange={e => set("invoice_payment_delay", e.target.value)}>
              {DELAIS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <label className="text-[11px] font-medium text-[#6B7280]">Mentions légales personnalisées</label>
            <textarea className="input min-h-[80px] resize-y" value={form.invoice_mentions_legales} onChange={e => set("invoice_mentions_legales", e.target.value)} />
          </div>
        </div>
      </div>

      {/* Bank details */}
      <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl p-5">
        <h3 className="text-[13px] font-semibold text-[#1A1A2E] mb-1">Coordonnées bancaires</h3>
        <p className="text-[11.5px] text-[#6B7280] mb-4">Ces informations apparaîtront sur vos factures</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-[#6B7280]">Banque</label>
            <select className="input" value={form.bank_name} onChange={e => set("bank_name", e.target.value)}>
              <option value="">Sélectionner...</option>
              {BANQUES.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-[#6B7280]">RIB <span className="text-[10px] text-[#9CA3AF]">(24 chiffres)</span></label>
            <input className="input" value={form.rib} onChange={e => set("rib", e.target.value)} placeholder="000000000000000000000000" maxLength={24} />
          </div>
        </div>
      </div>

      {/* Color */}
      <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl p-5">
        <h3 className="text-[13px] font-semibold text-[#1A1A2E] mb-0.5">Couleur de vos factures</h3>
        <p className="text-[11.5px] text-[#9CA3AF] mb-4">Cette couleur sera utilisée sur vos factures</p>
        <div className="flex items-center gap-2 flex-wrap mb-3">
          {COLOR_PRESETS.map(p => (
            <button key={p.value} onClick={() => set("invoice_color", p.value)} title={p.label}
              className={`w-8 h-8 rounded-full border-2 transition-all ${form.invoice_color === p.value ? "border-[#1A1A2E] scale-110" : "border-transparent"}`}
              style={{ backgroundColor: p.value }} />
          ))}
          <div className="flex items-center gap-2 ml-2">
            <input type="color" value={form.invoice_color} onChange={e => set("invoice_color", e.target.value)}
              aria-label="Choisir une couleur personnalisée"
              className="w-8 h-8 shrink-0 cursor-pointer overflow-hidden rounded-full border-0 bg-transparent p-0 [&::-moz-color-swatch]:rounded-full [&::-moz-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0" />
            <input className="input w-[100px]" value={form.invoice_color} onChange={e => set("invoice_color", e.target.value)} placeholder="#C8924A" />
          </div>
        </div>
      </div>

      <button onClick={save} disabled={saving} className="btn btn-gold w-full justify-center py-2.5 disabled:opacity-60">
        {saving ? "Enregistrement..." : "Enregistrer les informations"}
      </button>
    </div>
  );
}
