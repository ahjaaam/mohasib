"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { calculateSalary, formatMAD } from "@/lib/payroll";
import {
  Users, FileText, BarChart2, Plus, Download, RefreshCw,
  X, Check, Pencil, Trash2, AlertCircle,
} from "lucide-react";
import toast from "react-hot-toast";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Employee {
  id: string;
  nom: string;
  prenom: string;
  cin?: string;
  matricule?: string;
  poste?: string;
  departement?: string;
  type_contrat?: string;
  salaire_brut: number;
  situation_familiale?: string;
  nombre_enfants?: number;
  date_embauche: string;
  banque?: string;
  rib?: string;
  numero_cnss?: string;
  has_mutuelle?: boolean;
  mutuelle_taux_salarie?: number;
  mutuelle_taux_patronal?: number;
  has_cimr?: boolean;
  cimr_taux_salarie?: number;
  cimr_taux_patronal?: number;
  statut: string;
}

interface Bulletin {
  id: string;
  employee_id: string;
  mois: number;
  annee: number;
  period_label?: string;
  salaire_brut: number;
  cnss_salarie: number;
  amo_salarie: number;
  frais_pro: number;
  salaire_net_imposable: number;
  ir_net: number;
  salaire_net_payer: number;
  cnss_patronal: number;
  amo_patronal: number;
  taxe_formation_pro: number;
  cout_total_employeur: number;
  statut: string;
  employees?: { nom: string; prenom: string; poste?: string };
}

const MONTHS = [
  "Janvier","Février","Mars","Avril","Mai","Juin",
  "Juillet","Août","Septembre","Octobre","Novembre","Décembre",
];

const SITUATIONS = ["Célibataire","Marié(e)","Divorcé(e)","Veuf/Veuve"];
const CONTRATS = ["CDI","CDD","Anapec","Intérim"];

