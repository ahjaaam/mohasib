"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { Save, Loader2, ChevronLeft, Mail, Copy, Send } from "lucide-react";
import Link from "next/link";

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
  statut: string;
}

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

export default function EditDossierPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [inboxEmail, setInboxEmail] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>({
    raison_sociale: "", forme_juridique: "SARL", ice: "", if_fiscal: "", rc: "", cnss: "",
    regime_tva: "mensuel", taux_tva_defaut: "20", date_debut_exercice: "",
    capital_social: "0", contact_nom: "", contact_email: "", contact_phone: "",
    statut: "actif",
  });

  function set(key: keyof FormData, value: string) {
    setForm(f => ({ ...f, [key]: value }));
  }

  useEffect(() => {
    supabase.from("dossiers").select("*").eq("id", id).single().then(({ data }) => {
      if (data) {
        setInboxEmail(data.inbox_email ?? null);
        setForm({
          raison_sociale: data.raison_sociale ?? "",
          forme_juridique: data.forme_juridique ?? "SARL",
          ice: data.ice ?? "",
          if_fiscal: data.if_fiscal ?? "",
          rc: data.rc ?? "",
          cnss: data.cnss ?? "",
          regime_tva: data.regime_tva ?? "mensuel",
          taux_tva_defaut: String(data.taux_tva_defaut ?? "20"),
          date_debut_exercice: data.date_debut_exercice ?? "",
          capital_social: String(data.capital_social ?? "0"),
          contact_nom: data.contact_nom ?? "",
          contact_email: data.contact_email ?? "",
          contact_phone: data.contact_phone ?? "",
          statut: data.statut ?? "actif",
        });
      }
      setLoading(false);
    });
  }, [id]);

  async function handleSave() {
    if (!form.raison_sociale.trim()) { toast.error("La raison sociale est obligatoire"); return; }
    setSaving(true);
    const { error } = await supabase.from("dossiers").update({
      raison_sociale: form.raison_sociale.trim(),
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
      statut: form.statut,
    }).eq("id", id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Dossier mis à jour !");
    router.push("/comptable-pro");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 size={20} className="animate-spin text-[#C8924A]" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/comptable-pro" className="text-[#9CA3AF] hover:text-[#374151] transition-colors">
          <ChevronLeft size={18} />
        </Link>
        <div>
          <h1 className="text-[18px] font-bold text-[#1A1A2E] leading-tight">Modifier le dossier</h1>
          <p className="text-[12px] text-[#9CA3AF]">{form.raison_sociale}</p>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        {/* Informations légales */}
        <div className="card p-5">
          <h2 className="text-[13px] font-semibold text-[#1A1A2E] mb-4">Informations légales</h2>
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
        </div>

        {/* Informations fiscales */}
        <div className="card p-5">
          <h2 className="text-[13px] font-semibold text-[#1A1A2E] mb-4">Informations fiscales</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-[12px] font-medium text-[#374151] mb-1">Régime TVA</label>
              <div className="flex gap-2">
                {REGIMES.map(r => (
                  <button key={r.value} type="button" onClick={() => set("regime_tva", r.value)}
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
        </div>

        {/* Contact */}
        <div className="card p-5">
          <h2 className="text-[13px] font-semibold text-[#1A1A2E] mb-4">Contact client</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Field label="Nom du contact" value={form.contact_nom} onChange={v => set("contact_nom", v)} placeholder="M. Ahmed Alami" />
            </div>
            <Field label="Email" value={form.contact_email} onChange={v => set("contact_email", v)} type="email" placeholder="contact@atlas.ma" />
            <Field label="Téléphone" value={form.contact_phone} onChange={v => set("contact_phone", v)} placeholder="+212 6XX XXX XXX" />
          </div>
        </div>

        {/* Dedicated inbox email */}
        {inboxEmail && (
          <div className="card p-5 border-[#BAE6FD] bg-[#F0F9FF]">
            <div className="flex items-center gap-2 mb-3">
              <Mail size={15} className="text-[#0284C7]" />
              <h2 className="text-[13px] font-semibold text-[#0369A1]">Adresse dédiée de ce dossier</h2>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <code className="flex-1 text-[13px] font-mono bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-[#0369A1] select-all">
                {inboxEmail}
              </code>
              <button
                type="button"
                onClick={() => { navigator.clipboard.writeText(inboxEmail); }}
                className="btn btn-outline btn-sm flex items-center gap-1 border-[#BAE6FD] text-[#0284C7]"
                title="Copier"
              >
                <Copy size={12} /> Copier
              </button>
              <a
                href={`mailto:?subject=Adresse%20de%20r%C3%A9ception%20des%20factures&body=Veuillez%20envoyer%20vos%20factures%20%C3%A0%20${encodeURIComponent(inboxEmail)}`}
                className="btn btn-outline btn-sm flex items-center gap-1 border-[#BAE6FD] text-[#0284C7]"
                title="Envoyer par email"
              >
                <Send size={12} /> Envoyer
              </a>
            </div>
            <p className="text-[11.5px] text-[#0369A1]">
              Partagez cette adresse avec les fournisseurs de <strong>{form.raison_sociale}</strong> pour une réception automatique dans ce dossier.
            </p>
          </div>
        )}

        {/* Statut */}
        <div className="card p-5">
          <h2 className="text-[13px] font-semibold text-[#1A1A2E] mb-4">Statut du dossier</h2>
          <div className="flex gap-2">
            {["actif", "inactif"].map(s => (
              <button key={s} type="button" onClick={() => set("statut", s)}
                className={`px-4 py-2 rounded-lg text-[12.5px] font-medium border capitalize transition-all ${
                  form.statut === s
                    ? s === "actif" ? "bg-[#059669] text-white border-[#059669]" : "bg-[#DC2626] text-white border-[#DC2626]"
                    : "bg-white text-[#6B7280] border-[rgba(0,0,0,0.12)] hover:border-[#C8924A]"
                }`}>
                {s === "actif" ? "Actif" : "Inactif"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-5">
        <Link href="/comptable-pro" className="btn btn-outline flex items-center gap-1.5">
          <ChevronLeft size={14} /> Annuler
        </Link>
        <button onClick={handleSave} disabled={saving} className="btn btn-gold flex items-center gap-1.5">
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          {saving ? "Enregistrement..." : "Enregistrer les modifications"}
        </button>
      </div>
    </div>
  );
}
