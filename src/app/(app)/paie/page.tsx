"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { calculateSalary, formatMAD } from "@/lib/payroll";
import {
  Users, ChevronLeft, ChevronRight, Plus, Edit2, Trash2,
  FileText, CheckCircle, DollarSign, Download, ExternalLink,
  Loader2, X, ChevronDown, ChevronUp, Banknote,
} from "lucide-react";
import toast from "react-hot-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Employee {
  id: string;
  nom: string;
  prenom: string;
  cin?: string;
  date_naissance?: string;
  date_embauche: string;
  poste?: string;
  departement?: string;
  type_contrat: string;
  salaire_brut: number;
  situation_familiale: string;
  nombre_enfants: number;
  banque?: string;
  rib?: string;
  numero_cnss?: string;
  has_mutuelle: boolean;
  mutuelle_taux_salarie: number;
  mutuelle_taux_patronal: number;
  has_cimr: boolean;
  cimr_taux_salarie: number;
  cimr_taux_patronal: number;
  statut: string;
}

interface Bulletin {
  id: string;
  employee_id: string;
  mois: number;
  annee: number;
  period_label: string;
  salaire_brut: number;
  cnss_salarie: number;
  amo_salarie: number;
  ir_net: number;
  salaire_net_payer: number;
  cnss_patronal: number;
  amo_patronal: number;
  taxe_formation_pro: number;
  cout_total_employeur: number;
  statut: string;
  employees?: { nom: string; prenom: string; poste?: string };
}

interface CnssDeclaration {
  id: string;
  mois: number;
  annee: number;
  period_label: string;
  total_salaires_bruts: number;
  total_cnss_salarie: number;
  total_cnss_patronal: number;
  total_amo_salarie: number;
  total_amo_patronal: number;
  total_ipe: number;
  total_formation_pro: number;
  total_a_payer: number;
  nombre_employes: number;
  statut: string;
  deposee_at?: string;
  payee_at?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTHS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

function fmtDate(d?: string | null) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("fr-MA", { day: "2-digit", month: "2-digit", year: "numeric" }); }
  catch { return d; }
}

function fmtAmt(n: number) {
  return new Intl.NumberFormat("fr-MA", { minimumFractionDigits: 2 }).format(n);
}

function initials(prenom: string, nom: string) {
  return `${(prenom[0] ?? "").toUpperCase()}${(nom[0] ?? "").toUpperCase()}`;
}

type Tab = "employes" | "bulletins" | "cnss";

const STATUT_COLORS: Record<string, string> = {
  brouillon: "bg-[#F3F4F6] text-[#6B7280]",
  validé: "bg-[#DBEAFE] text-[#1D4ED8]",
  payé: "bg-[#D1FAE5] text-[#065F46]",
  brouillon_cnss: "bg-[#F3F4F6] text-[#6B7280]",
  generee: "bg-[#E0E7FF] text-[#3730A3]",
  deposee: "bg-[#FEF3C7] text-[#92400E]",
  payee: "bg-[#D1FAE5] text-[#065F46]",
};

// ─── Empty employee form ──────────────────────────────────────────────────────