const EMPTY_EMP = {
  nom: "", prenom: "", cin: "", matricule: "", poste: "", departement: "",
  type_contrat: "CDI", salaire_brut: "", situation_familiale: "Célibataire",
  nombre_enfants: "0", date_embauche: "", banque: "", rib: "", numero_cnss: "",
  has_mutuelle: false, mutuelle_taux_salarie: "2.59", mutuelle_taux_patronal: "2.59",
  has_cimr: false, cimr_taux_salarie: "3.00", cimr_taux_patronal: "3.90",
};

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PaiePage() {
  const [tab, setTab] = useState<"employes"|"bulletins"|"declarations">("employes");
  const supabase = createClient();

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-white rounded-xl border border-[rgba(0,0,0,0.08)] w-fit">
        {([
          { key: "employes",     icon: Users,      label: "Employés" },
          { key: "bulletins",    icon: FileText,   label: "Bulletins de paie" },
          { key: "declarations", icon: BarChart2,  label: "Déclarations sociales" },
        ] as const).map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium transition-all ${
              tab === key
                ? "bg-[#C8924A] text-white shadow-sm"
                : "text-[#6B7280] hover:text-[#1A1A2E] hover:bg-[#F9FAFB]"
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {tab === "employes"     && <EmployesTab supabase={supabase} />}
      {tab === "bulletins"    && <BulletinsTab supabase={supabase} />}
      {tab === "declarations" && <DeclarationsTab supabase={supabase} />}
    </div>
  );
}

// ── Employés tab ──────────────────────────────────────────────────────────────

function EmployesTab({ supabase }: { supabase: ReturnType<typeof createClient> }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState<typeof EMPTY_EMP>({ ...EMPTY_EMP });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("employees")
      .select("*")
      .order("nom");
    setEmployees(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY_EMP });
    setShowModal(true);
  }

  function openEdit(emp: Employee) {
    setEditing(emp);
    setForm({
      nom: emp.nom,
      prenom: emp.prenom,
      cin: emp.cin ?? "",
      matricule: emp.matricule ?? "",
      poste: emp.poste ?? "",
      departement: emp.departement ?? "",
      type_contrat: emp.type_contrat ?? "CDI",
      salaire_brut: String(emp.salaire_brut),
      situation_familiale: emp.situation_familiale ?? "Célibataire",
      nombre_enfants: String(emp.nombre_enfants ?? 0),
      date_embauche: emp.date_embauche,
      banque: emp.banque ?? "",
      rib: emp.rib ?? "",
      numero_cnss: emp.numero_cnss ?? "",
      has_mutuelle: emp.has_mutuelle ?? false,
      mutuelle_taux_salarie: String(emp.mutuelle_taux_salarie ?? 2.59),
      mutuelle_taux_patronal: String(emp.mutuelle_taux_patronal ?? 2.59),
      has_cimr: emp.has_cimr ?? false,
      cimr_taux_salarie: String(emp.cimr_taux_salarie ?? 3.00),
      cimr_taux_patronal: String(emp.cimr_taux_patronal ?? 3.90),
    });
    setShowModal(true);
  }

  async function save() {
    if (!form.nom || !form.prenom || !form.date_embauche || !form.salaire_brut) {
      toast.error("Veuillez remplir les champs obligatoires");
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      user_id: user!.id,
      nom: form.nom,
      prenom: form.prenom,
      cin: form.cin || null,
      matricule: form.matricule || null,
      poste: form.poste || null,
      departement: form.departement || null,
      type_contrat: form.type_contrat,
      salaire_brut: Number(form.salaire_brut),
      situation_familiale: form.situation_familiale,
      nombre_enfants: Number(form.nombre_enfants),
      date_embauche: form.date_embauche,
      banque: form.banque || null,
      rib: form.rib || null,
      numero_cnss: form.numero_cnss || null,
      has_mutuelle: form.has_mutuelle,
      mutuelle_taux_salarie: Number(form.mutuelle_taux_salarie),
      mutuelle_taux_patronal: Number(form.mutuelle_taux_patronal),
      has_cimr: form.has_cimr,
      cimr_taux_salarie: Number(form.cimr_taux_salarie),
      cimr_taux_patronal: Number(form.cimr_taux_patronal),
    };

    let err: any;
    if (editing) {
      ({ error: err } = await supabase.from("employees").update(payload).eq("id", editing.id));
    } else {
      ({ error: err } = await supabase.from("employees").insert({ ...payload, statut: "actif" }));
    }

    if (err) { toast.error(err.message); return; }
    toast.success(editing ? "Employé modifié" : "Employé ajouté");
    setShowModal(false);
    load();
  }

  async function deactivate(emp: Employee) {
    const next = emp.statut === "actif" ? "inactif" : "actif";
    const { error } = await supabase.from("employees").update({ statut: next }).eq("id", emp.id);
    if (error) { toast.error(error.message); return; }
    toast.success(next === "actif" ? "Employé réactivé" : "Employé désactivé");
    load();
  }

  const preview = form.salaire_brut
    ? calculateSalary({
        salaire_brut: Number(form.salaire_brut),
        situation_familiale: form.situation_familiale,
        nombre_enfants: Number(form.nombre_enfants),
        date_embauche: form.date_embauche || undefined,
        has_mutuelle: form.has_mutuelle,
        mutuelle_taux_salarie: Number(form.mutuelle_taux_salarie),
        mutuelle_taux_patronal: Number(form.mutuelle_taux_patronal),
        has_cimr: form.has_cimr,
        cimr_taux_salarie: Number(form.cimr_taux_salarie),
        cimr_taux_patronal: Number(form.cimr_taux_patronal),
      })
    : null;

  const actifs   = employees.filter(e => e.statut === "actif");
  const inactifs = employees.filter(e => e.statut !== "actif");

  return (
    <>
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[13px] text-[#6B7280]">
            {actifs.length} employé{actifs.length !== 1 ? "s" : ""} actif{actifs.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button className="btn btn-gold" onClick={openAdd}>
          <Plus size={13} /> Ajouter un employé
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-[#6B7280] text-[13px]">Chargement…</div>
      ) : employees.length === 0 ? (
        <div className="text-center py-16">
          <Users size={40} className="mx-auto mb-3 text-[#D1D5DB]" />
          <p className="text-[14px] font-medium text-[#374151]">Aucun employé</p>
          <p className="text-[13px] text-[#6B7280] mt-1">Commencez par ajouter vos employés</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[rgba(0,0,0,0.08)] overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[rgba(0,0,0,0.06)]">
                {["Employé","Poste","Contrat","Salaire brut","Situation","Statut",""].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...actifs, ...inactifs].map(emp => (
                <tr key={emp.id} className="border-b border-[rgba(0,0,0,0.04)] hover:bg-[#FAFAF6] transition-colors last:border-0">
                  <td className="px-4 py-3 font-medium text-[#1A1A2E]">{emp.prenom} {emp.nom}</td>
                  <td className="px-4 py-3 text-[#6B7280]">{emp.poste ?? "—"}</td>
                  <td className="px-4 py-3 text-[#6B7280]">{emp.type_contrat ?? "CDI"}</td>
                  <td className="px-4 py-3 font-medium text-[#1A1A2E]">{formatMAD(emp.salaire_brut)}</td>
                  <td className="px-4 py-3 text-[#6B7280]">
                    {emp.situation_familiale ?? "Célibataire"}
                    {(emp.nombre_enfants ?? 0) > 0 && ` — ${emp.nombre_enfants} enf.`}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                      emp.statut === "actif"
                        ? "bg-[#D1FAE5] text-[#065F46]"
                        : "bg-[#F3F4F6] text-[#6B7280]"
                    }`}>
                      {emp.statut === "actif" ? "Actif" : "Inactif"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => openEdit(emp)} className="text-[#6B7280] hover:text-[#1A1A2E] transition-colors">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => deactivate(emp)} className={`transition-colors text-[11px] ${
                        emp.statut === "actif"
                          ? "text-[#EF4444] hover:text-[#DC2626]"
                          : "text-[#10B981] hover:text-[#059669]"
                      }`}>
                        {emp.statut === "actif" ? <Trash2 size={13} /> : <Check size={13} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(0,0,0,0.08)]">
              <h2 className="text-[15px] font-semibold text-[#1A1A2E]">
                {editing ? "Modifier l'employé" : "Ajouter un employé"}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-[#6B7280] hover:text-[#1A1A2E]">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Identity */}
              <section>
                <h3 className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide mb-3">Identité</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[12px] text-[#374151] mb-1">Prénom *</label>
                    <input className="input w-full" value={form.prenom} onChange={e => setForm(f => ({...f, prenom: e.target.value}))} />
                  </div>
                  <div>
                    <label className="block text-[12px] text-[#374151] mb-1">Nom *</label>
                    <input className="input w-full" value={form.nom} onChange={e => setForm(f => ({...f, nom: e.target.value}))} />
                  </div>
                  <div>
                    <label className="block text-[12px] text-[#374151] mb-1">CIN</label>
                    <input className="input w-full" value={form.cin} onChange={e => setForm(f => ({...f, cin: e.target.value}))} placeholder="AB123456" />
                  </div>
                  <div>
                    <label className="block text-[12px] text-[#374151] mb-1">N° CNSS</label>
                    <input className="input w-full" value={form.numero_cnss} onChange={e => setForm(f => ({...f, numero_cnss: e.target.value}))} />
                  </div>
                  <div>
                    <label className="block text-[12px] text-[#374151] mb-1">N° Matricule interne</label>
                    <input className="input w-full" value={form.matricule} onChange={e => setForm(f => ({...f, matricule: e.target.value}))} placeholder="Ex: EMP-001" />
                  </div>
                </div>
              </section>

              {/* Contract */}
              <section>
                <h3 className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide mb-3">Contrat</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[12px] text-[#374151] mb-1">Poste</label>
                    <input className="input w-full" value={form.poste} onChange={e => setForm(f => ({...f, poste: e.target.value}))} placeholder="Ex: Développeur" />
                  </div>
                  <div>
                    <label className="block text-[12px] text-[#374151] mb-1">Département</label>
                    <input className="input w-full" value={form.departement} onChange={e => setForm(f => ({...f, departement: e.target.value}))} />
                  </div>
                  <div>
                    <label className="block text-[12px] text-[#374151] mb-1">Type de contrat</label>
                    <select className="input w-full" value={form.type_contrat} onChange={e => setForm(f => ({...f, type_contrat: e.target.value}))}>
                      {CONTRATS.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[12px] text-[#374151] mb-1">Date d'embauche *</label>
                    <input type="date" className="input w-full" value={form.date_embauche} onChange={e => setForm(f => ({...f, date_embauche: e.target.value}))} />
                  </div>
                </div>
              </section>

              {/* Salary */}
              <section>
                <h3 className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide mb-3">Rémunération & Situation fiscale</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[12px] text-[#374151] mb-1">Salaire brut (MAD) *</label>
                    <input type="number" className="input w-full" value={form.salaire_brut}
                      onChange={e => setForm(f => ({...f, salaire_brut: e.target.value}))} placeholder="5000" />
                  </div>
                  <div>
                    <label className="block text-[12px] text-[#374151] mb-1">Situation familiale</label>
                    <select className="input w-full" value={form.situation_familiale} onChange={e => setForm(f => ({...f, situation_familiale: e.target.value}))}>
                      {SITUATIONS.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[12px] text-[#374151] mb-1">Nombre d'enfants à charge</label>
                    <input type="number" min="0" max="6" className="input w-full" value={form.nombre_enfants}
                      onChange={e => setForm(f => ({...f, nombre_enfants: e.target.value}))} />
                  </div>
                </div>

                {/* Live preview */}
                {preview && (
                  <div className="mt-3 p-4 bg-[#FAFAF6] rounded-xl border border-[rgba(200,146,74,0.2)]">
                    <p className="text-[11px] font-semibold text-[#C8924A] uppercase tracking-wide mb-2">Aperçu du calcul</p>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: "CSS + IPE (4.48%)", value: preview.cnss_salarie },
                        { label: "AMO salarié (2.26%)", value: preview.amo_salarie },
                        { label: "Frais pro (25%)", value: preview.frais_pro },
                        { label: "Net imposable", value: preview.salaire_net_imposable },
                        { label: "IR net", value: preview.ir_net },
                        { label: "Net à payer", value: preview.salaire_net_payer },
                      ].map(({ label, value }) => (
                        <div key={label} className="text-center">
                          <p className="text-[10px] text-[#6B7280] mb-0.5">{label}</p>
                          <p className="text-[12px] font-semibold text-[#1A1A2E]">{formatMAD(value)}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 pt-2 border-t border-[rgba(200,146,74,0.15)] flex justify-between">
                      <span className="text-[11px] text-[#6B7280]">Coût total employeur</span>
                      <span className="text-[12px] font-bold text-[#C8924A]">{formatMAD(preview.cout_total_employeur)}</span>
                    </div>
                  </div>
                )}
              </section>

              {/* Mutuelle & CIMR */}
              <section>
                <h3 className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide mb-3">Cotisations optionnelles</h3>
                <div className="space-y-3">
                  {/* Mutuelle */}
                  <div className="p-3 rounded-lg border border-[rgba(0,0,0,0.08)] bg-[#FAFAF6]">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={form.has_mutuelle}
                        onChange={e => setForm(f => ({...f, has_mutuelle: e.target.checked}))}
                        className="w-4 h-4 accent-[#C8924A]" />
                      <span className="text-[12px] font-medium text-[#374151]">Mutuelle</span>
                    </label>
                    {form.has_mutuelle && (
                      <div className="grid grid-cols-2 gap-3 mt-3">
                        <div>
                          <label className="block text-[11px] text-[#6B7280] mb-1">Taux salarié (%)</label>
                          <input type="number" step="0.01" className="input w-full" value={form.mutuelle_taux_salarie}
                            onChange={e => setForm(f => ({...f, mutuelle_taux_salarie: e.target.value}))} />
                        </div>
                        <div>
                          <label className="block text-[11px] text-[#6B7280] mb-1">Taux patronal (%)</label>
                          <input type="number" step="0.01" className="input w-full" value={form.mutuelle_taux_patronal}
                            onChange={e => setForm(f => ({...f, mutuelle_taux_patronal: e.target.value}))} />
                        </div>
                      </div>
                    )}
                  </div>
                  {/* CIMR */}
                  <div className="p-3 rounded-lg border border-[rgba(0,0,0,0.08)] bg-[#FAFAF6]">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={form.has_cimr}
                        onChange={e => setForm(f => ({...f, has_cimr: e.target.checked}))}
                        className="w-4 h-4 accent-[#C8924A]" />
                      <span className="text-[12px] font-medium text-[#374151]">CIMR (retraite complémentaire)</span>
                    </label>
                    {form.has_cimr && (
                      <div className="grid grid-cols-2 gap-3 mt-3">
                        <div>
                          <label className="block text-[11px] text-[#6B7280] mb-1">Taux salarié (%)</label>
                          <input type="number" step="0.01" className="input w-full" value={form.cimr_taux_salarie}
                            onChange={e => setForm(f => ({...f, cimr_taux_salarie: e.target.value}))} />
                        </div>
                        <div>
                          <label className="block text-[11px] text-[#6B7280] mb-1">Taux patronal (%)</label>
                          <input type="number" step="0.01" className="input w-full" value={form.cimr_taux_patronal}
                            onChange={e => setForm(f => ({...f, cimr_taux_patronal: e.target.value}))} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {/* Bank */}
              <section>
                <h3 className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide mb-3">Coordonnées bancaires</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[12px] text-[#374151] mb-1">Banque</label>
                    <input className="input w-full" value={form.banque} onChange={e => setForm(f => ({...f, banque: e.target.value}))} placeholder="CIH, Attijariwafa…" />
                  </div>
                  <div>
                    <label className="block text-[12px] text-[#374151] mb-1">RIB</label>
                    <input className="input w-full" value={form.rib} onChange={e => setForm(f => ({...f, rib: e.target.value}))} />
                  </div>
                </div>
              </section>
            </div>

            <div className="flex justify-end gap-2 px-6 py-4 border-t border-[rgba(0,0,0,0.08)]">
              <button className="btn btn-outline" onClick={() => setShowModal(false)}>Annuler</button>
              <button className="btn btn-gold" onClick={save}>
                {editing ? "Enregistrer" : "Ajouter"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Bulletins tab ─────────────────────────────────────────────────────────────

function BulletinsTab({ supabase }: { supabase: ReturnType<typeof createClient> }) {
  const now = new Date();
  const [mois,  setMois]  = useState(now.getMonth() + 1);
  const [annee, setAnnee] = useState(now.getFullYear());
  const [bulletins, setBulletins] = useState<Bulletin[]>([]);
  const [loading, setLoading]     = useState(true);
  const [generating, setGenerating] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string|null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("bulletins_paie")
      .select("*, employees(nom, prenom, poste)")
      .eq("mois", mois)
      .eq("annee", annee)
      .order("created_at", { ascending: false });
    setBulletins(data ?? []);
    setLoading(false);
  }, [supabase, mois, annee]);

  useEffect(() => { load(); }, [load]);

  async function generateBulk() {
    setGenerating(true);
    const res = await fetch("/api/paie/generate-bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mois, annee }),
    });
    const json = await res.json();
    setGenerating(false);
    if (!res.ok) { toast.error(json.error ?? "Erreur"); return; }
    toast.success(`${json.count} bulletin(s) généré(s) pour ${json.period_label}`);
    load();
  }

  async function downloadPdf(id: string, label: string) {
    setDownloadingId(id);
    const res = await fetch(`/api/paie/bulletins/${id}/pdf`);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      toast.error(json.error ?? "Erreur PDF");
      setDownloadingId(null);
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `Bulletin_${label.replace(/\s/g,"_")}.pdf`;
    a.click(); URL.revokeObjectURL(url);
    setDownloadingId(null);
  }

  async function markPaid(id: string) {
    const { error } = await supabase
      .from("bulletins_paie")
      .update({ statut: "payé", paid_at: new Date().toISOString() })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Bulletin marqué comme payé");
    load();
  }

  const years = Array.from({ length: 4 }, (_, i) => now.getFullYear() - i);

  const totalNet = bulletins.reduce((s, b) => s + Number(b.salaire_net_payer), 0);
  const totalCout = bulletins.reduce((s, b) => s + Number(b.cout_total_employeur), 0);

  return (
    <>
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 p-1 bg-white rounded-lg border border-[rgba(0,0,0,0.08)]">
          <select
            className="text-[13px] text-[#1A1A2E] bg-transparent px-2 py-1 focus:outline-none"
            value={mois} onChange={e => setMois(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
          </select>
          <select
            className="text-[13px] text-[#1A1A2E] bg-transparent px-2 py-1 focus:outline-none"
            value={annee} onChange={e => setAnnee(Number(e.target.value))}>
            {years.map(y => <option key={y}>{y}</option>)}
          </select>
        </div>
        <button className="btn btn-gold" onClick={generateBulk} disabled={generating}>
          {generating ? <RefreshCw size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          Générer les bulletins
        </button>
      </div>

      {/* KPI row */}
      {bulletins.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Bulletins générés", value: bulletins.length, suffix: "" },
            { label: "Total net à payer", value: formatMAD(totalNet), suffix: "" },
            { label: "Masse salariale totale", value: formatMAD(totalCout), suffix: "" },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white rounded-xl border border-[rgba(0,0,0,0.08)] px-5 py-4">
              <p className="text-[11px] text-[#6B7280] uppercase tracking-wide mb-1">{label}</p>
              <p className="text-[18px] font-bold text-[#1A1A2E]">{value}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-[#6B7280] text-[13px]">Chargement…</div>
      ) : bulletins.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-[rgba(0,0,0,0.08)]">
          <FileText size={40} className="mx-auto mb-3 text-[#D1D5DB]" />
          <p className="text-[14px] font-medium text-[#374151]">Aucun bulletin pour cette période</p>
          <p className="text-[13px] text-[#6B7280] mt-1">Cliquez sur "Générer les bulletins" pour créer les bulletins du mois</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[rgba(0,0,0,0.08)] overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[rgba(0,0,0,0.06)]">
                {["Employé","Poste","Salaire brut","Net à payer","Coût employeur","Statut",""].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bulletins.map(b => {
                const emp = b.employees as any;
                const nom = emp ? `${emp.prenom} ${emp.nom}` : b.employee_id;
                const label = `${nom}_${b.period_label ?? `${b.mois}_${b.annee}`}`;
                return (
                  <tr key={b.id} className="border-b border-[rgba(0,0,0,0.04)] hover:bg-[#FAFAF6] transition-colors last:border-0">
                    <td className="px-4 py-3 font-medium text-[#1A1A2E]">{nom}</td>
                    <td className="px-4 py-3 text-[#6B7280]">{emp?.poste ?? "—"}</td>
                    <td className="px-4 py-3 text-[#1A1A2E]">{formatMAD(b.salaire_brut)}</td>
                    <td className="px-4 py-3 font-semibold text-[#1A1A2E]">{formatMAD(b.salaire_net_payer)}</td>
                    <td className="px-4 py-3 text-[#C8924A] font-medium">{formatMAD(b.cout_total_employeur)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                        b.statut === "payé"       ? "bg-[#D1FAE5] text-[#065F46]" :
                        b.statut === "validé"     ? "bg-[#DBEAFE] text-[#1E40AF]" :
                                                    "bg-[#FEF9C3] text-[#854D0E]"
                      }`}>
                        {b.statut === "payé" ? "Payé" : b.statut === "validé" ? "Validé" : "Brouillon"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => downloadPdf(b.id, label)}
                          disabled={downloadingId === b.id}
                          className="text-[#6B7280] hover:text-[#1A1A2E] transition-colors"
                          title="Télécharger PDF"
                        >
                          {downloadingId === b.id
                            ? <RefreshCw size={13} className="animate-spin" />
                            : <Download size={13} />
                          }
                        </button>
                        {b.statut !== "payé" && (
                          <button
                            onClick={() => markPaid(b.id)}
                            className="text-[#10B981] hover:text-[#059669] transition-colors"
                            title="Marquer comme payé"
                          >
                            <Check size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ── Déclarations sociales tab ─────────────────────────────────────────────────

function DeclarationsTab({ supabase }: { supabase: ReturnType<typeof createClient> }) {
  const now = new Date();
  const [annee, setAnnee] = useState(now.getFullYear());
  const [summary, setSummary] = useState<{
    mois: number; period_label: string;
    total_cnss: number; total_amo: number; total_ir: number;
    total_salarie: number; count: number;
  }[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("bulletins_paie")
      .select("mois, annee, period_label, cnss_salarie, cnss_patronal, amo_salarie, amo_patronal, ir_net, salaire_net_payer")
      .eq("annee", annee)
      .eq("statut", "payé");

    if (!data) { setLoading(false); return; }

    const byMonth: Record<number, typeof summary[0]> = {};
    data.forEach(b => {
      if (!byMonth[b.mois]) {
        byMonth[b.mois] = { mois: b.mois, period_label: b.period_label ?? `${b.mois}/${b.annee}`, total_cnss: 0, total_amo: 0, total_ir: 0, total_salarie: 0, count: 0 };
      }
      byMonth[b.mois].total_cnss += Number(b.cnss_salarie) + Number(b.cnss_patronal);
      byMonth[b.mois].total_amo  += Number(b.amo_salarie) + Number(b.amo_patronal);
      byMonth[b.mois].total_ir   += Number(b.ir_net);
      byMonth[b.mois].total_salarie += Number(b.salaire_net_payer);
      byMonth[b.mois].count      += 1;
    });

    setSummary(Object.values(byMonth).sort((a, b) => b.mois - a.mois));
    setLoading(false);
  }, [supabase, annee]);

  useEffect(() => { load(); }, [load]);

  const years = Array.from({ length: 4 }, (_, i) => now.getFullYear() - i);

  const totalCNSS = summary.reduce((s, r) => s + r.total_cnss, 0);
  const totalAMO  = summary.reduce((s, r) => s + r.total_amo, 0);
  const totalIR   = summary.reduce((s, r) => s + r.total_ir, 0);

  return (
    <>
      {/* Year selector */}
      <div className="flex items-center gap-3">
        <select
          className="input text-[13px]"
          value={annee} onChange={e => setAnnee(Number(e.target.value))}>
          {years.map(y => <option key={y}>{y}</option>)}
        </select>
      </div>

      {/* Obligations info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          {
            title: "CNSS",
            desc: "Cotisation CNSS mensuelle",
            deadline: "Avant le 10 du mois suivant",
            color: "bg-[#EFF6FF] border-[#BFDBFE]",
            titleColor: "text-[#1D4ED8]",
            total: totalCNSS,
          },
          {
            title: "AMO",
            desc: "Assurance Maladie Obligatoire",
            deadline: "Avec la déclaration CNSS",
            color: "bg-[#F0FDF4] border-[#BBF7D0]",
            titleColor: "text-[#166534]",
            total: totalAMO,
          },
          {
            title: "IR / Salaires",
            desc: "Impôt sur le revenu salarial",
            deadline: "Avant le 20 du mois suivant",
            color: "bg-[#FFF7ED] border-[#FED7AA]",
            titleColor: "text-[#C2410C]",
            total: totalIR,
          },
        ].map(({ title, desc, deadline, color, titleColor, total }) => (
          <div key={title} className={`rounded-xl border p-4 ${color}`}>
            <p className={`text-[12px] font-bold mb-0.5 ${titleColor}`}>{title}</p>
            <p className="text-[12px] text-[#374151] mb-1">{desc}</p>
            <p className="text-[11px] text-[#6B7280] flex items-center gap-1">
              <AlertCircle size={10} /> {deadline}
            </p>
            {total > 0 && (
              <p className={`text-[14px] font-bold mt-2 ${titleColor}`}>{formatMAD(total)} / an</p>
            )}
          </div>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-[#6B7280] text-[13px]">Chargement…</div>
      ) : summary.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-[rgba(0,0,0,0.08)]">
          <BarChart2 size={36} className="mx-auto mb-3 text-[#D1D5DB]" />
          <p className="text-[14px] font-medium text-[#374151]">Aucune donnée pour {annee}</p>
          <p className="text-[13px] text-[#6B7280] mt-1">Les bulletins marqués comme "payés" apparaîtront ici</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[rgba(0,0,0,0.08)] overflow-hidden">
          <div className="px-4 py-3 border-b border-[rgba(0,0,0,0.06)]">
            <h3 className="text-[13px] font-semibold text-[#1A1A2E]">Récapitulatif mensuel {annee}</h3>
          </div>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[rgba(0,0,0,0.06)]">
                {["Mois","Employés","Total salaires nets","CNSS total","AMO total","IR total"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summary.map(row => (
                <tr key={row.mois} className="border-b border-[rgba(0,0,0,0.04)] hover:bg-[#FAFAF6] transition-colors last:border-0">
                  <td className="px-4 py-3 font-medium text-[#1A1A2E]">{row.period_label}</td>
                  <td className="px-4 py-3 text-[#6B7280]">{row.count}</td>
                  <td className="px-4 py-3 font-medium text-[#1A1A2E]">{formatMAD(row.total_salarie)}</td>
                  <td className="px-4 py-3 text-[#1D4ED8]">{formatMAD(row.total_cnss)}</td>
                  <td className="px-4 py-3 text-[#166534]">{formatMAD(row.total_amo)}</td>
                  <td className="px-4 py-3 text-[#C2410C]">{formatMAD(row.total_ir)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[rgba(0,0,0,0.1)] bg-[#FAFAF6]">
                <td className="px-4 py-3 font-bold text-[#1A1A2E]" colSpan={3}>Total {annee}</td>
                <td className="px-4 py-3 font-bold text-[#1D4ED8]">{formatMAD(totalCNSS)}</td>
                <td className="px-4 py-3 font-bold text-[#166534]">{formatMAD(totalAMO)}</td>
                <td className="px-4 py-3 font-bold text-[#C2410C]">{formatMAD(totalIR)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </>
  );
}
