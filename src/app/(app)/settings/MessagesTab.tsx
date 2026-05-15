"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";

const WA_DEFAULT = `Bonjour {{nom_client}},

Veuillez trouver ci-joint votre facture *{{numero_facture}}* d'un montant de *{{montant_ttc}} MAD*.

Télécharger la facture :
{{lien_facture}}
{{date_echeance}}
Merci pour votre confiance.
{{nom_entreprise}}
{{telephone}}`.trim();

const EMAIL_DEFAULT = `Bonjour {{nom_client}},

Veuillez trouver ci-joint votre facture {{numero_facture}} d'un montant de {{montant_ttc}}.
{{date_echeance}}
Pour toute question, n'hésitez pas à nous contacter.

Cordialement,
{{nom_entreprise}}`.trim();

const VARS = [
  { key: "{{nom_client}}",       desc: "Nom du client" },
  { key: "{{numero_facture}}",   desc: "Numéro de facture" },
  { key: "{{montant_ttc}}",      desc: "Montant TTC" },
  { key: "{{date_echeance}}",    desc: "Date d'échéance (vide si absente)" },
  { key: "{{lien_facture}}",     desc: "Lien PDF (WhatsApp uniquement)" },
  { key: "{{nom_entreprise}}",   desc: "Nom de votre entreprise" },
  { key: "{{telephone}}",        desc: "Votre téléphone" },
];

interface Props {
  userId: string;
  companyId: string | null;
  company: { whatsapp_template?: string | null; email_template?: string | null };
}

export default function MessagesTab({ userId, companyId, company }: Props) {
  const supabase = createClient();
  const [waTpl, setWaTpl] = useState(company.whatsapp_template ?? "");
  const [emailTpl, setEmailTpl] = useState(company.email_template ?? "");
  const [saving, setSaving] = useState(false);

  function insertVar(setter: React.Dispatch<React.SetStateAction<string>>, variable: string) {
    setter(prev => prev ? prev + variable : variable);
  }

  async function save() {
    if (!companyId) { toast.error("Aucune entreprise configurée"); return; }
    setSaving(true);
    const { error } = await supabase.from("companies").update({
      whatsapp_template: waTpl.trim() || null,
      email_template:    emailTpl.trim() || null,
    }).eq("id", companyId);
    setSaving(false);
    if (error) { toast.error("Erreur lors de la sauvegarde"); return; }
    toast.success("Modèles sauvegardés");
  }

  return (
    <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl p-6 space-y-8">
      <div>
        <h2 className="text-[14px] font-semibold text-[#1A1A2E] mb-1">Modèles de messages</h2>
        <p className="text-[12px] text-[#6B7280]">
          Personnalisez les messages envoyés avec vos factures. Laissez vide pour utiliser le message par défaut.
        </p>
      </div>

      {/* Variable chips */}
      <div className="p-3.5 bg-[#FAFAF6] border border-[rgba(0,0,0,0.07)] rounded-xl">
        <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide mb-2.5">Variables disponibles</p>
        <div className="flex flex-wrap gap-1.5">
          {VARS.map(v => (
            <span key={v.key}
              className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-[rgba(0,0,0,0.1)] rounded-lg text-[11.5px] font-mono text-[#C8924A]"
              title={v.desc}>
              {v.key}
              <span className="text-[10px] text-[#9CA3AF] font-sans">— {v.desc}</span>
            </span>
          ))}
        </div>
      </div>

      {/* WhatsApp template */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-[13px] font-semibold text-[#1A1A2E]">📲 Message WhatsApp</label>
          <button
            type="button"
            onClick={() => setWaTpl("")}
            className="text-[11px] text-[#9CA3AF] hover:text-[#6B7280] transition-colors">
            Réinitialiser
          </button>
        </div>
        <textarea
          value={waTpl}
          onChange={e => setWaTpl(e.target.value)}
          placeholder={WA_DEFAULT}
          rows={9}
          className="w-full px-3 py-2.5 border border-[rgba(0,0,0,0.12)] rounded-xl text-[12.5px] text-[#1A1A2E] font-mono resize-y focus:outline-none focus:border-[#C8924A] focus:ring-1 focus:ring-[#C8924A]/30 placeholder:text-[#D1D5DB] bg-[#FAFAF6]"
        />
        <p className="text-[11px] text-[#9CA3AF] mt-1.5">
          Ce texte sera pré-rempli dans WhatsApp. Les variables entre <span className="font-mono">{"{{"}…{"}}"}</span> seront remplacées automatiquement.
        </p>
      </div>

      {/* Email template */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-[13px] font-semibold text-[#1A1A2E]">📧 Corps de l'email</label>
          <button
            type="button"
            onClick={() => setEmailTpl("")}
            className="text-[11px] text-[#9CA3AF] hover:text-[#6B7280] transition-colors">
            Réinitialiser
          </button>
        </div>
        <textarea
          value={emailTpl}
          onChange={e => setEmailTpl(e.target.value)}
          placeholder={EMAIL_DEFAULT}
          rows={9}
          className="w-full px-3 py-2.5 border border-[rgba(0,0,0,0.12)] rounded-xl text-[12.5px] text-[#1A1A2E] font-mono resize-y focus:outline-none focus:border-[#C8924A] focus:ring-1 focus:ring-[#C8924A]/30 placeholder:text-[#D1D5DB] bg-[#FAFAF6]"
        />
        <p className="text-[11px] text-[#9CA3AF] mt-1.5">
          La facture PDF sera jointe automatiquement. La note de bas de page Mohasib est conservée.
        </p>
      </div>

      <div className="flex justify-end">
        <button onClick={save} disabled={saving} className="btn btn-gold">
          {saving ? "Sauvegarde…" : "Sauvegarder"}
        </button>
      </div>
    </div>
  );
}
