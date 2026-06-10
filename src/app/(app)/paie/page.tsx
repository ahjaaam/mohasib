"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { calculateSalary, formatMAD } from "@/lib/payroll";
import {
  Users, ChevronLeft, ChevronRight, Plus, Edit2, Trash2,
  FileText, CheckCircle, DollarSign, Download, ExternalLink,
  Loader2, X, ChevronDown, ChevronUp, Banknote,
  CalendarDays, Clock, Briefcase, FolderOpen, Eye, EyeOff,
} from "lucide-react";
import toast from "react-hot-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Employee {
  id: string;
  matricule?: string;
  nom: string;
  prenom: string;
  cin?: string;
  adresse?: string;
  cnss_number?: string;
  date_naissance?: string;
  date_embauche: string;
  date_fin_contrat?: string;
  poste?: string;
  departement?: string;
  type_contrat: string;
  salaire_base?: number;
  salaire_brut: number;
  mode_paiement?: string;
  situation_familiale: string;
  nombre_enfants: number;
  banque?: string;
  rib?: string;
  numero_cnss?: string;
  heures_travail_semaine?: number;
  jours_travail_semaine?: number;
  is_active?: boolean;
  notes?: string;
  has_mutuelle: boolean;
  mutuelle_taux_salarie: number;
  mutuelle_taux_patronal: number;
  has_cimr: boolean;
  cimr_taux_salarie: number;
  cimr_taux_patronal: number;
  statut: string;
}

interface LeaveType {
  id: string;
  name: string;
  code?: string | null;
  is_paid: boolean;
  days_per_year?: number | null;
  color?: string | null;
}

interface EmployeeLeave {
  id: string;
  employee_id: string;
  leave_type_id: string | null;
  date_debut: string;
  date_fin: string;
  nombre_jours: number;
  statut: string;
  is_paid: boolean;
  impact_salaire: number;
  notes?: string | null;
  employees?: { nom: string; prenom: string };
  leave_types?: { name: string; color?: string | null; is_paid?: boolean | null };
}

interface EmployeeHours {
  id: string;
  employee_id: string;
  mois: number;
  annee: number;
  heures_normales: number;
  heures_theoriques: number;
  heures_sup_25: number;
  heures_sup_50: number;
  heures_sup_100: number;
  jours_absence: number;
  heures_absence: number;
  montant_heures_sup: number;
  montant_absence_deduit: number;
  notes?: string | null;
}

interface Holiday {
  id: string;
  date: string;
  name: string;
  name_ar?: string | null;
  is_national?: boolean | null;
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

type Tab = "employes" | "conges" | "heures" | "bulletins" | "cnss";

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
  nom: "", prenom: "", matricule: "", cin: "", date_naissance: "", date_embauche: "",
  adresse: "",
  date_fin_contrat: "", poste: "", departement: "", type_contrat: "CDI", salaire_brut: "",
  situation_familiale: "Célibataire", nombre_enfants: "0",
  mode_paiement: "virement", banque: "", rib: "", numero_cnss: "", heures_travail_semaine: "44", jours_travail_semaine: "6", notes: "",
  has_mutuelle: false, mutuelle_taux_salarie: "2.59", mutuelle_taux_patronal: "2.59",
  has_cimr: false, cimr_taux_salarie: "3.00", cimr_taux_patronal: "3.90",
  statut: "actif", showBenefits: false,
};

