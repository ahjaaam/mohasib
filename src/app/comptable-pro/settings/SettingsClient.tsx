"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { Building2, Plug2, Mail, Copy } from "lucide-react";
import type { Cabinet } from "@/types/fiduciaire";

interface Props {
  userId: string;
  profile: { full_name: string | null; company: string | null } | null;
  cabinet: Cabinet | null;
}

interface DossierWithEmail {
  id: string;
  raison_sociale: string;
  inbox_email: string | null;
}

export default function SettingsClient({ userId, profile, cabinet }: Props) {
  const [activeTab, setActiveTab] = useState<"cabinet" | "integrations">("cabinet");

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const tab = p.get("tab");
    if (tab === "integrations") setActiveTab("integrations");
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

  const [dossiersWithEmail, setDossiersWithEmail] = useState<DossierWithEmail[]>([]);
  const [loadingEmails, setLoadingEmails] = useState(false);

  const supabase = createClient();

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

  function set(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }));
  }

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

  const TABS = [
    { key: "cabinet",      label: "Informations", icon: Building2 },
    { key: "integrations", label: "Intégrations",  icon: Plug2 },
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

        </div>{/* end tab content */}
      </div>{/* end flex row */}
    </div>
  );
}
