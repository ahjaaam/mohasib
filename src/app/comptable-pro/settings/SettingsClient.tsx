"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { Building2, Route, Plus, Trash2, ChevronDown, Plug2, Mail, Copy } from "lucide-react";
import type { Cabinet } from "@/types/fiduciaire";

interface Props {
  userId: string;
  profile: { full_name: string | null; company: string | null } | null;
  cabinet: Cabinet | null;
}

interface RoutingRule {
  id: string;
  dossier_id: string;
  rule_type: string;
  rule_value: string;
  is_active: boolean;
  dossier?: { raison_sociale: string };
}

interface Dossier {
  id: string;
  raison_sociale: string;
}

const RULE_TYPE_LABELS: Record<string, string> = {
  sender_email:    "Email exact",
  sender_domain:   "Domaine",
  subject_keyword: "Mot-clé dans l'objet",
};

const RULE_PLACEHOLDERS: Record<string, string> = {
  sender_email:    "supplier@orange.ma",
  sender_domain:   "@lydec.ma",
  subject_keyword: "Atlas SARL",
};

interface DossierWithEmail {
  id: string;
  raison_sociale: string;
  inbox_email: string | null;
}

export default function SettingsClient({ userId, profile, cabinet }: Props) {
  const [activeTab, setActiveTab] = useState<"cabinet" | "routing" | "integrations">("cabinet");

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const tab = p.get("tab");
    if (tab === "routing" || tab === "integrations") setActiveTab(tab);
    if (tab) window.history.replaceState({}, "", window.location.pathname);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [form, setForm] = useState({
    nom_cabinet: cabinet?.nom_cabinet ?? profile?.company ?? "",
    ice: cabinet?.ice ?? "",
    rc: cabinet?.rc ?? "",
    if_fiscal: cabinet?.if_fiscal ?? "",
    adresse: cabinet?.adresse ?? "",
    ville: cabinet?.ville ?? "",
    telephone: cabinet?.telephone ?? "",
    email: cabinet?.email ?? "",
  });
  const [saving, setSaving] = useState(false);

  // Dossiers with inbox email for integrations tab
  const [dossiersWithEmail, setDossiersWithEmail] = useState<DossierWithEmail[]>([]);
  const [loadingEmails, setLoadingEmails] = useState(false);

  useEffect(() => {
    if (activeTab !== "integrations") return;
    setLoadingEmails(true);
    supabase
      .from("dossiers")
      .select("id, raison_sociale, inbox_email")
      .eq("fiduciaire_user_id", userId)
      .eq("statut", "actif")
      .order("raison_sociale")
      .then(({ data }) => {
        setDossiersWithEmail((data ?? []) as DossierWithEmail[]);
        setLoadingEmails(false);
      });
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Routing rules state
  const [rules, setRules] = useState<RoutingRule[]>([]);
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [newRule, setNewRule] = useState({ rule_type: "sender_email", rule_value: "", dossier_id: "" });
  const [addingRule, setAddingRule] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const supabase = createClient();

  function set(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }));
  }

  // Load routing rules + dossiers when tab opens
  useEffect(() => {
    if (activeTab !== "routing") return;
    supabase
      .from("email_routing_rules")
      .select("*, dossier:dossier_id(raison_sociale)")
      .order("created_at")
      .then(({ data }) => setRules((data ?? []) as RoutingRule[]));
    supabase
      .from("dossiers")
      .select("id, raison_sociale")
      .eq("fiduciaire_user_id", userId)
      .eq("statut", "actif")
      .order("raison_sociale")
      .then(({ data }) => setDossiers((data ?? []) as Dossier[]));
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveCabinet(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      user_id: userId,
      nom_cabinet: form.nom_cabinet || null,
      ice: form.ice || null,
      rc: form.rc || null,
      if_fiscal: form.if_fiscal || null,
      adresse: form.adresse || null,
      ville: form.ville || null,
      telephone: form.telephone || null,
      email: form.email || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = cabinet?.id
      ? await supabase.from("cabinets").update(payload).eq("id", cabinet.id)
      : await supabase.from("cabinets").insert(payload);
    setSaving(false);
    if (error) { toast.error("Erreur lors de la sauvegarde"); return; }
    toast.success("Cabinet mis à jour");
  }

  function validateRuleValue(type: string, value: string): string | null {
    const v = value.trim();
    if (!v) return "La valeur ne peut pas être vide";
    if (type === "sender_email") {
      if (!v.includes("@") || !v.includes(".")) return "Format invalide — ex: supplier@orange.ma";
    } else if (type === "sender_domain") {
      const domain = v.startsWith("@") ? v.slice(1) : v;
      if (!domain.includes(".")) return "Format invalide — ex: @lydec.ma ou lydec.ma";
    }
    return null;
  }

  async function createRule() {
    if (!newRule.dossier_id) {
      toast.error("Sélectionnez un dossier");
      return;
    }
    const validationError = validateRuleValue(newRule.rule_type, newRule.rule_value);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setAddingRule(true);
    const { data, error } = await supabase
      .from("email_routing_rules")
      .insert({
        fiduciaire_user_id: userId,
        dossier_id: newRule.dossier_id,
        rule_type: newRule.rule_type,
        rule_value: newRule.rule_value.trim(),
        is_active: true,
      })
      .select("*, dossier:dossier_id(raison_sociale)")
      .single();
    setAddingRule(false);
    if (error) { toast.error(error.message); return; }
    setRules(r => [...r, data as RoutingRule]);
    setNewRule({ rule_type: "sender_email", rule_value: "", dossier_id: "" });
    setShowForm(false);
    const dossierName = dossiers.find(d => d.id === newRule.dossier_id)?.raison_sociale ?? "le dossier";
    toast.success(`Règle créée pour ${dossierName}.`);
  }

  async function deleteRule(id: string) {
    await supabase.from("email_routing_rules").delete().eq("id", id);
    setRules(r => r.filter(x => x.id !== id));
    toast.success("Règle supprimée");
  }

  const TABS = [
    { key: "cabinet",      label: "Informations",          icon: Building2 },
    { key: "integrations", label: "Intégrations",          icon: Plug2 },
    { key: "routing",      label: "Règles d'acheminement", icon: Route },
  ] as const;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(200,146,74,0.12)" }}>
          <Building2 size={18} className="text-[#C8924A]" />
        </div>
        <div>
          <h1 className="text-[18px] font-bold text-[#1A1A2E] leading-none">Mon cabinet</h1>
          <p className="text-[11px] text-[#9CA3AF] mt-0.5">Paramètres de votre cabinet comptable</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-start">

        {/* Left tab nav */}
        <div className="w-full md:w-[188px] flex-shrink-0">
          {/* Mobile: horizontal scroll */}
          <div className="md:hidden flex gap-1 overflow-x-auto pb-1">
            {TABS.map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] whitespace-nowrap transition-all flex-shrink-0 ${
                  activeTab === t.key
                    ? "bg-[#0D1526] text-white font-medium"
                    : "bg-white text-[#6B7280] border border-[rgba(0,0,0,0.08)] hover:text-[#1A1A2E]"
                }`}>
                <t.icon size={13} />
                {t.label}
              </button>
            ))}
          </div>
          {/* Desktop: vertical nav */}
          <div className="hidden md:flex flex-col bg-white border border-[rgba(0,0,0,0.08)] rounded-xl overflow-hidden">
            {TABS.map((t, i) => (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                className={`flex items-center gap-2.5 px-4 py-3 text-[12.5px] text-left transition-all border-l-2 ${
                  i < TABS.length - 1 ? "border-b border-[rgba(0,0,0,0.06)]" : ""
                } ${
                  activeTab === t.key
                    ? "border-l-[#C8924A] bg-[rgba(200,146,74,0.06)] text-[#1A1A2E] font-medium"
                    : "border-l-transparent text-[#6B7280] hover:text-[#1A1A2E] hover:bg-[#FAFAF6]"
                }`}>
                <t.icon size={14} className={activeTab === t.key ? "text-[#C8924A]" : ""} />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 min-w-0">

      {/* ── Cabinet info tab ── */}
      {activeTab === "cabinet" && (
        <>
          <form onSubmit={saveCabinet} className="space-y-5">
            <div className="card p-5">
              <h2 className="text-[13.5px] font-semibold text-[#1A1A2E] mb-4">Informations légales</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-[12px] font-medium text-[#374151] mb-1">Nom du cabinet *</label>
                  <input className="input" value={form.nom_cabinet}
                    onChange={e => set("nom_cabinet", e.target.value)} placeholder="Cabinet Dupont & Associés" required />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#374151] mb-1">ICE</label>
                  <input className="input" value={form.ice}
                    onChange={e => set("ice", e.target.value)} placeholder="001234567890001" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#374151] mb-1">Registre de Commerce</label>
                  <input className="input" value={form.rc}
                    onChange={e => set("rc", e.target.value)} placeholder="12345 Casablanca" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#374151] mb-1">Identifiant Fiscal</label>
                  <input className="input" value={form.if_fiscal}
                    onChange={e => set("if_fiscal", e.target.value)} placeholder="12345678" />
                </div>
              </div>
            </div>

            <div className="card p-5">
              <h2 className="text-[13.5px] font-semibold text-[#1A1A2E] mb-4">Contact & adresse</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-[12px] font-medium text-[#374151] mb-1">Adresse</label>
                  <input className="input" value={form.adresse}
                    onChange={e => set("adresse", e.target.value)} placeholder="123 Boulevard Mohammed V" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#374151] mb-1">Ville</label>
                  <input className="input" value={form.ville}
                    onChange={e => set("ville", e.target.value)} placeholder="Casablanca" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#374151] mb-1">Téléphone</label>
                  <input className="input" value={form.telephone}
                    onChange={e => set("telephone", e.target.value)} placeholder="+212 522 XXX XXX" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[12px] font-medium text-[#374151] mb-1">Email</label>
                  <input type="email" className="input" value={form.email}
                    onChange={e => set("email", e.target.value)} placeholder="contact@cabinet.ma" />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button type="submit" disabled={saving} className="btn btn-gold">
                {saving ? "Sauvegarde..." : "Enregistrer les modifications"}
              </button>
            </div>
          </form>

          <div className="mt-6 card p-4 border-[rgba(220,38,38,0.15)] bg-[#FFF5F5]">
            <h2 className="text-[13px] font-semibold text-[#DC2626] mb-2">Zone dangereuse</h2>
            <p className="text-[12px] text-[#6B7280] mb-3">
              Retourner en mode entrepreneur convertira votre compte et vos dossiers seront archivés.
            </p>
            <button className="btn btn-sm text-[#DC2626] border border-[#FECACA] bg-white hover:bg-[#FEE2E2]">
              Passer en mode entrepreneur
            </button>
          </div>
        </>
      )}

      {/* ── Integrations tab ── */}
      {activeTab === "integrations" && (
        <div className="space-y-4">

          <div className="card p-4 bg-[#F0F9FF] border-[#BAE6FD]">
            <div className="flex items-start gap-2.5">
              <Mail size={15} className="text-[#0369A1] mt-0.5 flex-shrink-0" />
              <p className="text-[12px] text-[#0369A1]">
                <strong>Adresses email dédiées :</strong> Chaque dossier client dispose d&apos;une adresse email unique.
                Vos fournisseurs peuvent envoyer leurs factures directement à cette adresse — elles seront importées
                et traitées automatiquement par l&apos;IA.
              </p>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-[rgba(0,0,0,0.06)]">
              <div className="text-[13.5px] font-semibold text-[#1A1A2E]">Adresses des dossiers</div>
              <div className="text-[11.5px] text-[#6B7280]">Copiez l&apos;adresse et communiquez-la aux fournisseurs du dossier</div>
            </div>

            {loadingEmails ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-10 rounded-lg bg-[#F3F4F6] animate-pulse" />
                ))}
              </div>
            ) : dossiersWithEmail.length === 0 ? (
              <div className="py-10 text-center text-[12.5px] text-[#9CA3AF]">
                Aucun dossier actif
              </div>
            ) : (
              <div className="divide-y divide-[rgba(0,0,0,0.05)]">
                {dossiersWithEmail.map(d => (
                  <div key={d.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-[12.5px] font-medium text-[#1A1A2E] truncate">{d.raison_sociale}</div>
                      {d.inbox_email ? (
                        <div className="text-[11.5px] font-mono text-[#6B7280] truncate">{d.inbox_email}</div>
                      ) : (
                        <div className="text-[11.5px] text-[#9CA3AF] italic">Adresse non générée</div>
                      )}
                    </div>
                    {d.inbox_email && (
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(d.inbox_email!);
                          toast.success("Adresse copiée !");
                        }}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11.5px] rounded-lg border border-[rgba(0,0,0,0.1)] text-[#6B7280] hover:text-[#1A1A2E] hover:bg-[#F9F9F6] transition-colors flex-shrink-0"
                      >
                        <Copy size={11} /> Copier
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Routing rules tab ── */}
      {activeTab === "routing" && (
        <div className="space-y-4">
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(0,0,0,0.06)]">
              <div>
                <div className="text-[13.5px] font-semibold text-[#1A1A2E]">Règles d'acheminement</div>
                <div className="text-[11.5px] text-[#6B7280]">Les emails entrants sont routés automatiquement selon ces règles</div>
              </div>
              <button onClick={() => setShowForm(v => !v)} className="btn btn-gold btn-sm flex items-center gap-1">
                <Plus size={13} /> Nouvelle règle
              </button>
            </div>

            {/* New rule form */}
            {showForm && (
              <div className="p-4 bg-[#FAFAF6] border-b border-[rgba(0,0,0,0.06)]">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                  <div>
                    <label className="block text-[11.5px] font-medium text-[#374151] mb-1">Type</label>
                    <div className="relative">
                      <select
                        className="input pr-7 appearance-none text-[12.5px]"
                        value={newRule.rule_type}
                        onChange={e => setNewRule(r => ({ ...r, rule_type: e.target.value, rule_value: "" }))}
                      >
                        {Object.entries(RULE_TYPE_LABELS).map(([v, l]) => (
                          <option key={v} value={v}>{l}</option>
                        ))}
                      </select>
                      <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#6B7280] pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11.5px] font-medium text-[#374151] mb-1">Valeur</label>
                    <input
                      className="input text-[12.5px]"
                      value={newRule.rule_value}
                      onChange={e => setNewRule(r => ({ ...r, rule_value: e.target.value }))}
                      placeholder={RULE_PLACEHOLDERS[newRule.rule_type]}
                    />
                  </div>
                  <div>
                    <label className="block text-[11.5px] font-medium text-[#374151] mb-1">Dossier</label>
                    <div className="relative">
                      <select
                        className="input pr-7 appearance-none text-[12.5px]"
                        value={newRule.dossier_id}
                        onChange={e => setNewRule(r => ({ ...r, dossier_id: e.target.value }))}
                      >
                        <option value="">Choisir…</option>
                        {dossiers.map(d => <option key={d.id} value={d.id}>{d.raison_sociale}</option>)}
                      </select>
                      <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#6B7280] pointer-events-none" />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowForm(false)} className="btn btn-outline btn-sm">Annuler</button>
                  <button onClick={createRule} disabled={addingRule} className="btn btn-gold btn-sm">
                    {addingRule ? "…" : "Créer"}
                  </button>
                </div>
              </div>
            )}

            {/* Rules table */}
            {rules.length === 0 && !showForm ? (
              <div className="py-10 text-center text-[12.5px] text-[#9CA3AF]">
                Aucune règle — les emails sont routés par IA
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>De (expéditeur)</th>
                    <th>Dossier</th>
                    <th>Type</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map(rule => (
                    <tr key={rule.id}>
                      <td className="font-mono text-[12px]">{rule.rule_value}</td>
                      <td className="text-[12.5px]">{rule.dossier?.raison_sociale ?? "—"}</td>
                      <td>
                        <span className="tag tag-gray">{RULE_TYPE_LABELS[rule.rule_type] ?? rule.rule_type}</span>
                      </td>
                      <td className="text-right">
                        <button
                          onClick={() => deleteRule(rule.id)}
                          className="btn btn-outline btn-sm text-[#DC2626] hover:bg-[#FEE2E2]"
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card p-4 bg-[#F0F9FF] border-[#BAE6FD]">
            <p className="text-[12px] text-[#0369A1]">
              <strong>Comment ça marche :</strong> Chaque règle cible un dossier précis. Lorsqu&apos;un email arrive sur l&apos;adresse dédiée du dossier, Mohasib applique ces règles pour l&apos;acheminer automatiquement. Les pièces jointes PDF/image sont importées et l&apos;IA extrait les données (montant, TVA, fournisseur).
            </p>
          </div>
        </div>
      )}

        </div>{/* end tab content */}
      </div>{/* end flex row */}
    </div>
  );
}