const DEFAULT_LEAVE_TYPES = [
  { id: "", name: "Congé annuel", code: "annuel", is_paid: true, days_per_year: 18, color: "#C8924A" },
  { id: "maladie", name: "Maladie", code: "maladie", is_paid: true, days_per_year: null, color: "#2563EB" },
  { id: "maternite", name: "Maternité", code: "maternite", is_paid: true, days_per_year: 98, color: "#7C3AED" },
  { id: "paternite", name: "Paternité", code: "paternite", is_paid: true, days_per_year: 3, color: "#7C3AED" },
  { id: "sans_solde", name: "Sans solde", code: "sans_solde", is_paid: false, days_per_year: null, color: "#111827" },
  { id: "absence", name: "Absence non justifiée", code: "absence", is_paid: false, days_per_year: null, color: "#DC2626" },
];

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function countWorkingDays(start: string, end: string, holidays: Set<string>) {
  if (!start || !end) return 0;
  const first = new Date(start);
  const last = new Date(end);
  if (Number.isNaN(first.getTime()) || Number.isNaN(last.getTime()) || first > last) return 0;
  let days = 0;
  const d = new Date(first);
  while (d <= last) {
    const iso = d.toISOString().slice(0, 10);
    if (d.getDay() !== 0 && !holidays.has(iso)) days += 1;
    d.setDate(d.getDate() + 1);
  }
  return days;
}

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

  // Congés
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [leaves, setLeaves] = useState<EmployeeLeave[]>([]);
  const [holidays, setHolidays] = useState<Set<string>>(new Set());
  const [holidayRows, setHolidayRows] = useState<Holiday[]>([]);
  const [leavesLoading, setLeavesLoading] = useState(false);
  const [leaveModal, setLeaveModal] = useState(false);
  const [leaveSaving, setLeaveSaving] = useState(false);
  const [leaveForm, setLeaveForm] = useState<any>({
    employee_id: "",
    leave_type_id: "",
    date_debut: "",
    date_fin: "",
    is_paid: true,
    notes: "",
  });

  // Heures
  const [hoursRows, setHoursRows] = useState<Record<string, EmployeeHours>>({});
  const [hoursLoading, setHoursLoading] = useState(false);
  const [savingHoursId, setSavingHoursId] = useState<string | null>(null);

  // Bulletins
  const [bulletins, setBulletins] = useState<Bulletin[]>([]);
  const [bulletinsLoading, setBulletinsLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // CNSS
  const [cnssDecl, setCnssDecl] = useState<CnssDeclaration | null>(null);
  const [cnssDeclaration, setCnssDeclaration] = useState<any | null>(null);
  const [cnssDeclarationLoading, setCnssDeclarationLoading] = useState(false);
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
    else q = (q as any).is("dossier_id", null);
    const { data } = await (q as any).order("nom");
    setEmployees(data ?? []);
    setEmpLoading(false);
  }, [dossierId]);

  const scopeInsert = useCallback((payload: any) => ({
    ...payload,
    ...(dossierId ? { dossier_id: dossierId } : {}),
  }), [dossierId]);

  const loadLeaveData = useCallback(async () => {
    setLeavesLoading(true);
    const [{ data: typeData }, { data: leaveData }, { data: holidayData }] = await Promise.all([
      supabase.from("leave_types").select("*").or(dossierId ? `dossier_id.eq.${dossierId},is_default.eq.true` : "dossier_id.is.null,is_default.eq.true").order("name"),
      (() => {
        let q = supabase
          .from("employee_leaves")
          .select("*, employees(nom, prenom), leave_types(name, color, is_paid)")
          .gte("date_fin", `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-01`)
          .lte("date_debut", `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-31`);
        if (dossierId) q = (q as any).eq("dossier_id", dossierId);
        else q = (q as any).is("dossier_id", null);
        return (q as any).order("date_debut", { ascending: false });
      })(),
      supabase.from("jours_feries").select("*").gte("date", `${selectedYear}-01-01`).lte("date", `${selectedYear}-12-31`),
    ]);

    setLeaveTypes((typeData?.length ? typeData : DEFAULT_LEAVE_TYPES) as LeaveType[]);
    setLeaves((leaveData ?? []) as EmployeeLeave[]);
    setHolidayRows(((holidayData ?? []) as Holiday[]).sort((a, b) => a.date.localeCompare(b.date)));
    setHolidays(new Set((holidayData ?? []).map((h: any) => h.date)));
    setLeavesLoading(false);
  }, [dossierId, selectedMonth, selectedYear]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadHours = useCallback(async () => {
    setHoursLoading(true);
    let q = supabase.from("employee_heures")
      .select("*")
      .eq("mois", selectedMonth)
      .eq("annee", selectedYear);
    if (dossierId) q = (q as any).eq("dossier_id", dossierId);
    else q = (q as any).is("dossier_id", null);
    const { data } = await (q as any);
    const byEmployee: Record<string, EmployeeHours> = {};
    for (const row of (data ?? []) as EmployeeHours[]) byEmployee[row.employee_id] = row;
    setHoursRows(byEmployee);
    setHoursLoading(false);
  }, [dossierId, selectedMonth, selectedYear]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadBulletins = useCallback(async () => {
    setBulletinsLoading(true);
    let q = supabase.from("bulletins_paie")
      .select("*, employees(nom, prenom, poste)")
      .eq("mois", selectedMonth).eq("annee", selectedYear);
    if (dossierId) q = (q as any).eq("dossier_id", dossierId);
    else q = (q as any).is("dossier_id", null);
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

  const loadCnssDeclaration = useCallback(async () => {
    setCnssDeclarationLoading(true);
    const params = new URLSearchParams({
      mois: String(selectedMonth),
      annee: String(selectedYear),
      ...(dossierId ? { dossierId } : {}),
    });
    const res = await fetch(`/api/paie/cnss-declaration?${params.toString()}`);
    const json = await res.json();
    if (res.ok) setCnssDeclaration(json);
    else toast.error(json.error ?? "Erreur déclaration CNSS");
    setCnssDeclarationLoading(false);
  }, [selectedMonth, selectedYear, dossierId]);

  useEffect(() => { loadEmployees(); }, [loadEmployees]);
  useEffect(() => { if (tab === "conges") loadLeaveData(); }, [tab, loadLeaveData]);
  useEffect(() => { if (tab === "heures") loadHours(); }, [tab, loadHours]);
  useEffect(() => { if (tab === "bulletins") loadBulletins(); }, [tab, loadBulletins]);
  useEffect(() => { if (tab === "cnss") loadCnssDeclaration(); }, [tab, loadCnssDeclaration, bulletins]);

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
    const nextNumber = employees.length + 1;
    setEmpForm({ ...EMPTY_EMP, matricule: `EMP-${String(nextNumber).padStart(3, "0")}` });
    setEmpModal("add");
  }

  function openEditModal(emp: Employee) {
    setEditingEmp(emp);
    setEmpForm({
      nom: emp.nom, prenom: emp.prenom, cin: emp.cin ?? "", date_naissance: emp.date_naissance ?? "",
      adresse: emp.adresse ?? "",
      matricule: emp.matricule ?? "", date_embauche: emp.date_embauche, date_fin_contrat: emp.date_fin_contrat ?? "",
      poste: emp.poste ?? "", departement: emp.departement ?? "",
      type_contrat: emp.type_contrat, salaire_brut: String(emp.salaire_brut),
      situation_familiale: emp.situation_familiale, nombre_enfants: String(emp.nombre_enfants),
      mode_paiement: emp.mode_paiement ?? "virement", banque: emp.banque ?? "", rib: emp.rib ?? "", numero_cnss: emp.numero_cnss ?? emp.cnss_number ?? "",
      heures_travail_semaine: String(emp.heures_travail_semaine ?? 44),
      jours_travail_semaine: String(emp.jours_travail_semaine ?? 6),
      notes: emp.notes ?? "",
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
      matricule: empForm.matricule || null,
      nom: empForm.nom.trim(),
      prenom: empForm.prenom.trim(),
      cin: empForm.cin || null,
      adresse: empForm.adresse || null,
      cnss_number: empForm.numero_cnss || null,
      date_naissance: empForm.date_naissance || null,
      date_embauche: empForm.date_embauche,
      date_fin_contrat: empForm.date_fin_contrat || null,
      poste: empForm.poste || null,
      departement: empForm.departement || null,
      type_contrat: empForm.type_contrat,
      salaire_base: parseFloat(empForm.salaire_brut) || 0,
      salaire_brut: parseFloat(empForm.salaire_brut) || 0,
      mode_paiement: empForm.mode_paiement,
      situation_familiale: empForm.situation_familiale,
      nombre_enfants: parseInt(empForm.nombre_enfants) || 0,
      banque: empForm.banque || null,
      rib: empForm.rib || null,
      numero_cnss: empForm.numero_cnss || null,
      heures_travail_semaine: parseFloat(empForm.heures_travail_semaine) || 44,
      jours_travail_semaine: parseFloat(empForm.jours_travail_semaine) || 6,
      is_active: empForm.statut === "actif",
      notes: empForm.notes || null,
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

  function openLeaveModal() {
    setLeaveForm({
      employee_id: employees[0]?.id ?? "",
      leave_type_id: leaveTypes[0]?.id ?? "",
      date_debut: "",
      date_fin: "",
      is_paid: leaveTypes[0]?.is_paid ?? true,
      notes: "",
    });
    setLeaveModal(true);
  }

  async function saveLeave() {
    if (!leaveForm.employee_id || !leaveForm.date_debut || !leaveForm.date_fin) {
      toast.error("Choisissez un employé et une période");
      return;
    }
    const selectedType = leaveTypes.find(t => t.id === leaveForm.leave_type_id);
    const jours = countWorkingDays(leaveForm.date_debut, leaveForm.date_fin, holidays);
    if (jours <= 0) {
      toast.error("La période ne contient aucun jour ouvrable");
      return;
    }
    setLeaveSaving(true);
    const employee = employees.find(e => e.id === leaveForm.employee_id);
    const dailyRate = Number(employee?.salaire_brut ?? 0) / 26;
    const { error } = await supabase.from("employee_leaves").insert(scopeInsert({
      employee_id: leaveForm.employee_id,
      leave_type_id: isUuid(leaveForm.leave_type_id) ? leaveForm.leave_type_id : null,
      date_debut: leaveForm.date_debut,
      date_fin: leaveForm.date_fin,
      nombre_jours: jours,
      statut: "approuvé",
      is_paid: leaveForm.is_paid,
      impact_salaire: leaveForm.is_paid ? 0 : Math.round(dailyRate * jours * 100) / 100,
      notes: leaveForm.notes || null,
    }));
    setLeaveSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${selectedType?.name ?? "Absence"} enregistrée`);
    setLeaveModal(false);
    loadLeaveData();
  }

  async function saveHours(employee: Employee, patch: Partial<EmployeeHours>) {
    setSavingHoursId(employee.id);
    const base = hoursRows[employee.id];
    const theoretical = Number(patch.heures_theoriques ?? base?.heures_theoriques ?? 191.33);
    const salary = Number(employee.salaire_brut ?? 0);
    const hourlyRate = theoretical > 0 ? salary / theoretical : 0;
    const h25 = Number(patch.heures_sup_25 ?? base?.heures_sup_25 ?? 0);
    const h50 = Number(patch.heures_sup_50 ?? base?.heures_sup_50 ?? 0);
    const h100 = Number(patch.heures_sup_100 ?? base?.heures_sup_100 ?? 0);
    const absenceHours = Number(patch.heures_absence ?? base?.heures_absence ?? 0);
    const payload = scopeInsert({
      employee_id: employee.id,
      mois: selectedMonth,
      annee: selectedYear,
      heures_theoriques: theoretical,
      heures_normales: Number(patch.heures_normales ?? base?.heures_normales ?? theoretical),
      heures_sup_25: h25,
      heures_sup_50: h50,
      heures_sup_100: h100,
      jours_absence: Number(patch.jours_absence ?? base?.jours_absence ?? 0),
      heures_absence: absenceHours,
      montant_heures_sup: Math.round((h25 * hourlyRate * 1.25 + h50 * hourlyRate * 1.5 + h100 * hourlyRate * 2) * 100) / 100,
      montant_absence_deduit: Math.round(absenceHours * hourlyRate * 100) / 100,
      notes: patch.notes ?? base?.notes ?? null,
    });
    const { data, error } = await supabase.from("employee_heures").upsert(payload, { onConflict: "employee_id,mois,annee" }).select().single();
    setSavingHoursId(null);
    if (error) { toast.error(error.message); return; }
    setHoursRows(prev => ({ ...prev, [employee.id]: data as EmployeeHours }));
    toast.success("Heures enregistrées");
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
        body: JSON.stringify({ mois: selectedMonth, annee: selectedYear, dossierId }),
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
    setActionLoading("cnss-pdf");
    try {
      const params = new URLSearchParams({
        mois: String(selectedMonth),
        annee: String(selectedYear),
        ...(dossierId ? { dossierId } : {}),
      });
      const res = await fetch(`/api/paie/cnss-declaration/pdf?${params.toString()}`);
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
    setActionLoading("cnss-excel");
    try {
      const params = new URLSearchParams({
        mois: String(selectedMonth),
        annee: String(selectedYear),
        ...(dossierId ? { dossierId } : {}),
      });
      const res = await fetch(`/api/paie/cnss-declaration/excel?${params.toString()}`);
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
        {tab === "conges" && (
          <button onClick={openLeaveModal} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[12.5px] font-medium text-white transition-colors" style={{ backgroundColor: "#C8924A" }}>
            <Plus size={14} /> Nouvelle absence
          </button>
        )}
        {tab === "bulletins" && bulletins.length > 0 && (
          <div className="flex gap-2">
            <button onClick={validateAll} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium text-[#1D4ED8] border border-[#BFDBFE] bg-[#EFF6FF] hover:bg-[#DBEAFE] transition-colors">
              <CheckCircle size={13} /> Tout valider
            </button>
          </div>
        )}
      </div>

      {/* Pill tabs */}
      <div className="flex gap-1 bg-[#F3F4F6] p-1 rounded-xl mb-5 w-fit">
        {([
          ["employes","Employés", Users],
          ["conges","Congés & Absences", CalendarDays],
          ["heures","Heures", Clock],
          ["bulletins","Bulletins", FileText],
          ["cnss","CNSS", FileText],
        ] as const).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-1.5 rounded-lg text-[12.5px] font-medium transition-all flex items-center gap-1.5 ${tab === key ? "bg-white text-[#1A1A2E] shadow-sm" : "text-[#6B7280] hover:text-[#1A1A2E]"}`}>
            <Icon size={13} /> {label}
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

      {/* ── TAB 2: CONGÉS ── */}
      {tab === "conges" && (
        <CongesTab
          employees={employees}
          leaveTypes={leaveTypes}
          leaves={leaves}
          holidays={holidays}
          holidayRows={holidayRows}
          loading={leavesLoading}
          periodLabel={periodLabel}
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          onPrev={prevMonth}
          onNext={nextMonth}
        />
      )}

      {/* ── TAB 3: HEURES ── */}
      {tab === "heures" && (
        <HeuresTab
          employees={employees}
          hoursRows={hoursRows}
          loading={hoursLoading}
          savingId={savingHoursId}
          periodLabel={periodLabel}
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          onPrev={prevMonth}
          onNext={nextMonth}
          onSave={saveHours}
        />
      )}

      {/* ── TAB 4: BULLETINS ── */}
      {tab === "bulletins" && (
        <div className="space-y-5">
          <BulletinsTab
            bulletins={bulletins}
            employees={employees}
            loading={bulletinsLoading}
            generating={generating}
            periodLabel={periodLabel}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            masseSalariale={masseSalariale}
            irTotal={irTotal}
            onPrev={prevMonth}
            onNext={nextMonth}
            onGenerate={generateBulletins}
            onUpdateStatus={updateBulletinStatus}
            onDelete={deleteBulletin}
            onDownloadPdf={downloadPdf}
            onValidateAll={validateAll}
          />
        </div>
      )}

      {/* ── TAB 5: CNSS ── */}
      {tab === "cnss" && (
        <CnssTab
          declaration={cnssDeclaration}
          loading={cnssDeclarationLoading}
          actionLoading={actionLoading}
          periodLabel={periodLabel}
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          onPrev={prevMonth}
          onNext={nextMonth}
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
      {leaveModal && (
        <LeaveModal
          employees={employees}
          leaveTypes={leaveTypes}
          form={leaveForm}
          holidays={holidays}
          saving={leaveSaving}
          onChange={(k: string, v: any) => {
            const patch: any = { [k]: v };
            if (k === "leave_type_id") {
              const t = leaveTypes.find(type => type.id === v);
              if (t) patch.is_paid = t.is_paid;
            }
            setLeaveForm((f: any) => ({ ...f, ...patch }));
          }}
          onSave={saveLeave}
          onClose={() => setLeaveModal(false)}
        />
      )}
    </div>
  );
}

// ─── Employés Tab ─────────────────────────────────────────────────────────────

function EmployesTab({ employees, loading, deletingId, onAdd, onEdit, onDelete, onViewBulletin }: any) {
  const [visibleSalaries, setVisibleSalaries] = useState<Set<string>>(new Set());

  function toggleSalary(employeeId: string) {
    setVisibleSalaries((current) => {
      const next = new Set(current);
      if (next.has(employeeId)) next.delete(employeeId);
      else next.add(employeeId);
      return next;
    });
  }

  if (loading) return (
    <div className="overflow-hidden rounded-xl border border-[rgba(0,0,0,0.07)] bg-white">
      <div className="h-11 animate-pulse bg-[#F3F4F6]" />
      {[1,2,3,4].map(i => <div key={i} className="h-16 animate-pulse border-t border-[rgba(0,0,0,0.05)] bg-white" />)}
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
    <div className="overflow-hidden rounded-xl border border-[rgba(0,0,0,0.08)] bg-white" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1050px] text-[12px]">
          <thead>
            <tr className="border-b border-[rgba(0,0,0,0.08)] bg-[#F9F9F6]">
              {["Employé", "Matricule", "Poste / Département", "Contrat", "Embauche", "N° CNSS", "Statut", "Salaire", "Actions"].map((heading) => (
                <th key={heading} className="whitespace-nowrap px-4 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-[0.4px] text-[#6B7280]">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.map((emp: Employee, index: number) => {
              const salaryVisible = visibleSalaries.has(emp.id);
              const calc = salaryVisible
                ? calculateSalary({ salaire_brut: Number(emp.salaire_brut), situation_familiale: emp.situation_familiale, nombre_enfants: Number(emp.nombre_enfants) })
                : null;
              return (
                <tr key={emp.id} className={`border-b border-[rgba(0,0,0,0.05)] last:border-b-0 hover:bg-[rgba(200,146,74,0.03)] ${index % 2 === 1 ? "bg-[#FAFAFA]" : ""}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1A1A2E] text-[10.5px] font-bold text-[#C8924A]">
                        {initials(emp.prenom, emp.nom)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-[#1A1A2E]">{emp.prenom} {emp.nom}</div>
                        <div className="max-w-[170px] truncate text-[10.5px] text-[#9CA3AF]">{emp.adresse || "Adresse non renseignée"}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-[#6B7280]">{emp.matricule || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-[#374151]">{emp.poste || "—"}</div>
                    <div className="text-[10.5px] text-[#9CA3AF]">{emp.departement || "Aucun département"}</div>
                  </td>
                  <td className="px-4 py-3 text-[#374151]">{emp.type_contrat || "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-[#6B7280]">{fmtDate(emp.date_embauche)}</td>
                  <td className="px-4 py-3 font-mono text-[11px] text-[#6B7280]">{emp.numero_cnss || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-1 text-[10.5px] font-semibold ${emp.statut === "actif" ? "bg-[#D1FAE5] text-[#065F46]" : "bg-[#F3F4F6] text-[#6B7280]"}`}>
                      {emp.statut || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {salaryVisible && calc ? (
                      <div className="min-w-[145px]">
                        <div className="font-semibold text-[#1A1A2E]">{fmtAmt(Number(emp.salaire_brut))} MAD</div>
                        <div className="text-[10.5px] font-medium text-[#059669]">Net estimé : ~{fmtAmt(calc.salaire_net_payer)} MAD</div>
                      </div>
                    ) : (
                      <span className="text-[11px] text-[#9CA3AF]">Masqué</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => toggleSalary(emp.id)} title={salaryVisible ? "Masquer le salaire" : "Afficher le salaire"} aria-label={salaryVisible ? "Masquer le salaire" : "Afficher le salaire"} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[rgba(0,0,0,0.1)] text-[#6B7280] transition-colors hover:bg-[#F3F4F6] hover:text-[#1A1A2E]">
                        {salaryVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                      <button onClick={() => onViewBulletin(emp)} title="Voir les bulletins" aria-label="Voir les bulletins" className="flex h-8 w-8 items-center justify-center rounded-lg border border-[rgba(0,0,0,0.1)] text-[#6B7280] transition-colors hover:bg-[#F3F4F6] hover:text-[#1A1A2E]">
                        <FileText size={13} />
                      </button>
                      <button onClick={() => onEdit(emp)} title="Modifier l'employé" aria-label="Modifier l'employé" className="flex h-8 w-8 items-center justify-center rounded-lg border border-[rgba(0,0,0,0.1)] text-[#6B7280] transition-colors hover:bg-[#F3F4F6] hover:text-[#1A1A2E]">
                        <Edit2 size={13} />
                      </button>
                      <button onClick={() => onDelete(emp.id)} disabled={deletingId === emp.id} title="Supprimer l'employé" aria-label="Supprimer l'employé" className="flex h-8 w-8 items-center justify-center rounded-lg border border-[rgba(220,38,38,0.2)] text-[#DC2626] transition-colors hover:bg-[#FEF2F2] disabled:opacity-50">
                        {deletingId === emp.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Congés & Absences Tab ───────────────────────────────────────────────────

function CongesTab({ employees, leaveTypes, leaves, holidays, holidayRows, loading, periodLabel, selectedMonth, selectedYear, onPrev, onNext }: any) {
  const monthPrefix = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`;
  const leavesByEmployee = new Map<string, EmployeeLeave[]>();
  for (const leave of leaves as EmployeeLeave[]) {
    const list = leavesByEmployee.get(leave.employee_id) ?? [];
    list.push(leave);
    leavesByEmployee.set(leave.employee_id, list);
  }

  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
  const calendarDays = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const iso = `${monthPrefix}-${String(day).padStart(2, "0")}`;
    const date = new Date(iso);
    const dayLeaves = (leaves as EmployeeLeave[]).filter(l => l.date_debut <= iso && l.date_fin >= iso);
    return { day, iso, isSunday: date.getDay() === 0, isHoliday: holidays.has(iso), dayLeaves };
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={onPrev} className="w-8 h-8 flex items-center justify-center rounded-lg border border-[rgba(0,0,0,0.1)] hover:bg-[#F3F4F6] transition-colors">
            <ChevronLeft size={16} />
          </button>
          <span className="text-[14px] font-semibold text-[#1A1A2E] min-w-[130px] text-center">{periodLabel}</span>
          <button onClick={onNext} className="w-8 h-8 flex items-center justify-center rounded-lg border border-[rgba(0,0,0,0.1)] hover:bg-[#F3F4F6] transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Absences du mois", value: leaves.length, color: "#1A1A2E" },
          { label: "Jours déclarés", value: leaves.reduce((s: number, l: EmployeeLeave) => s + Number(l.nombre_jours), 0), color: "#C8924A" },
          { label: "Sans solde", value: leaves.filter((l: EmployeeLeave) => !l.is_paid).length, color: "#DC2626" },
          { label: "Jours fériés", value: calendarDays.filter(d => d.isHoliday).length, color: "#059669" },
        ].map(card => (
          <div key={card.label} className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl p-3.5">
            <div className="text-[10.5px] text-[#9CA3AF] uppercase tracking-[0.4px] mb-1.5">{card.label}</div>
            <div className="text-[20px] font-bold" style={{ color: card.color }}>{card.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-4 items-start">
        <div className="space-y-4 min-w-0">
          <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[rgba(0,0,0,0.07)] flex items-center justify-between">
            <h2 className="text-[13px] font-semibold text-[#1A1A2E]">Calendrier des absences</h2>
            <div className="flex flex-wrap gap-2 text-[10.5px] text-[#6B7280]">
              {leaveTypes.slice(0, 5).map((t: LeaveType) => (
                <span key={t.id ?? t.name} className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ background: t.color ?? "#C8924A" }} /> {t.name}
                </span>
              ))}
            </div>
          </div>
          {loading ? (
            <div className="h-40 animate-pulse bg-[#F9F9F6]" />
          ) : (
            <div className="grid grid-cols-7 gap-px bg-[rgba(0,0,0,0.06)] text-[11px]">
              {calendarDays.map(day => (
                <div key={day.iso} className={`min-h-[74px] p-2 ${day.isSunday ? "bg-[#F3F4F6]" : day.isHoliday ? "bg-[#FEF3C7]" : "bg-white"}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-[#1A1A2E]">{day.day}</span>
                    {day.isHoliday && <span className="text-[9px] text-[#92400E]">Férié</span>}
                  </div>
                  <div className="space-y-1">
                    {day.dayLeaves.slice(0, 3).map((leave: EmployeeLeave) => (
                      <div key={leave.id} className="truncate rounded px-1.5 py-0.5 text-[10px] text-white"
                        style={{ background: leave.leave_types?.color ?? "#C8924A" }}>
                        {leave.employees?.prenom?.[0] ?? ""}. {leave.employees?.nom ?? ""}
                      </div>
                    ))}
                    {day.dayLeaves.length > 3 && <div className="text-[9px] text-[#6B7280]">+{day.dayLeaves.length - 3}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>

          <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[rgba(0,0,0,0.07)]">
              <h2 className="text-[13px] font-semibold text-[#1A1A2E]">Résumé mensuel</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px] min-w-[620px]">
                <thead>
                  <tr className="bg-[#F9F9F6]">
                    {["Employé", "Congés/absences", "Jours", "Sans solde", "Impact salaire"].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 text-[10.5px] font-semibold text-[#6B7280] uppercase tracking-[0.4px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp: Employee) => {
                    const empLeaves = leavesByEmployee.get(emp.id) ?? [];
                    const unpaid = empLeaves.filter(l => !l.is_paid);
                    return (
                      <tr key={emp.id} className="border-t border-[rgba(0,0,0,0.05)]">
                        <td className="px-4 py-3 font-medium text-[#1A1A2E]">{emp.prenom} {emp.nom}</td>
                        <td className="px-4 py-3 text-[#6B7280]">{empLeaves.length}</td>
                        <td className="px-4 py-3 text-[#374151]">{empLeaves.reduce((s, l) => s + Number(l.nombre_jours), 0)}</td>
                        <td className="px-4 py-3 text-[#DC2626]">{unpaid.reduce((s, l) => s + Number(l.nombre_jours), 0)}</td>
                        <td className="px-4 py-3 text-[#DC2626]">{fmtAmt(unpaid.reduce((s, l) => s + Number(l.impact_salaire), 0))} MAD</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[rgba(0,0,0,0.07)]">
            <h2 className="text-[13px] font-semibold text-[#1A1A2E]">Jours fériés {selectedYear}</h2>
            <p className="text-[11px] text-[#9CA3AF] mt-0.5">Dates nationales enregistrées</p>
          </div>
          {loading ? (
            <div className="h-40 animate-pulse bg-[#F9F9F6]" />
          ) : holidayRows.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <CalendarDays size={28} className="text-[#D1D5DB] mx-auto mb-2" />
              <p className="text-[12.5px] text-[#6B7280]">Aucun jour férié enregistré</p>
            </div>
          ) : (
            <div className="divide-y divide-[rgba(0,0,0,0.05)] max-h-[520px] overflow-y-auto">
              {holidayRows.map((holiday: Holiday) => {
                const date = new Date(holiday.date);
                const isThisMonth = date.getMonth() + 1 === selectedMonth;
                return (
                  <div key={holiday.id ?? holiday.date} className={`px-4 py-3 ${isThisMonth ? "bg-[#FFFBEB]" : "bg-white"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[12.5px] font-semibold text-[#1A1A2E] leading-tight">{holiday.name}</p>
                        {holiday.name_ar && <p className="text-[11px] text-[#9CA3AF] mt-0.5">{holiday.name_ar}</p>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-[12px] font-semibold text-[#C8924A]">
                          {date.toLocaleDateString("fr-MA", { day: "2-digit", month: "short" })}
                        </p>
                        <p className="text-[10px] text-[#9CA3AF]">
                          {date.toLocaleDateString("fr-MA", { weekday: "short" })}
                        </p>
                      </div>
                    </div>
                    {isThisMonth && (
                      <span className="inline-block mt-2 rounded-full bg-[#FEF3C7] px-2 py-0.5 text-[10px] font-semibold text-[#92400E]">
                        Ce mois
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

// ─── Heures Tab ──────────────────────────────────────────────────────────────

function HeuresTab({ employees, hoursRows, loading, savingId, periodLabel, selectedMonth, selectedYear, onPrev, onNext, onSave }: any) {
  const [drafts, setDrafts] = useState<Record<string, any>>({});

  useEffect(() => { setDrafts({}); }, [selectedMonth, selectedYear, hoursRows]);

  function valueFor(emp: Employee, field: keyof EmployeeHours, fallback: number) {
    return drafts[emp.id]?.[field] ?? hoursRows[emp.id]?.[field] ?? fallback;
  }

  function patch(empId: string, field: string, value: string) {
    setDrafts(prev => ({ ...prev, [empId]: { ...(prev[empId] ?? {}), [field]: value === "" ? "" : Number(value) } }));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={onPrev} className="w-8 h-8 flex items-center justify-center rounded-lg border border-[rgba(0,0,0,0.1)] hover:bg-[#F3F4F6] transition-colors">
            <ChevronLeft size={16} />
          </button>
          <span className="text-[14px] font-semibold text-[#1A1A2E] min-w-[130px] text-center">{periodLabel}</span>
          <button onClick={onNext} className="w-8 h-8 flex items-center justify-center rounded-lg border border-[rgba(0,0,0,0.1)] hover:bg-[#F3F4F6] transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="text-[11.5px] text-[#6B7280]">Heures supplémentaires: 25%, 50%, 100%</div>
      </div>

      <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] min-w-[920px]">
            <thead>
              <tr className="bg-[#F9F9F6]">
                {["Employé", "Théoriques", "Travaillées", "H.Sup 25%", "H.Sup 50%", "H.Sup 100%", "Absences", "Montant H.Sup", "Retenue", "Action"].map(h => (
                  <th key={h} className="text-left px-3 py-2.5 text-[10.5px] font-semibold text-[#6B7280] uppercase tracking-[0.4px]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="px-4 py-10 text-center text-[#6B7280]">Chargement...</td></tr>
              ) : employees.map((emp: Employee) => {
                const theoretical = Number(valueFor(emp, "heures_theoriques", 191.33));
                const normal = Number(valueFor(emp, "heures_normales", theoretical));
                const h25 = Number(valueFor(emp, "heures_sup_25", 0));
                const h50 = Number(valueFor(emp, "heures_sup_50", 0));
                const h100 = Number(valueFor(emp, "heures_sup_100", 0));
                const absence = Number(valueFor(emp, "heures_absence", 0));
                const hourly = theoretical > 0 ? Number(emp.salaire_brut) / theoretical : 0;
                const overtimeAmount = h25 * hourly * 1.25 + h50 * hourly * 1.5 + h100 * hourly * 2;
                const absenceAmount = absence * hourly;
                return (
                  <tr key={emp.id} className="border-t border-[rgba(0,0,0,0.05)]">
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-[#1A1A2E]">{emp.prenom} {emp.nom}</div>
                      <div className="text-[10.5px] text-[#9CA3AF]">{emp.heures_travail_semaine ?? 44}h/semaine</div>
                    </td>
                    {[
                      ["heures_theoriques", theoretical],
                      ["heures_normales", normal],
                      ["heures_sup_25", h25],
                      ["heures_sup_50", h50],
                      ["heures_sup_100", h100],
                      ["heures_absence", absence],
                    ].map(([field, value]) => (
                      <td key={field} className="px-3 py-2.5">
                        <input type="number" step="0.01" className="input h-8 w-20 text-[12px]"
                          value={drafts[emp.id]?.[field as string] ?? value}
                          onChange={e => patch(emp.id, field as string, e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") onSave(emp, drafts[emp.id] ?? {}); }}
                        />
                      </td>
                    ))}
                    <td className="px-3 py-2.5 font-semibold text-[#059669]">{fmtAmt(overtimeAmount)} MAD</td>
                    <td className="px-3 py-2.5 font-semibold text-[#DC2626]">{fmtAmt(absenceAmount)} MAD</td>
                    <td className="px-3 py-2.5">
                      <button onClick={() => onSave(emp, drafts[emp.id] ?? {})} disabled={savingId === emp.id}
                        className="btn btn-outline btn-sm">
                        {savingId === emp.id ? "..." : "Enregistrer"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Bulletins Tab ────────────────────────────────────────────────────────────

function BulletinsTab({ bulletins, employees, loading, generating, periodLabel, selectedMonth, selectedYear, masseSalariale, irTotal, onPrev, onNext, onGenerate, onUpdateStatus, onDelete, onDownloadPdf }: any) {
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
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => onDownloadPdf(b.id, `${(b.employees as any)?.prenom}_${(b.employees as any)?.nom}`)}
                          title="Télécharger PDF"
                          className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-[#374151] border border-[rgba(0,0,0,0.1)] hover:bg-[#F9F9F6] transition-colors"
                        >
                          <FileText size={14} />
                        </button>
                        {b.statut === "brouillon" && (
                          <button
                            onClick={() => onUpdateStatus(b.id, "validé")}
                            title="Valider"
                            className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-[#1D4ED8] border border-[#BFDBFE] bg-[#EFF6FF] hover:bg-[#DBEAFE] transition-colors"
                          >
                            <CheckCircle size={14} />
                          </button>
                        )}
                        {b.statut === "validé" && (
                          <button
                            onClick={() => onUpdateStatus(b.id, "payé")}
                            title="Marquer comme payé"
                            className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-[#059669] border border-[#BBF7D0] bg-[#F0FDF4] hover:bg-[#DCFCE7] transition-colors"
                          >
                            <DollarSign size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => onDelete(b.id)}
                          title="Supprimer"
                          className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-[#DC2626] border border-[#FECACA] bg-[#FEF2F2] hover:bg-[#FEE2E2] transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
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

    </div>
  );
}

// ─── CNSS Tab ─────────────────────────────────────────────────────────────────

function CnssTab({ declaration, loading, actionLoading, periodLabel, onPrev, onNext, onDownloadPdf, onDownloadExcel }: any) {
  const rows = declaration?.employees ?? [];
  const totals = declaration?.totals ?? {};
  const missing = declaration?.missing_bulletins ?? [];
  const amoTotal = Number(totals.total_amo_salarie ?? 0) + Number(totals.total_amo_patronal ?? 0);
  const cards = [
    { label: "Total CNSS salarié", value: totals.total_cnss_salarie ?? 0, color: "#1A1A2E" },
    { label: "Total CNSS patronal", value: totals.total_cnss_patronal ?? 0, color: "#1A1A2E" },
    { label: "Total AMO (salarié + patronal)", value: amoTotal, color: "#C8924A" },
    { label: "Total à verser à la CNSS", value: totals.total_cotisations ?? 0, color: "#1A1A2E", large: true },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-bold text-[#1A1A2E]">Déclaration CNSS</h2>
          <p className="text-[12px] text-[#6B7280] mt-0.5">État mensuel pour Damancom</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={onPrev} className="w-8 h-8 flex items-center justify-center rounded-lg border border-[rgba(0,0,0,0.1)] hover:bg-[#F3F4F6] transition-colors">
            <ChevronLeft size={16} />
          </button>
          <span className="text-[14px] font-semibold text-[#1A1A2E] min-w-[130px] text-center">{periodLabel}</span>
          <button onClick={onNext} className="w-8 h-8 flex items-center justify-center rounded-lg border border-[rgba(0,0,0,0.1)] hover:bg-[#F3F4F6] transition-colors">
            <ChevronRight size={16} />
          </button>
          <button onClick={onDownloadExcel} disabled={actionLoading === "cnss-excel" || loading} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium text-[#374151] border border-[rgba(0,0,0,0.12)] bg-white hover:bg-[#F9F9F6] transition-colors disabled:opacity-50">
            {actionLoading === "cnss-excel" ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} Exporter Excel
          </button>
          <button onClick={onDownloadPdf} disabled={actionLoading === "cnss-pdf" || loading} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium text-white transition-colors disabled:opacity-50" style={{ backgroundColor: "#1A1A2E" }}>
            {actionLoading === "cnss-pdf" ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} Télécharger PDF
          </button>
        </div>
      </div>

      {loading && <div className="h-48 bg-white rounded-xl border animate-pulse" />}

      {!loading && declaration && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {cards.map(card => (
              <div key={card.label} className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl p-3.5">
                <div className="text-[10.5px] text-[#9CA3AF] uppercase tracking-[0.4px] mb-1.5">{card.label}</div>
                <div className={`${card.large ? "text-[20px]" : "text-[16px]"} font-bold`} style={{ color: card.color }}>{fmtAmt(Number(card.value))} MAD</div>
              </div>
            ))}
          </div>

          <div className={`rounded-xl px-4 py-3 text-[12px] border ${
            rows.length === 0 ? "bg-[#F3F4F6] border-[#E5E7EB] text-[#6B7280]" :
            missing.length === 0 ? "bg-[#ECFDF5] border-[#A7F3D0] text-[#065F46]" :
            "bg-[#FFFBEB] border-[#FDE68A] text-[#92400E]"
          }`}>
            {rows.length === 0 ? `Aucun bulletin validé pour ${periodLabel}` :
              missing.length === 0 ? "Déclaration prête — tous les bulletins sont validés" :
              `${missing.length} employé(s) n'ont pas de bulletin validé ce mois. Les bulletins non validés ne sont pas inclus.`}
          </div>

          <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] border-collapse min-w-[1180px]">
                <thead>
                  <tr className="bg-[#1A1A2E] text-white">
                    {["N°","Matricule CNSS","Nom","Prénom","Jours déclarés","Salaire brut","Salaire plafonné","CNSS salarié (4.48%)","CNSS patronal (21.09%)","AMO salarié (2.26%)","AMO patronal (4.11%)","Total cotisations"].map(h => (
                      <th key={h} className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.3px] whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r: any) => (
                    <tr key={`${r.n}-${r.nom}-${r.prenom}`} className="border-b border-[rgba(0,0,0,0.05)]">
                      <td className="px-3 py-2">{r.n}</td>
                      <td className="px-3 py-2 font-mono">{r.matricule_cnss || "—"}</td>
                      <td className="px-3 py-2 font-medium text-[#1A1A2E]">{r.nom}</td>
                      <td className="px-3 py-2">{r.prenom}</td>
                      <td className="px-3 py-2 text-right">{r.jours_declares}</td>
                      <td className="px-3 py-2 text-right">{fmtAmt(r.salaire_brut)}</td>
                      <td className="px-3 py-2 text-right">{fmtAmt(r.salaire_plafonne)}</td>
                      <td className="px-3 py-2 text-right">{fmtAmt(r.cnss_salarie)}</td>
                      <td className="px-3 py-2 text-right">{fmtAmt(r.cnss_patronal)}</td>
                      <td className="px-3 py-2 text-right">{fmtAmt(r.amo_salarie)}</td>
                      <td className="px-3 py-2 text-right">{fmtAmt(r.amo_patronal)}</td>
                      <td className="px-3 py-2 text-right font-semibold">{fmtAmt(r.total_cotisations)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-white text-[#1A1A2E] font-bold border-t border-[rgba(0,0,0,0.05)]">
                    <td className="px-3 py-2.5">TOTAL</td>
                    <td colSpan={3} />
                    <td className="px-3 py-2.5 text-right">{totals.total_jours ?? 0}</td>
                    <td className="px-3 py-2.5 text-right">{fmtAmt(totals.total_brut ?? 0)}</td>
                    <td className="px-3 py-2.5 text-right">{fmtAmt(totals.total_plafonne ?? 0)}</td>
                    <td className="px-3 py-2.5 text-right">{fmtAmt(totals.total_cnss_salarie ?? 0)}</td>
                    <td className="px-3 py-2.5 text-right">{fmtAmt(totals.total_cnss_patronal ?? 0)}</td>
                    <td className="px-3 py-2.5 text-right">{fmtAmt(totals.total_amo_salarie ?? 0)}</td>
                    <td className="px-3 py-2.5 text-right">{fmtAmt(totals.total_amo_patronal ?? 0)}</td>
                    <td className="px-3 py-2.5 text-right">{fmtAmt(totals.total_cotisations ?? 0)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Leave Modal ──────────────────────────────────────────────────────────────

function LeaveModal({ employees, leaveTypes, form, holidays, saving, onChange, onSave, onClose }: any) {
  const days = countWorkingDays(form.date_debut, form.date_fin, holidays);
  const selectedType = leaveTypes.find((t: LeaveType) => t.id === form.leave_type_id);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(0,0,0,0.07)]">
          <h2 className="text-[15px] font-bold text-[#1A1A2E]">Nouvelle absence / congé</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-[#9CA3AF] hover:bg-[#F3F4F6]">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <Field label="Employé">
            <select className="input" value={form.employee_id} onChange={e => onChange("employee_id", e.target.value)}>
              {employees.map((emp: Employee) => <option key={emp.id} value={emp.id}>{emp.prenom} {emp.nom}</option>)}
            </select>
          </Field>

          <Field label="Type d'absence">
            <select className="input" value={form.leave_type_id} onChange={e => onChange("leave_type_id", e.target.value)}>
              {leaveTypes.map((type: LeaveType) => (
                <option key={type.id ?? type.name} value={type.id}>{type.name}</option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Date début">
              <input type="date" className="input" value={form.date_debut} onChange={e => onChange("date_debut", e.target.value)} />
            </Field>
            <Field label="Date fin">
              <input type="date" className="input" value={form.date_fin} onChange={e => onChange("date_fin", e.target.value)} />
            </Field>
          </div>

          <div className="rounded-xl bg-[#F9F9F6] border border-[rgba(0,0,0,0.07)] p-3 text-[12px]">
            <div className="flex items-center justify-between">
              <span className="text-[#6B7280]">Jours ouvrables calculés</span>
              <span className="font-bold text-[#1A1A2E]">{days} jour{days > 1 ? "s" : ""}</span>
            </div>
            <p className="text-[11px] text-[#9CA3AF] mt-1">
              Dimanches et jours fériés nationaux exclus automatiquement.
            </p>
          </div>

          <label className="flex items-center gap-2 text-[12.5px] font-medium text-[#374151] cursor-pointer">
            <input type="checkbox" checked={form.is_paid} onChange={e => onChange("is_paid", e.target.checked)} />
            Absence payée {selectedType ? `(${selectedType.name})` : ""}
          </label>

          <Field label="Notes">
            <textarea className="input resize-none h-20" value={form.notes} onChange={e => onChange("notes", e.target.value)} />
          </Field>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[rgba(0,0,0,0.07)]">
          <button onClick={onClose} className="btn btn-outline">Annuler</button>
          <button onClick={onSave} disabled={saving || days <= 0} className="btn btn-gold">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Enregistrer
          </button>
        </div>
      </div>
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
              <Field label="Matricule">
                <input className="input" value={form.matricule} onChange={e => onChange("matricule", e.target.value)} />
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
              <div className="col-span-2">
                <Field label="Adresse">
                  <input className="input" value={form.adresse} onChange={e => onChange("adresse", e.target.value)} placeholder="Rue, quartier, ville..." />
                </Field>
              </div>
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
                  {["CDI","CDD","Intérimaire","Stagiaire"].map(c => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Fin contrat">
                <input type="date" className="input" value={form.date_fin_contrat} onChange={e => onChange("date_fin_contrat", e.target.value)} />
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
              <Field label="Mode de paiement">
                <select className="input" value={form.mode_paiement} onChange={e => onChange("mode_paiement", e.target.value)}>
                  {["virement","chèque","espèces"].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </Field>
              <Field label="Banque">
                <input className="input" value={form.banque} onChange={e => onChange("banque", e.target.value)} />
              </Field>
              <Field label="RIB">
                <input className="input" value={form.rib} onChange={e => onChange("rib", e.target.value)} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Heures/semaine">
                <input type="number" step="0.5" className="input" value={form.heures_travail_semaine} onChange={e => onChange("heures_travail_semaine", e.target.value)} />
              </Field>
              <Field label="Jours/semaine">
                <input type="number" step="0.5" className="input" value={form.jours_travail_semaine} onChange={e => onChange("jours_travail_semaine", e.target.value)} />
              </Field>
            </div>

            <Field label="Notes">
              <textarea className="input resize-none h-20" value={form.notes} onChange={e => onChange("notes", e.target.value)} />
            </Field>

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
