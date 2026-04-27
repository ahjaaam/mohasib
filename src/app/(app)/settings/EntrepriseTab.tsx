"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { translateError } from "@/lib/errors";
import { Upload } from "lucide-react";

interface Props {
  userId: string;
  company: any;
}

const FORMES = ["SARL", "SA", "SNC", "Auto-entrepreneur", "Personne physique", "Association", "Autre"];
const BANQUES = ["Attijariwafa", "CIH", "BMCE", "BCP", "Société Générale", "BMCI", "CDG", "Al Barid Bank", "Autre"];
const TVA_TAUX = [7, 10, 14, 20];
const TVA_REGIME = ["Mensuel", "Trimestriel", "Annuel"];
const DELAIS = ["Immédiat", "15 jours", "30 jours", "45 jours", "60 jours"];

export default function EntrepriseTab({ userId, company }: Props) {
  const supabase = createClient();
  const logoRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState({
    raison_sociale: company.raison_sociale ?? "",
    forme_juridique: company.forme_juridique ?? "",
    ice: company.ice ?? "",
    if_number: company.if_number ?? "",
    rc: company.rc ?? "",
    cnss: company.cnss ?? "",
    patente: company.patente ?? "",
    capital_social: company.capital_social ?? "",
    address: company.address ?? "",
    city: company.city ?? "",
    postal_code: company.postal_code ?? "",
    country: company.country ?? "Maroc",
    phone: company.phone ?? "",
    email: company.email ?? "",
    website: company.website ?? "",
    whatsapp: company.whatsapp ?? "",
    tva_assujetti: company.tva_assujetti ?? true,
    tva_taux_defaut: company.tva_taux_defaut ?? 20,
    tva_regime: company.tva_regime ?? "Mensuel",
    invoice_prefix: company.invoice_prefix ?? "F-",
    invoice_payment_delay: company.invoice_payment_delay ?? "30 jours",
    invoice_mentions_legales: company.invoice_mentions_legales ?? "Paiement à 30 jours. Tout retard de paiement entraînera des pénalités conformément à la loi marocaine.",
    bank_name: company.bank_name ?? "",
    rib: company.rib ?? "",
    iban: company.iban ?? "",
    logo_url: company.logo_url ?? "",
  });

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  async function uploadLogo(file: File) {
    if (file.size > 2 * 1024 * 1024) { toast.error("Logo trop lourd (max 2MB)"); return; }
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${userId}/logo.${ext}`;
    const { error } = await supabase.storage.from("logos").upload(path, file, { upsert: true });
    if (error) { toast.error("Erreur upload logo"); setUploading(false); return; }
    const { data } = supabase.storage.from("logos").getPublicUrl(path);
    set("logo_url", data.publicUrl);
    setUploading(false);
    toast.success("Logo mis à jour");
  }

  function validate() {
    if (!form.raison_sociale.trim()) return "Raison sociale requise";
    if (form.ice && !/^\d{15}$/.test(form.ice)) return "ICE : exactement 15 chiffres";
    if (form.rib && !/^\d{24}$/.test(form.rib)) return "RIB : exactement 24 chiffres";
    return null;
  }

  async function save() {
    const err = validate();
    if (err) { toast.error(err); return; }
    setSaving(true);
    const { error } = await supabase.from("companies").upsert({
      user_id: userId,
      ...form,
      capital_social: form.capital_social ? Number(form.capital_social) : null,
      tva_taux_defaut: Number(form.tva_taux_defaut),
    }, { onConflict: "user_id" });
    setSaving(false);
    if (error) toast.error(translateError(error));
    else toast.success("✓ Informations enregistrées");
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
            <p className="text-[11px] text-[#9CA3AF]">Utilisé sur les factures et exports</p>
            <button
              onClick={() => logoRef.current?.click()}
              disabled={uploading}
              className="btn btn-outline btn-sm mt-2"
            >
              {uploading ? "Téléchargement..." : "Choisir un fichier"}
            </button>
          </div>
        </div>
        <input
          ref={logoRef}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml"
          className="hidden"
          onChange={e => e.target.files?.[0] && uploadLogo(e.target.files[0])}
        />
      </div>

      {/* Company Info */}
      <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl p-5">
        <h3 className="text-[13px] font-semibold text-[#1A1A2E] mb-4">Informations de l&apos;entreprise</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-[#6B7280]">Raison sociale *</label>
            <input className="input" value={form.raison_sociale} onChange={e => set("raison_sociale", e.target.value)} placeholder="Ex: ACME SARL" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-[#6B7280]">Forme juridique</label>
            <select className="input" value={form.forme_juridique} onChange={e => set("forme_juridique", e.target.value)}>
              <option value="">Sélectionner...</option>
              {FORMES.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-[#6B7280]">ICE <span className="text-[10px] text-[#9CA3AF]">(15 chiffres)</span></label>
            <input className="input" value={form.ice} onChange={e => set("ice", e.target.value)} placeholder="000000000000000" maxLength={15} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-[#6B7280]">IF (Identifiant Fiscal)</label>
            <input className="input" value={form.if_number} onChange={e => set("if_number", e.target.value)} placeholder="Identifiant fiscal" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-[#6B7280]">RC (Registre de Commerce)</label>
            <input className="input" value={form.rc} onChange={e => set("rc", e.target.value)} placeholder="Numéro RC" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-[#6B7280]">CNSS</label>
            <input className="input" value={form.cnss} onChange={e => set("cnss", e.target.value)} placeholder="Numéro CNSS" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-[#6B7280]">Numéro de patente</label>
            <input className="input" value={form.patente} onChange={e => set("patente", e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-[#6B7280]">Capital social (MAD)</label>
            <input type="number" className="input" value={form.capital_social} onChange={e => set("capital_social", e.target.value)} placeholder="100000" />
          </div>
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <label className="text-[11px] font-medium text-[#6B7280]">Adresse complète *</label>
            <input className="input" value={form.address} onChange={e => set("address", e.target.value)} placeholder="Rue, N°, Quartier..." />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-[#6B7280]">Ville *</label>
            <input className="input" value={form.city} onChange={e => set("city", e.target.value)} placeholder="Casablanca" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-[#6B7280]">Code postal</label>
            <input className="input" value={form.postal_code} onChange={e => set("postal_code", e.target.value)} placeholder="20000" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-[#6B7280]">Pays</label>
            <input className="input" value={form.country} onChange={e => set("country", e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-[#6B7280]">Téléphone professionnel</label>
            <input className="input" value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="+212 6XX XXX XXX" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-[#6B7280]">Email professionnel</label>
            <input type="email" className="input" value={form.email} onChange={e => set("email", e.target.value)} placeholder="contact@entreprise.ma" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-[#6B7280]">Site web</label>
            <input className="input" value={form.website} onChange={e => set("website", e.target.value)} placeholder="https://entreprise.ma" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-[#6B7280]">WhatsApp</label>
            <input className="input" value={form.whatsapp} onChange={e => set("whatsapp", e.target.value)} placeholder="+212 6XX XXX XXX" />
          </div>
        </div>
      </div>

      {/* TVA */}
      <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl p-5">
        <h3 className="text-[13px] font-semibold text-[#1A1A2E] mb-4">Paramètres TVA</h3>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between py-1">
            <div>
              <div className="text-[12.5px] font-medium text-[#1A1A2E]">Assujetti à la TVA</div>
              <div className="text-[11px] text-[#6B7280]">Activer la TVA sur vos factures</div>
            </div>
            <button
              onClick={() => set("tva_assujetti", !form.tva_assujetti)}
              className={`w-10 h-5 rounded-full transition-colors relative flex-shrink-0 ${form.tva_assujetti ? "bg-[#C8924A]" : "bg-[#D1D5DB]"}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.tva_assujetti ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>
          {form.tva_assujetti && (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-medium text-[#6B7280]">Taux TVA par défaut</label>
                <select className="input" value={form.tva_taux_defaut} onChange={e => set("tva_taux_defaut", e.target.value)}>
                  {TVA_TAUX.map(t => <option key={t} value={t}>{t}%</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-medium text-[#6B7280]">Régime TVA</label>
                <select className="input" value={form.tva_regime} onChange={e => set("tva_regime", e.target.value)}>
                  {TVA_REGIME.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Invoice Settings */}
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
            <textarea
              className="input min-h-[80px] resize-y"
              value={form.invoice_mentions_legales}
              onChange={e => set("invoice_mentions_legales", e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Bank Details */}
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
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <label className="text-[11px] font-medium text-[#6B7280]">IBAN (si disponible)</label>
            <input className="input" value={form.iban} onChange={e => set("iban", e.target.value)} placeholder="MA..." />
          </div>
        </div>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="btn btn-gold w-full justify-center py-2.5 disabled:opacity-60"
      >
        {saving ? "Enregistrement..." : "Enregistrer les informations"}
      </button>
    </div>
  );
}
