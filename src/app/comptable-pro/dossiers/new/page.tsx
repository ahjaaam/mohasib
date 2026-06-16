"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { FolderPlus, ChevronRight, ChevronLeft } from "lucide-react";
import { translateError } from "@/lib/errors";

const FORMES = ["SARL", "SA", "SNC", "Auto-ent.", "GIE", "Association"];
const REGIMES = [
  { value: "mensuel", label: "Mensuel" },
  { value: "trimestriel", label: "Trimestriel" },
  { value: "exonere", label: "Exonéré" },
];

interface FormData {
  raison_sociale: string;
  forme_juridique: string;
  ice: string;
  if_fiscal: string;
  rc: string;
  cnss: string;
  regime_tva: string;
  taux_tva_defaut: string;
  date_debut_exercice: string;
  capital_social: string;
  contact_nom: string;
  contact_email: string;
  contact_phone: string;
  solde_banque_initial: string;
  solde_caisse_initial: string;
  creances_clients_initiales: string;
  dettes_fournisseurs_initiales: string;
}

const INITIAL: FormData = {
  raison_sociale: "", forme_juridique: "SARL", ice: "", if_fiscal: "", rc: "", cnss: "",
  regime_tva: "mensuel", taux_tva_defaut: "20",
  date_debut_exercice: `${new Date().getFullYear()}-01-01`,
  capital_social: "0",
  contact_nom: "", contact_email: "", contact_phone: "",
  solde_banque_initial: "0", solde_caisse_initial: "0",
  creances_clients_initiales: "0", dettes_fournisseurs_initiales: "0",
};

const SECTIONS = [
  { key: "legal", label: "Informations légales" },
  { key: "fiscal", label: "Informations fiscales" },
  { key: "contact", label: "Contact client" },
  { key: "soldes", label: "Soldes d'ouverture" },
];