const EMPTY_EMP = {
  nom: "", prenom: "", cin: "", date_naissance: "", date_embauche: "",
  poste: "", departement: "", type_contrat: "CDI", salaire_brut: "",
  situation_familiale: "Célibataire", nombre_enfants: "0",
  banque: "", rib: "", numero_cnss: "",
  has_mutuelle: false, mutuelle_taux_salarie: "2.59", mutuelle_taux_patronal: "2.59",
  has_cimr: false, cimr_taux_salarie: "3.00", cimr_taux_patronal: "3.90",
  statut: "actif", showBenefits: false,
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PaiePage({ dossierId }: { dossierId?: string } = {}) {
  const supabase = createClient();
  const [userId, setUserId] = useState("");
  const [tab, setTab] = useState<Tab>("employes");
  const [now] = useState(() => new Date());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  // Employees
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [empLoading, setEmpLoading] = useState(true);
  const [empModal, setEmpModal] = useState<"add" | "edit" | null>(null);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [empForm, setEmpForm] = useState<any>(EMPTY_EMP);
  const [empSaving, setEmpSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Bulletins
  const [bulletins, setBulletins] = useState<Bulletin[]>([]);
  const [bulletinsLoading, setBulletinsLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // CNSS
  const [cnssDecl, setCnssDecl] = useState<CnssDeclaration | null>(null);
  const [cnssLoading, setCnssLoading] = useState(false);
  const [cnssGenerating, setCnssGenerating] = useState(false);
  const [cnssHistory, setCnssHistory] = useState<CnssDeclaration[]>([]);
  const [cnssEmployeeBreakdown, setCnssEmployeeBreakdown] = useState<any[]>([]);

  const periodLabel = `${MONTHS[selectedMonth - 1]} ${selectedYear}`;

  // ── Load data ───────────────────────────────────────────────────────────────

  const loadEmployees = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    let q = supabase.from("employees").select("*").eq("user_id", user.id);
    if (dossierId) q = (q as any).eq("dossier_id", dossierId);
    const { data } = await (q as any).order("nom");
    setEmployees(data ?? []);
    setEmpLoading(false);
  }, [dossierId]);

  const loadBulletins = useCallback(async () => {
    setBulletinsLoading(true);
    let q = supabase.from("bulletins_paie")
      .select("*, employees(nom, prenom, poste)")
      .eq("mois", selectedMonth).eq("annee", selectedYear);
    if (dossierId) q = (q as any).eq("dossier_id", dossierId);
    const { data } = await (q as any).order("created_at");
    setBulletins(data ?? []);
    setBulletinsLoading(false);
  }, [selectedMonth, selectedYear, dossierId]);

  const loadCnss = useCallback(async () => {
    setCnssLoading(true);
    const [{ data: decl }, { data: hist }] = await Promise.all([
      supabase.from("cnss_declarations")
        .select("*").eq("mois", selectedMonth).eq("annee", selectedYear).maybeSingle(),
      supabase.from("cnss_declarations")
        .select("*").order("annee", { ascending: false }).order("mois", { ascending: false }).limit(7),
    ]);
    setCnssDecl(decl ?? null);
    setCnssHistory((hist ?? []).filter((h: any) => !(h.mois === selectedMonth && h.annee === selectedYear)));
    if (decl) {
      const { data: buls } = await supabase.from("bulletins_paie")
        .select("*, employees(nom, prenom, numero_cnss)").eq("mois", selectedMonth)
        .eq("annee", selectedYear).eq("statut", "validé");
      setCnssEmployeeBreakdown(buls ?? []);
    }
    setCnssLoading(false);
  }, [selectedMonth, selectedYear]);

  useEffect(() => { loadEmployees(); }, [loadEmployees]);
  useEffect(() => { if (tab === "bulletins") loadBulletins(); }, [tab, loadBulletins]);
  useEffect(() => { if (tab === "cnss") loadCnss(); }, [tab, loadCnss]);

  // ── Month navigation ────────────────────────────────────────────────────────

  function prevMonth() {
    if (selectedMonth === 1) { setSelectedMonth(12); setSelectedYear(y => y - 1); }
    else setSelectedMonth(m => m - 1);
  }
  function nextMonth() {
    if (selectedMonth === 12) { setSelectedMonth(1); setSelectedYear(y => y + 1); }
    else setSelectedMonth(m => m + 1);
  }

  // ── Employee CRUD ───────────────────────────────────────────────────────────

  function openAddModal() {
    setEditingEmp(null);
    setEmpForm({ ...EMPTY_EMP });
    setEmpModal("add");
  }

  function openEditModal(emp: Employee) {
    setEditingEmp(emp);
    setEmpForm({
      nom: emp.nom, prenom: emp.prenom, cin: emp.cin ?? "", date_naissance: emp.date_naissance ?? "",
      date_embauche: emp.date_embauche, poste: emp.poste ?? "", departement: emp.departement ?? "",
      type_contrat: emp.type_contrat, salaire_brut: String(emp.salaire_brut),
      situation_familiale: emp.situation_familiale, nombre_enfants: String(emp.nombre_enfants),
      banque: emp.banque ?? "", rib: emp.rib ?? "", numero_cnss: emp.numero_cnss ?? "",
      has_mutuelle: emp.has_mutuelle, mutuelle_taux_salarie: String(emp.mutuelle_taux_salarie),
      mutuelle_taux_patronal: String(emp.mutuelle_taux_patronal),
      has_cimr: emp.has_cimr, cimr_taux_salarie: String(emp.cimr_taux_salarie),
      cimr_taux_patronal: String(emp.cimr_taux_patronal),
      statut: emp.statut, showBenefits: emp.has_mutuelle || emp.has_cimr,
    });
    setEmpModal("edit");
  }

  async function saveEmployee() {
    if (!empForm.nom || !empForm.prenom || !empForm.date_embauche || !empForm.salaire_brut) {
      toast.error("Remplissez les champs obligatoires");
      return;
    }
    setEmpSaving(true);
    const payload = {
      user_id: userId,
      nom: empForm.nom.trim(),
      prenom: empForm.prenom.trim(),
      cin: empForm.cin || null,
      date_naissance: empForm.date_naissance || null,
      date_embauche: empForm.date_embauche,
      poste: empForm.poste || null,
      departement: empForm.departement || null,
      type_contrat: empForm.type_contrat,
      salaire_brut: parseFloat(empForm.salaire_brut) || 0,
      situation_familiale: empForm.situation_familiale,
      nombre_enfants: parseInt(empForm.nombre_enfants) || 0,
      banque: empForm.banque || null,
      rib: empForm.rib || null,
      numero_cnss: empForm.numero_cnss || null,
      has_mutuelle: empForm.has_mutuelle,
      mutuelle_taux_salarie: parseFloat(empForm.mutuelle_taux_salarie) || 2.59,
      mutuelle_taux_patronal: parseFloat(empForm.mutuelle_taux_patronal) || 2.59,
      has_cimr: empForm.has_cimr,
      cimr_taux_salarie: parseFloat(empForm.cimr_taux_salarie) || 3.00,
      cimr_taux_patronal: parseFloat(empForm.cimr_taux_patronal) || 3.90,
      statut: empForm.statut,
      ...(dossierId ? { dossier_id: dossierId } : {}),
    };
    const { error } = empModal === "add"
      ? await supabase.from("employees").insert(payload)
      : await supabase.from("employees").update(payload).eq("id", editingEmp!.id);
    setEmpSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(empModal === "add" ? "Employé ajouté !" : "Employé mis à jour !");
    setEmpModal(null);
    loadEmployees();
  }

  async function deleteEmployee(id: string) {
    if (!confirm("Supprimer cet employé ? Ses bulletins seront conservés.")) return;
    setDeletingId(id);
    await supabase.from("employees").delete().eq("id", id);
    setDeletingId(null);
    toast.success("Employé supprimé");
    loadEmployees();
  }

  // ── Bulletin actions ────────────────────────────────────────────────────────

  async function generateBulletins() {
    setGenerating(true);
    try {
      const res = await fetch("/api/paie/generate-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mois: selectedMonth, annee: selectedYear }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success(`${json.count} bulletin(s) généré(s) pour ${periodLabel}`);
      loadBulletins();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setGenerating(false);
    }
  }

  async function updateBulletinStatus(id: string, statut: string) {
    setActionLoading(id + statut);
    const patch: any = { statut };
    if (statut === "payé") patch.paid_at = new Date().toISOString();
    await supabase.from("bulletins_paie").update(patch).eq("id", id);
    setActionLoading(null);
    loadBulletins();
  }

  async function deleteBulletin(id: string) {
    if (!confirm("Supprimer ce bulletin ?")) return;
    await supabase.from("bulletins_paie").delete().eq("id", id);
    toast.success("Bulletin supprimé");
    loadBulletins();
  }

  async function validateAll() {
    const drafts = bulletins.filter(b => b.statut === "brouillon").map(b => b.id);
    if (!drafts.length) { toast("Aucun brouillon à valider"); return; }
    await supabase.from("bulletins_paie").update({ statut: "validé" }).in("id", drafts);
    toast.success(`${drafts.length} bulletin(s) validé(s)`);
    loadBulletins();
  }

  async function downloadPdf(id: string, empName: string) {
    setActionLoading(id + "pdf");
    try {
      const res = await fetch(`/api/paie/bulletins/${id}/pdf`);
      if (!res.ok) throw new Error("Erreur PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Bulletin_${empName}_${periodLabel}.pdf`.replace(/\s/g, "_");
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setActionLoading(null);
    }
  }

  // ── CNSS actions ────────────────────────────────────────────────────────────

  async function generateCnss() {
    const validated = bulletins.filter(b => b.statut === "validé");
    if (validated.length === 0) {
      toast.error("Validez les bulletins avant de générer la déclaration CNSS");
      return;
    }
    setCnssGenerating(true);
    try {
      const res = await fetch("/api/paie/cnss/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mois: selectedMonth, annee: selectedYear }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success(`Déclaration CNSS générée — ${formatMAD(json.total_a_payer)}`);
      loadCnss();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCnssGenerating(false);
    }
  }

  async function updateCnssStatus(statut: "deposee" | "payee") {
    if (!cnssDecl) return;
    const patch: any = { statut };
    if (statut === "deposee") patch.deposee_at = new Date().toISOString();
    if (statut === "payee") patch.payee_at = new Date().toISOString();
    await supabase.from("cnss_declarations").update(patch).eq("id", cnssDecl.id);
    toast.success(statut === "deposee" ? "Marqué comme déposée" : "Marqué comme payée ✓");
    loadCnss();
  }

  async function downloadCnssPdf() {
    if (!cnssDecl) return;
    setActionLoading("cnss-pdf");
    try {
      const res = await fetch(`/api/paie/cnss/${cnssDecl.id}/pdf`);
      if (!res.ok) throw new Error("Erreur PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `CNSS_${periodLabel}.pdf`.replace(/\s/g, "_");
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) { toast.error(e.message); }
    finally { setActionLoading(null); }
  }

  async function downloadCnssExcel() {
    if (!cnssDecl) return;
    setActionLoading("cnss-excel");
    try {
      const res = await fetch(`/api/paie/cnss/${cnssDecl.id}/excel`);
      if (!res.ok) throw new Error("Erreur Excel");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `CNSS_${periodLabel}.xlsx`.replace(/\s/g, "_");
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) { toast.error(e.message); }
    finally { setActionLoading(null); }
  }

  // ── Derived ─────────────────────────────────────────────────────────────────

  const masseSalariale = bulletins.reduce((s, b) => s + Number(b.salaire_brut), 0);
  const chargesPatronales = bulletins.reduce((s, b) => s + Number(b.cnss_patronal) + Number(b.amo_patronal) + Number(b.taxe_formation_pro), 0);
  const irTotal = bulletins.reduce((s, b) => s + Number(b.ir_net), 0);
  const cnssTotal = bulletins.reduce((s, b) => s + Number(b.cnss_salarie) + Number(b.cnss_patronal), 0);

  const dueDay15 = new Date(selectedYear, selectedMonth - 1, 15);
  const dueDay28 = new Date(selectedYear, selectedMonth - 1, 28);

  // ── CNSS breakdown ──────────────────────────────────────────────────────────
  const cnssBreakdownFromBulletins = cnssDecl
    ? cnssEmployeeBreakdown.map((b: any) => ({
        nom: `${b.employees?.prenom ?? ""} ${b.employees?.nom ?? ""}`.trim(),
        numero_cnss: b.employees?.numero_cnss ?? "—",
        brut: Number(b.salaire_brut),
        cnss_sal: Number(b.cnss_salarie),
        cnss_pat: Number(b.cnss_patronal),
        amo_sal: Number(b.amo_salarie),
        amo_pat: Number(b.amo_patronal),
        total: Number(b.cnss_salarie) + Number(b.cnss_patronal) + Number(b.amo_salarie) + Number(b.amo_patronal),
      }))
    : [];

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(200,146,74,0.12)" }}>
            <Banknote size={18} className="text-[#C8924A]" />
          </div>
          <div>
            <h1 className="text-[18px] font-bold text-[#1A1A2E] leading-none">La Paie</h1>
            <p className="text-[11px] text-[#9CA3AF] mt-0.5">Gestion de la paie marocaine</p>
          </div>
        </div>
        {tab === "employes" && (
          <button onClick={openAddModal} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[12.5px] font-medium text-white transition-colors" style={{ backgroundColor: "#C8924A" }}>
            <Plus size={14} /> Ajouter un employé
          </button>
        )}
        {tab === "bulletins" && bulletins.length > 0 && (
          <div className="flex gap-2">
            <button onClick={validateAll} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium text-[#1D4ED8] border border-[#BFDBFE] bg-[#EFF6FF] hover:bg-[#DBEAFE] transition-colors">
              <CheckCircle size={13} /> Tout valider
            </button>
            <button onClick={() => setTab("cnss")} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium text-[#374151] border border-[rgba(0,0,0,0.12)] bg-white hover:bg-[#F9F9F6] transition-colors">
              Déclaration CNSS →
            </button>
          </div>
        )}
      </div>

      {/* Pill tabs */}
      <div className="flex gap-1 bg-[#F3F4F6] p-1 rounded-xl mb-5 w-fit">
        {([["employes","Employés"],["bulletins","Bulletins de paie"],["cnss","Déclaration CNSS"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-1.5 rounded-lg text-[12.5px] font-medium transition-all ${tab === key ? "bg-white text-[#1A1A2E] shadow-sm" : "text-[#6B7280] hover:text-[#1A1A2E]"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── TAB 1: EMPLOYÉS ── */}
      {tab === "employes" && (
        <EmployesTab
          employees={employees}
          loading={empLoading}
          deletingId={deletingId}
          onAdd={openAddModal}
          onEdit={openEditModal}
          onDelete={deleteEmployee}
          onViewBulletin={(emp) => { setTab("bulletins"); }}
        />
      )}

      {/* ── TAB 2: BULLETINS ── */}
      {tab === "bulletins" && (
        <BulletinsTab
          bulletins={bulletins}
          employees={employees}
          loading={bulletinsLoading}
          generating={generating}
          actionLoading={actionLoading}
          periodLabel={periodLabel}
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          masseSalariale={masseSalariale}
          chargesPatronales={chargesPatronales}
          irTotal={irTotal}
          cnssTotal={cnssTotal}
          dueDay15={dueDay15}
          dueDay28={dueDay28}
          onPrev={prevMonth}
          onNext={nextMonth}
          onGenerate={generateBulletins}
          onUpdateStatus={updateBulletinStatus}
          onDelete={deleteBulletin}
          onDownloadPdf={downloadPdf}
          onValidateAll={validateAll}
          onGoToCnss={() => setTab("cnss")}
        />
      )}

      {/* ── TAB 3: CNSS ── */}
      {tab === "cnss" && (
        <CnssTab
          decl={cnssDecl}
          history={cnssHistory}
          loading={cnssLoading}
          generating={cnssGenerating}
          actionLoading={actionLoading}
          periodLabel={periodLabel}
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          employeeBreakdown={cnssBreakdownFromBulletins}
          onPrev={prevMonth}
          onNext={nextMonth}
          onGenerate={generateCnss}
          onUpdateStatus={updateCnssStatus}
          onDownloadPdf={downloadCnssPdf}
          onDownloadExcel={downloadCnssExcel}
        />
      )}

      {/* ── Employee Modal ── */}
      {empModal && (
        <EmployeeModal
          mode={empModal}
          form={empForm}
          saving={empSaving}
          onChange={(k, v) => setEmpForm((f: any) => ({ ...f, [k]: v }))}
          onSave={saveEmployee}
          onClose={() => setEmpModal(null)}
        />
      )}
    </div>
  );
}

// ─── Employés Tab ─────────────────────────────────────────────────────────────

function EmployesTab({ employees, loading, deletingId, onAdd, onEdit, onDelete, onViewBulletin }: any) {
  if (loading) return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {[1,2].map(i => <div key={i} className="h-48 bg-white rounded-xl border border-[rgba(0,0,0,0.07)] animate-pulse" />)}
    </div>
  );

  if (!employees.length) return (
    <div className="bg-white border border-[rgba(0,0,0,0.07)] rounded-xl px-5 py-16 text-center" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#F3F4F6] mb-4">
        <Users size={24} className="text-[#9CA3AF]" />
      </div>
      <p className="text-[14px] font-semibold text-[#1A1A2E] mb-1">Aucun employé pour le moment</p>
      <p className="text-[12px] text-[#6B7280] mb-5">Ajoutez votre premier employé pour commencer à générer des bulletins de paie</p>
      <button onClick={onAdd} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12.5px] font-medium text-white" style={{ backgroundColor: "#C8924A" }}>
        <Plus size={14} /> Ajouter un employé
      </button>
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {employees.map((emp: Employee) => {
        const calc = calculateSalary({ salaire_brut: Number(emp.salaire_brut), situation_familiale: emp.situation_familiale, nombre_enfants: Number(emp.nombre_enfants) });
        return (
          <div key={emp.id} className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl p-4" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-[13px] font-bold" style={{ background: "#1A1A2E", color: "#C8924A" }}>
                {initials(emp.prenom, emp.nom)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13.5px] font-semibold text-[#1A1A2E]">{emp.prenom} {emp.nom}</span>
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${emp.statut === "actif" ? "bg-[#059669]" : "bg-[#9CA3AF]"}`} />
                </div>
                <div className="text-[11.5px] text-[#6B7280] mt-0.5">{emp.poste || "—"} · {emp.type_contrat}</div>
                <div className="text-[11px] text-[#9CA3AF]">Depuis {fmtDate(emp.date_embauche)}</div>
              </div>
            </div>
            <div className="border-t border-[rgba(0,0,0,0.05)] pt-3 grid grid-cols-2 gap-y-1.5 text-[11.5px] mb-3">
              <div><span className="text-[#9CA3AF]">Brut :</span> <span className="font-semibold text-[#1A1A2E]">{fmtAmt(Number(emp.salaire_brut))} MAD</span></div>
              <div><span className="text-[#9CA3AF]">Net estimé :</span> <span className="font-semibold text-[#059669]">~{fmtAmt(calc.salaire_net_payer)} MAD</span></div>
              {emp.numero_cnss && <div className="col-span-2"><span className="text-[#9CA3AF]">N° CNSS :</span> <span className="font-mono text-[#374151]">{emp.numero_cnss}</span></div>}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => onViewBulletin(emp)} className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11.5px] font-medium text-[#1A1A2E] border border-[rgba(0,0,0,0.12)] hover:bg-[#F9F9F6] transition-colors">
                <FileText size={12} /> Voir bulletin
              </button>
              <button onClick={() => onEdit(emp)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11.5px] text-[#6B7280] border border-[rgba(0,0,0,0.1)] hover:bg-[#F9F9F6] transition-colors">
                <Edit2 size={12} />
              </button>
              <button onClick={() => onDelete(emp.id)} disabled={deletingId === emp.id} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11.5px] text-[#DC2626] border border-[rgba(220,38,38,0.2)] hover:bg-[#FEF2F2] transition-colors disabled:opacity-50">
                {deletingId === emp.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Bulletins Tab ────────────────────────────────────────────────────────────

function BulletinsTab({ bulletins, employees, loading, generating, actionLoading, periodLabel, selectedMonth, selectedYear, masseSalariale, chargesPatronales, irTotal, cnssTotal, dueDay15, dueDay28, onPrev, onNext, onGenerate, onUpdateStatus, onDelete, onDownloadPdf, onValidateAll, onGoToCnss }: any) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  return (
    <div>
      {/* Month selector */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button onClick={onPrev} className="w-8 h-8 flex items-center justify-center rounded-lg border border-[rgba(0,0,0,0.1)] hover:bg-[#F3F4F6] transition-colors">
            <ChevronLeft size={16} />
          </button>
          <span className="text-[14px] font-semibold text-[#1A1A2E] min-w-[130px] text-center">{periodLabel}</span>
          <button onClick={onNext} className="w-8 h-8 flex items-center justify-center rounded-lg border border-[rgba(0,0,0,0.1)] hover:bg-[#F3F4F6] transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>
        <button onClick={onGenerate} disabled={generating || !employees.length} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[12.5px] font-medium text-white disabled:opacity-50 transition-colors" style={{ backgroundColor: "#C8924A" }}>
          {generating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
          Générer les bulletins de {MONTHS[selectedMonth - 1]}
        </button>
      </div>

      {/* Summary bar */}
      {bulletins.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {[
            { label: "Masse salariale brute", value: masseSalariale, note: null },
            { label: "Charges patronales", value: chargesPatronales, note: null },
            { label: "IR à reverser DGI", value: irTotal, note: `dû le ${dueDay28.getDate()}` },
            { label: "CNSS à reverser", value: cnssTotal, note: `dû le ${dueDay15.getDate()}` },
          ].map(m => (
            <div key={m.label} className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl p-3.5" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
              <div className="text-[10.5px] text-[#9CA3AF] uppercase tracking-[0.4px] mb-1.5">{m.label}</div>
              <div className="text-[16px] font-bold text-[#1A1A2E]">{fmtAmt(m.value)}</div>
              {m.note && <div className="text-[10px] text-[#9CA3AF] mt-0.5">{m.note}</div>}
            </div>
          ))}
        </div>
      )}

      {loading && <div className="h-32 bg-white rounded-xl border animate-pulse" />}

      {!loading && bulletins.length === 0 && (
        <div className="bg-white border border-[rgba(0,0,0,0.07)] rounded-xl px-5 py-12 text-center">
          <div className="text-3xl mb-3">📋</div>
          <p className="text-[13px] font-semibold text-[#6B7280]">Aucun bulletin pour {periodLabel}</p>
          <p className="text-[11.5px] text-[#9CA3AF] mt-1">Cliquez sur "Générer les bulletins" pour créer les bulletins de paie</p>
        </div>
      )}

      {!loading && bulletins.length > 0 && (
        <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px] border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-[#F9F9F6] border-b border-[rgba(0,0,0,0.07)]">
                  {["Employé","Brut","CNSS sal.","AMO sal.","IR","Net à payer","Statut","Actions"].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-[10.5px] font-semibold text-[#6B7280] uppercase tracking-[0.4px] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bulletins.map((b: Bulletin, idx: number) => (
                  <tr key={b.id} className={`border-b border-[rgba(0,0,0,0.04)] hover:bg-[rgba(200,146,74,0.03)] ${idx % 2 === 1 ? "bg-[#FAFAFA]" : "bg-white"}`}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#1A1A2E]">{(b.employees as any)?.prenom} {(b.employees as any)?.nom}</div>
                      <div className="text-[10.5px] text-[#9CA3AF]">{(b.employees as any)?.poste ?? ""}</div>
                    </td>
                    <td className="px-4 py-3 text-[#374151]">{fmtAmt(Number(b.salaire_brut))}</td>
                    <td className="px-4 py-3 text-[#DC2626]">−{fmtAmt(Number(b.cnss_salarie))}</td>
                    <td className="px-4 py-3 text-[#DC2626]">−{fmtAmt(Number(b.amo_salarie))}</td>
                    <td className="px-4 py-3 text-[#DC2626]">−{fmtAmt(Number(b.ir_net))}</td>
                    <td className="px-4 py-3 font-bold text-[#059669]">{fmtAmt(Number(b.salaire_net_payer))}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUT_COLORS[b.statut] ?? STATUT_COLORS.brouillon}`}>
                        {b.statut.charAt(0).toUpperCase() + b.statut.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3 relative">
                      <div className="relative">
                        <button
                          onClick={() => setOpenMenu(openMenu === b.id ? null : b.id)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] text-[#6B7280] border border-[rgba(0,0,0,0.1)] hover:bg-[#F3F4F6] transition-colors"
                        >
                          Actions <ChevronDown size={11} />
                        </button>
                        {openMenu === b.id && (
                          <div className="absolute right-0 top-full mt-1 bg-white border border-[rgba(0,0,0,0.1)] rounded-lg shadow-lg z-10 min-w-[170px]">
                            <button onClick={() => { onDownloadPdf(b.id, `${(b.employees as any)?.prenom}_${(b.employees as any)?.nom}`); setOpenMenu(null); }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-[11.5px] text-[#374151] hover:bg-[#F9F9F6]">
                              <FileText size={12} /> Télécharger PDF
                            </button>
                            {b.statut === "brouillon" && (
                              <button onClick={() => { onUpdateStatus(b.id, "validé"); setOpenMenu(null); }}
                                className="flex items-center gap-2 w-full px-3 py-2 text-[11.5px] text-[#1D4ED8] hover:bg-[#EFF6FF]">
                                <CheckCircle size={12} /> Valider
                              </button>
                            )}
                            {b.statut === "validé" && (
                              <button onClick={() => { onUpdateStatus(b.id, "payé"); setOpenMenu(null); }}
                                className="flex items-center gap-2 w-full px-3 py-2 text-[11.5px] text-[#059669] hover:bg-[#F0FDF4]">
                                <DollarSign size={12} /> Marquer comme payé
                              </button>
                            )}
                            <button onClick={() => { onDelete(b.id); setOpenMenu(null); }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-[11.5px] text-[#DC2626] hover:bg-[#FEF2F2]">
                              <Trash2 size={12} /> Supprimer
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[#F3F4F6] border-t border-[rgba(0,0,0,0.08)]">
                  <td className="px-4 py-2.5 text-[10.5px] font-semibold text-[#6B7280] uppercase tracking-[0.4px]">Totaux</td>
                  <td className="px-4 py-2.5 font-bold text-[#1A1A2E] text-[12px]">{fmtAmt(masseSalariale)}</td>
                  <td className="px-4 py-2.5 text-[#DC2626] font-semibold text-[12px]">−{fmtAmt(bulletins.reduce((s: number, b: Bulletin) => s + Number(b.cnss_salarie), 0))}</td>
                  <td className="px-4 py-2.5 text-[#DC2626] font-semibold text-[12px]">−{fmtAmt(bulletins.reduce((s: number, b: Bulletin) => s + Number(b.amo_salarie), 0))}</td>
                  <td className="px-4 py-2.5 text-[#DC2626] font-semibold text-[12px]">−{fmtAmt(irTotal)}</td>
                  <td className="px-4 py-2.5 font-bold text-[#059669] text-[12px]">{fmtAmt(bulletins.reduce((s: number, b: Bulletin) => s + Number(b.salaire_net_payer), 0))}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Bulk actions */}
      {bulletins.length > 0 && (
        <div className="flex gap-2 mt-3">
          <button onClick={onValidateAll} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium text-[#1D4ED8] border border-[#BFDBFE] bg-[#EFF6FF] hover:bg-[#DBEAFE] transition-colors">
            <CheckCircle size={13} /> Tout valider
          </button>
          <button onClick={onGoToCnss} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium text-[#374151] border border-[rgba(0,0,0,0.12)] bg-white hover:bg-[#F9F9F6] transition-colors">
            Générer déclaration CNSS →
          </button>
        </div>
      )}
    </div>
  );
}

// ─── CNSS Tab ─────────────────────────────────────────────────────────────────

function CnssTab({ decl, history, loading, generating, actionLoading, periodLabel, selectedMonth, selectedYear, employeeBreakdown, onPrev, onNext, onGenerate, onUpdateStatus, onDownloadPdf, onDownloadExcel }: any) {
  const nextMonthName = MONTHS[selectedMonth % 12];

  return (
    <div>
      {/* Month selector + status */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button onClick={onPrev} className="w-8 h-8 flex items-center justify-center rounded-lg border border-[rgba(0,0,0,0.1)] hover:bg-[#F3F4F6] transition-colors">
            <ChevronLeft size={16} />
          </button>
          <span className="text-[14px] font-semibold text-[#1A1A2E] min-w-[130px] text-center">{periodLabel}</span>
          <button onClick={onNext} className="w-8 h-8 flex items-center justify-center rounded-lg border border-[rgba(0,0,0,0.1)] hover:bg-[#F3F4F6] transition-colors">
            <ChevronRight size={16} />
          </button>
          {decl && (
            <span className={`ml-2 inline-block px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold ${STATUT_COLORS[decl.statut] ?? STATUT_COLORS.brouillon_cnss}`}>
              {decl.statut.charAt(0).toUpperCase() + decl.statut.slice(1)}
            </span>
          )}
        </div>
      </div>

      {/* Info box */}
      <div className="bg-[#F0F9FF] border border-[#BAE6FD] rounded-xl px-4 py-3 text-[12px] text-[#0369A1] mb-4 flex items-start gap-2">
        <span className="flex-shrink-0 mt-0.5">📋</span>
        <div>
          <span className="font-semibold">La déclaration CNSS est due le 15 de chaque mois</span> via le portail Damancom (<span className="font-mono">damancom.cnss.ma</span>).
          Générez votre récapitulatif ici, puis saisissez les montants sur Damancom.
        </div>
      </div>

      {loading && <div className="h-48 bg-white rounded-xl border animate-pulse" />}

      {!loading && !decl && (
        <div className="text-center py-10">
          <div className="text-3xl mb-3">📊</div>
          <p className="text-[13px] font-semibold text-[#6B7280] mb-1">Aucune déclaration pour {periodLabel}</p>
          <p className="text-[11.5px] text-[#9CA3AF] mb-5">Validez les bulletins de paie avant de générer la déclaration</p>
          <button onClick={onGenerate} disabled={generating} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12.5px] font-medium text-white disabled:opacity-50" style={{ backgroundColor: "#C8924A" }}>
            {generating ? <Loader2 size={13} className="animate-spin" /> : null}
            Calculer la déclaration de {MONTHS[selectedMonth - 1]}
          </button>
        </div>
      )}

      {!loading && decl && (
        <div className="flex flex-col gap-4">
          {/* Generate button (recalculate) */}
          <div className="flex justify-end">
            <button onClick={onGenerate} disabled={generating} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium text-[#374151] border border-[rgba(0,0,0,0.12)] hover:bg-[#F9F9F6] transition-colors disabled:opacity-50">
              {generating ? <Loader2 size={12} className="animate-spin" /> : null}
              Recalculer
            </button>
          </div>

          {/* Declaration summary card */}
          <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            {/* Card header */}
            <div className="px-5 py-4 border-b border-[rgba(0,0,0,0.07)]">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-[14px] font-bold text-[#1A1A2E]">DÉCLARATION CNSS — {decl.period_label}</h2>
                  <p className="text-[11.5px] text-[#6B7280] mt-0.5">Nombre d'employés : {decl.nombre_employes}</p>
                </div>
                <div className="text-right">
                  <div className="text-[10.5px] text-[#9CA3AF] uppercase tracking-[0.4px]">Échéance</div>
                  <div className="text-[13px] font-semibold text-[#1A1A2E]">15 {nextMonthName} {selectedMonth === 12 ? selectedYear + 1 : selectedYear}</div>
                  <div className="text-[10.5px] text-[#DC2626] mt-0.5">⚠️ Retard : pénalité 5%/mois</div>
                </div>
              </div>
            </div>

            <div className="p-5 grid md:grid-cols-2 gap-5">
              {/* Part salariale */}
              <div>
                <h3 className="text-[11px] font-bold text-[#6B7280] uppercase tracking-[0.5px] mb-3">Part salariale (retenue sur salaires)</h3>
                <div className="space-y-2">
                  {[
                    { label: "CNSS court terme (0.52%)", val: decl.total_salaires_bruts * 0.0052 },
                    { label: "CNSS long terme (3.96%)", val: decl.total_salaires_bruts * 0.0396 },
                    { label: "IPE salarié (0.19%)", val: decl.total_ipe ?? decl.total_salaires_bruts * 0.0019 },
                    { label: "AMO salarié (2.26%)", val: decl.total_amo_salarie },
                  ].map(r => (
                    <div key={r.label} className="flex items-center justify-between text-[12px]">
                      <span className="text-[#374151]">{r.label}</span>
                      <span className="font-semibold text-[#1A1A2E]">{fmtAmt(r.val)} MAD</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between text-[12.5px] pt-2 border-t border-[rgba(0,0,0,0.07)]">
                    <span className="font-bold text-[#1A1A2E]">Total part salariale</span>
                    <span className="font-bold text-[#1A1A2E]">{fmtAmt(decl.total_cnss_salarie + decl.total_amo_salarie)} MAD</span>
                  </div>
                </div>
              </div>

              {/* Part patronale */}
              <div>
                <h3 className="text-[11px] font-bold text-[#6B7280] uppercase tracking-[0.5px] mb-3">Part patronale (à charge de l'entreprise)</h3>
                <div className="space-y-2">
                  {[
                    { label: "Allocations familiales (6.40%)", val: decl.total_salaires_bruts * 0.064 },
                    { label: "Prestations sociales (8.98%)", val: decl.total_salaires_bruts * 0.0898 },
                    { label: "IPE patronal (0.67%)", val: decl.total_salaires_bruts * 0.0067 },
                    { label: "AMO patronal (4.11%)", val: decl.total_amo_patronal },
                    { label: "Formation professionnelle (1.6%)", val: decl.total_formation_pro },
                  ].map(r => (
                    <div key={r.label} className="flex items-center justify-between text-[12px]">
                      <span className="text-[#374151]">{r.label}</span>
                      <span className="font-semibold text-[#1A1A2E]">{fmtAmt(r.val)} MAD</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between text-[12.5px] pt-2 border-t border-[rgba(0,0,0,0.07)]">
                    <span className="font-bold text-[#1A1A2E]">Total part patronale</span>
                    <span className="font-bold text-[#1A1A2E]">{fmtAmt(decl.total_cnss_patronal + decl.total_amo_patronal + decl.total_formation_pro)} MAD</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Total */}
            <div className="px-5 py-4 bg-[#F9F9F6] border-t border-[rgba(0,0,0,0.07)]">
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-bold text-[#1A1A2E]">TOTAL À PAYER À CNSS</span>
                <span className="text-[20px] font-bold" style={{ color: "#C8924A" }}>{fmtAmt(decl.total_a_payer)} MAD</span>
              </div>
            </div>
          </div>

          {/* Employee breakdown */}
          {employeeBreakdown.length > 0 && (
            <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
              <div className="px-4 py-3 border-b border-[rgba(0,0,0,0.07)]">
                <h3 className="text-[12.5px] font-semibold text-[#1A1A2E]">Détail par employé</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[11.5px] border-collapse min-w-[700px]">
                  <thead>
                    <tr className="bg-[#F9F9F6] border-b border-[rgba(0,0,0,0.07)]">
                      {["Employé","Brut déclaré","CNSS sal.","CNSS pat.","AMO sal.","AMO pat.","Total"].map(h => (
                        <th key={h} className="text-left px-3 py-2 text-[10px] font-semibold text-[#6B7280] uppercase tracking-[0.4px]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {employeeBreakdown.map((r: any, i: number) => (
                      <tr key={i} className={`border-b border-[rgba(0,0,0,0.04)] ${i % 2 === 1 ? "bg-[#FAFAFA]" : "bg-white"}`}>
                        <td className="px-3 py-2 font-medium text-[#1A1A2E]">{r.nom}</td>
                        <td className="px-3 py-2 text-[#374151]">{fmtAmt(r.brut)}</td>
                        <td className="px-3 py-2 text-[#DC2626]">{fmtAmt(r.cnss_sal)}</td>
                        <td className="px-3 py-2 text-[#374151]">{fmtAmt(r.cnss_pat)}</td>
                        <td className="px-3 py-2 text-[#DC2626]">{fmtAmt(r.amo_sal)}</td>
                        <td className="px-3 py-2 text-[#374151]">{fmtAmt(r.amo_pat)}</td>
                        <td className="px-3 py-2 font-bold text-[#1A1A2E]">{fmtAmt(r.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            <button onClick={onDownloadPdf} disabled={actionLoading === "cnss-pdf"} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium text-[#374151] border border-[rgba(0,0,0,0.12)] bg-white hover:bg-[#F9F9F6] transition-colors disabled:opacity-50">
              {actionLoading === "cnss-pdf" ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
              Télécharger récapitulatif PDF
            </button>
            <button onClick={onDownloadExcel} disabled={actionLoading === "cnss-excel"} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium text-[#374151] border border-[rgba(0,0,0,0.12)] bg-white hover:bg-[#F9F9F6] transition-colors disabled:opacity-50">
              {actionLoading === "cnss-excel" ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
              Télécharger fichier Excel
            </button>
            <a href="https://damancom.cnss.ma" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium text-white transition-colors" style={{ backgroundColor: "#1A1A2E" }}>
              <ExternalLink size={12} /> Ouvrir Damancom
            </a>
          </div>

          <div className="flex flex-wrap gap-2">
            {decl.statut === "generee" && (
              <button onClick={() => onUpdateStatus("deposee")} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[12px] font-medium text-[#1D4ED8] border border-[#BFDBFE] bg-[#EFF6FF] hover:bg-[#DBEAFE] transition-colors">
                <CheckCircle size={13} /> Marquer comme déposée sur Damancom
              </button>
            )}
            {(decl.statut === "generee" || decl.statut === "deposee") && (
              <button onClick={() => onUpdateStatus("payee")} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[12px] font-medium text-[#059669] border border-[#A7F3D0] bg-[#ECFDF5] hover:bg-[#D1FAE5] transition-colors">
                <DollarSign size={13} /> Marquer comme payée
              </button>
            )}
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="mt-6">
          <h3 className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-[0.5px] mb-3">Historique</h3>
          <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl overflow-hidden">
            <table className="w-full text-[11.5px] border-collapse">
              <thead>
                <tr className="bg-[#F9F9F6] border-b border-[rgba(0,0,0,0.07)]">
                  {["Période","Employés","Total payé","Statut","Date dépôt"].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold text-[#6B7280] uppercase tracking-[0.4px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((h: CnssDeclaration, i: number) => (
                  <tr key={h.id} className={`border-b border-[rgba(0,0,0,0.04)] last:border-0 ${i % 2 === 1 ? "bg-[#FAFAFA]" : "bg-white"}`}>
                    <td className="px-4 py-2.5 font-medium text-[#1A1A2E]">{h.period_label}</td>
                    <td className="px-4 py-2.5 text-[#374151]">{h.nombre_employes}</td>
                    <td className="px-4 py-2.5 font-semibold text-[#1A1A2E]">{fmtAmt(h.total_a_payer)} MAD</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUT_COLORS[h.statut] ?? STATUT_COLORS.brouillon_cnss}`}>
                        {h.statut === "payee" ? "✅ Payée" : h.statut === "deposee" ? "⚠️ Déposée" : h.statut}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-[#6B7280]">{fmtDate(h.deposee_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Employee Modal ───────────────────────────────────────────────────────────

function EmployeeModal({ mode, form, saving, onChange, onSave, onClose }: any) {
  const brut = parseFloat(form.salaire_brut) || 0;
  const preview = brut > 0 ? calculateSalary({
    salaire_brut: brut,
    situation_familiale: form.situation_familiale,
    nombre_enfants: parseInt(form.nombre_enfants) || 0,
  }) : null;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-4">
        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(0,0,0,0.07)]">
          <h2 className="text-[15px] font-bold text-[#1A1A2E]">
            {mode === "add" ? "Ajouter un employé" : "Modifier l'employé"}
          </h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-[#9CA3AF] hover:bg-[#F3F4F6]">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 grid md:grid-cols-3 gap-5">
          {/* Left + Right columns */}
          <div className="md:col-span-2 space-y-4">
            {/* Personal info */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Prénom *">
                <input className="input" value={form.prenom} onChange={e => onChange("prenom", e.target.value)} />
              </Field>
              <Field label="Nom *">
                <input className="input" value={form.nom} onChange={e => onChange("nom", e.target.value)} />
              </Field>
              <Field label="CIN">
                <input className="input" value={form.cin} onChange={e => onChange("cin", e.target.value)} />
              </Field>
              <Field label="Date de naissance">
                <input type="date" className="input" value={form.date_naissance} onChange={e => onChange("date_naissance", e.target.value)} />
              </Field>
              <Field label="Date d'embauche *">
                <input type="date" className="input" value={form.date_embauche} onChange={e => onChange("date_embauche", e.target.value)} />
              </Field>
              <Field label="N° CNSS">
                <input className="input" value={form.numero_cnss} onChange={e => onChange("numero_cnss", e.target.value)} />
              </Field>
            </div>

            {/* Job info */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Poste">
                <input className="input" value={form.poste} onChange={e => onChange("poste", e.target.value)} />
              </Field>
              <Field label="Département">
                <input className="input" value={form.departement} onChange={e => onChange("departement", e.target.value)} />
              </Field>
              <Field label="Type de contrat">
                <select className="input" value={form.type_contrat} onChange={e => onChange("type_contrat", e.target.value)}>
                  {["CDI","CDD","Anapec","Intérim"].map(c => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Salaire brut (MAD) *">
                <input type="number" step="0.01" className="input" value={form.salaire_brut} onChange={e => onChange("salaire_brut", e.target.value)} />
              </Field>
              <Field label="Situation familiale">
                <select className="input" value={form.situation_familiale} onChange={e => onChange("situation_familiale", e.target.value)}>
                  {["Célibataire","Marié(e)","Divorcé(e)","Veuf/Veuve"].map(s => <option key={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Nombre d'enfants">
                <select className="input" value={form.nombre_enfants} onChange={e => onChange("nombre_enfants", e.target.value)}>
                  {[0,1,2,3,4,5,6].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </Field>
            </div>

            {/* Bank info */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Banque">
                <input className="input" value={form.banque} onChange={e => onChange("banque", e.target.value)} />
              </Field>
              <Field label="RIB">
                <input className="input" value={form.rib} onChange={e => onChange("rib", e.target.value)} />
              </Field>
            </div>

            {/* Optional benefits */}
            <div>
              <button
                type="button"
                onClick={() => onChange("showBenefits", !form.showBenefits)}
                className="flex items-center gap-1.5 text-[12px] text-[#6B7280] hover:text-[#1A1A2E]"
              >
                {form.showBenefits ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                Avantages optionnels (Mutuelle, CIMR)
              </button>

              {form.showBenefits && (
                <div className="mt-3 space-y-3 p-3 bg-[#F9F9F6] rounded-xl border border-[rgba(0,0,0,0.07)]">
                  {/* Mutuelle */}
                  <div>
                    <label className="flex items-center gap-2 text-[12px] font-medium text-[#374151] cursor-pointer">
                      <input type="checkbox" checked={form.has_mutuelle} onChange={e => onChange("has_mutuelle", e.target.checked)} className="w-3.5 h-3.5" />
                      Mutuelle
                    </label>
                    {form.has_mutuelle && (
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <Field label="Taux salarié (%)">
                          <input type="number" step="0.01" className="input" value={form.mutuelle_taux_salarie} onChange={e => onChange("mutuelle_taux_salarie", e.target.value)} />
                        </Field>
                        <Field label="Taux patronal (%)">
                          <input type="number" step="0.01" className="input" value={form.mutuelle_taux_patronal} onChange={e => onChange("mutuelle_taux_patronal", e.target.value)} />
                        </Field>
                      </div>
                    )}
                  </div>
                  {/* CIMR */}
                  <div>
                    <label className="flex items-center gap-2 text-[12px] font-medium text-[#374151] cursor-pointer">
                      <input type="checkbox" checked={form.has_cimr} onChange={e => onChange("has_cimr", e.target.checked)} className="w-3.5 h-3.5" />
                      CIMR (Retraite complémentaire)
                    </label>
                    {form.has_cimr && (
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <Field label="Taux salarié (%)">
                          <input type="number" step="0.01" className="input" value={form.cimr_taux_salarie} onChange={e => onChange("cimr_taux_salarie", e.target.value)} />
                        </Field>
                        <Field label="Taux patronal (%)">
                          <input type="number" step="0.01" className="input" value={form.cimr_taux_patronal} onChange={e => onChange("cimr_taux_patronal", e.target.value)} />
                        </Field>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Salary preview */}
          <div className="md:col-span-1">
            <div className="bg-[#F9F9F6] rounded-xl border border-[rgba(0,0,0,0.07)] p-4 sticky top-4">
              <h3 className="text-[11px] font-bold text-[#6B7280] uppercase tracking-[0.5px] mb-3">Aperçu du salaire</h3>
              {!preview ? (
                <p className="text-[11.5px] text-[#9CA3AF]">Saisissez le salaire brut pour voir le calcul</p>
              ) : (
                <div className="space-y-2">
                  {[
                    { label: "Salaire brut", val: preview.salaire_brut, color: "#1A1A2E" },
                    { label: "CNSS salarié", val: -preview.cnss_salarie, color: "#DC2626" },
                    { label: "AMO salarié", val: -preview.amo_salarie, color: "#DC2626" },
                    { label: "IR net", val: -preview.ir_net, color: "#DC2626" },
                  ].map(r => (
                    <div key={r.label} className="flex items-center justify-between text-[12px]">
                      <span className="text-[#6B7280]">{r.label}</span>
                      <span className="font-semibold" style={{ color: r.color }}>
                        {r.val < 0 ? `−${fmtAmt(-r.val)}` : fmtAmt(r.val)} MAD
                      </span>
                    </div>
                  ))}
                  <div className="border-t border-[rgba(0,0,0,0.08)] pt-2 flex items-center justify-between text-[13px]">
                    <span className="font-bold text-[#1A1A2E]">Net à payer</span>
                    <span className="font-bold text-[#059669]">{fmtAmt(preview.salaire_net_payer)} MAD</span>
                  </div>
                  <div className="border-t border-[rgba(0,0,0,0.05)] pt-2 flex items-center justify-between text-[11.5px]">
                    <span className="text-[#6B7280]">Coût employeur</span>
                    <span className="font-semibold text-[#D97706]">{fmtAmt(preview.cout_total_employeur)} MAD</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[rgba(0,0,0,0.07)]">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-[12.5px] font-medium text-[#374151] border border-[rgba(0,0,0,0.12)] hover:bg-[#F3F4F6] transition-colors">
            Annuler
          </button>
          <button onClick={onSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12.5px] font-medium text-white disabled:opacity-50 transition-colors" style={{ backgroundColor: "#C8924A" }}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : null}
            {mode === "add" ? "Ajouter l'employé" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Field wrapper ────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-[0.5px] mb-1">{label}</label>
      {children}
    </div>
  );
}