function Field({ label, value, onChange, type = "text", placeholder, required }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-[12px] font-medium text-[#374151] mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        className="input"
        placeholder={placeholder}
        required={required}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}

export default function NewDossierPage() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(INITIAL);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  function set(key: keyof FormData, value: string) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function handleSubmit() {
    if (!form.raison_sociale.trim()) {
      toast.error("La raison sociale est obligatoire");
      setStep(0);
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    // Generate a stable short ID for the dedicated email before insert
    // We use a random 6-char hex; the real ID isn't known yet client-side
    const shortId = Math.random().toString(16).slice(2, 8);
    const { data, error } = await supabase.from("dossiers").insert({
      fiduciaire_user_id: user!.id,
      raison_sociale: form.raison_sociale.trim(),
      inbox_email: `factures-${shortId}@mohasibai.com`,
      forme_juridique: form.forme_juridique,
      ice: form.ice || null,
      if_fiscal: form.if_fiscal || null,
      rc: form.rc || null,
      cnss: form.cnss || null,
      regime_tva: form.regime_tva,
      taux_tva_defaut: parseFloat(form.taux_tva_defaut) || 20,
      date_debut_exercice: form.date_debut_exercice || null,
      capital_social: parseFloat(form.capital_social) || 0,
      contact_nom: form.contact_nom || null,
      contact_email: form.contact_email || null,
      contact_phone: form.contact_phone || null,
      solde_banque_initial: parseFloat(form.solde_banque_initial) || 0,
      solde_caisse_initial: parseFloat(form.solde_caisse_initial) || 0,
      creances_clients_initiales: parseFloat(form.creances_clients_initiales) || 0,
      dettes_fournisseurs_initiales: parseFloat(form.dettes_fournisseurs_initiales) || 0,
      statut: "actif",
    }).select().single();
    setSaving(false);
    if (error) { toast.error(translateError(error)); return; }
    toast.success("Dossier créé !");
    router.push(`/comptable-pro/dossiers/${data.id}`);
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-7">
        <div className="w-11 h-11 rounded-xl bg-[rgba(200,146,74,0.12)] flex items-center justify-center flex-shrink-0">
          <FolderPlus size={20} className="text-[#C8924A]" />
        </div>
        <div>
          <h1 className="text-[20px] font-bold text-[#1A1A2E] leading-tight">Nouveau dossier</h1>
          <p className="text-[12.5px] text-[#6B7280]">Créez un dossier pour un client</p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-0 mb-7">
        {SECTIONS.map((s, i) => (
          <div key={s.key} className="flex items-center flex-1">
            <button
              onClick={() => setStep(i)}
              className={`flex items-center gap-2 text-[12px] font-medium transition-colors ${
                i === step ? "text-[#C8924A]" : i < step ? "text-[#059669]" : "text-[#9CA3AF]"
              }`}
            >
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${
                i < step ? "bg-[#059669] text-white" : i === step ? "bg-[#C8924A] text-white" : "bg-[#F3F4F6] text-[#9CA3AF]"
              }`}>
                {i < step ? "✓" : i + 1}
              </span>
              <span className="hidden md:block">{s.label}</span>
            </button>
            {i < SECTIONS.length - 1 && (
              <div className="flex-1 h-px mx-2" style={{ backgroundColor: i < step ? "#059669" : "rgba(0,0,0,0.08)" }} />
            )}
          </div>
        ))}
      </div>

      {/* Form card */}
      <div className="card p-6 mb-5">
        <h2 className="text-[15px] font-semibold text-[#1A1A2E] mb-5">{SECTIONS[step].label}</h2>

        {step === 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Field label="Raison sociale" value={form.raison_sociale} onChange={v => set("raison_sociale", v)} placeholder="Atlas SARL" required />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[#374151] mb-1">Forme juridique</label>
              <select className="input" value={form.forme_juridique} onChange={e => set("forme_juridique", e.target.value)}>
                {FORMES.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <Field label="ICE (15 chiffres)" value={form.ice} onChange={v => set("ice", v)} placeholder="001234567890001" />
            <Field label="Identifiant Fiscal (IF)" value={form.if_fiscal} onChange={v => set("if_fiscal", v)} placeholder="12345678" />
            <Field label="Registre de Commerce (RC)" value={form.rc} onChange={v => set("rc", v)} placeholder="12345 Casablanca" />
            <div className="md:col-span-2">
              <Field label="Numéro CNSS" value={form.cnss} onChange={v => set("cnss", v)} placeholder="1234567" />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-[12px] font-medium text-[#374151] mb-1">Régime TVA</label>
              <div className="flex gap-2">
                {REGIMES.map(r => (
                  <button key={r.value} type="button"
                    onClick={() => set("regime_tva", r.value)}
                    className={`flex-1 py-2 rounded-lg text-[12.5px] font-medium border transition-all ${
                      form.regime_tva === r.value
                        ? "bg-[#0D1526] text-white border-[#0D1526]"
                        : "bg-white text-[#6B7280] border-[rgba(0,0,0,0.12)] hover:border-[#C8924A]"
                    }`}>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[#374151] mb-1">Taux TVA par défaut (%)</label>
              <select className="input" value={form.taux_tva_defaut} onChange={e => set("taux_tva_defaut", e.target.value)}>
                <option value="20">20%</option>
                <option value="14">14%</option>
                <option value="10">10%</option>
                <option value="7">7%</option>
                <option value="0">0%</option>
              </select>
            </div>
            <Field label="Date début d'exercice" value={form.date_debut_exercice} onChange={v => set("date_debut_exercice", v)} type="date" />
            <div>
              <label className="block text-[12px] font-medium text-[#374151] mb-1">Capital social (MAD)</label>
              <input type="number" className="input" value={form.capital_social} min={0}
                onChange={e => set("capital_social", e.target.value)} />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Field label="Nom du contact" value={form.contact_nom} onChange={v => set("contact_nom", v)} placeholder="M. Ahmed Alami" />
            </div>
            <Field label="Email (accès lecture)" value={form.contact_email} onChange={v => set("contact_email", v)} type="email" placeholder="contact@atlas.ma" />
            <Field label="Téléphone" value={form.contact_phone} onChange={v => set("contact_phone", v)} placeholder="+212 6XX XXX XXX" />
          </div>
        )}

        {step === 3 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <p className="md:col-span-2 text-[12px] text-[#6B7280] -mt-1 mb-1">
              Ces soldes seront les points de départ de la comptabilité.
            </p>
            <div>
              <label className="block text-[12px] font-medium text-[#374151] mb-1">Solde banque initial (MAD)</label>
              <input type="number" className="input" value={form.solde_banque_initial}
                onChange={e => set("solde_banque_initial", e.target.value)} />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[#374151] mb-1">Solde caisse initial (MAD)</label>
              <input type="number" className="input" value={form.solde_caisse_initial}
                onChange={e => set("solde_caisse_initial", e.target.value)} />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[#374151] mb-1">Créances clients initiales (MAD)</label>
              <input type="number" className="input" value={form.creances_clients_initiales}
                onChange={e => set("creances_clients_initiales", e.target.value)} />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[#374151] mb-1">Dettes fournisseurs initiales (MAD)</label>
              <input type="number" className="input" value={form.dettes_fournisseurs_initiales}
                onChange={e => set("dettes_fournisseurs_initiales", e.target.value)} />
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => step > 0 ? setStep(s => s - 1) : router.back()}
          className="btn btn-outline flex items-center gap-1.5"
        >
          <ChevronLeft size={14} /> {step === 0 ? "Annuler" : "Précédent"}
        </button>

        {step < SECTIONS.length - 1 ? (
          <button onClick={() => setStep(s => s + 1)} className="btn btn-gold flex items-center gap-1.5">
            Suivant <ChevronRight size={14} />
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={saving} className="btn btn-gold">
            {saving ? "Création..." : "Créer le dossier →"}
          </button>
        )}
      </div>
    </div>
  );
}
