import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { authorizePermission } from "@/lib/api-permissions";
import { requirePlanFeature } from "@/lib/api-plan";
import { enforcePeriodLock } from "@/lib/period-check";

function validPeriod(mois: number, annee: number) {
  return Number.isInteger(mois) && mois >= 1 && mois <= 12 && Number.isInteger(annee) && annee >= 1900 && annee <= 9999;
}

export async function POST(req: NextRequest) {
  try {
    const plan = await requirePlanFeature("paie");
    if (plan.response) return plan.response;
    const body = await req.json();
    const supabase = await createClient();
    let employeeId = body.employee_id;
    let record: any = null;
    if (body.action === "delete_earning") {
      const result = await supabase.from("employee_primes").select("*").eq("id", body.id).single();
      if (result.error || !result.data) return NextResponse.json({ error: "Élément introuvable" }, { status: 404 });
      record = result.data;
      employeeId = record.employee_id;
    }
    const { data: employee, error: employeeError } = await supabase.from("employees").select("id,company_id,dossier_id").eq("id", employeeId).single();
    if (employeeError || !employee) return NextResponse.json({ error: "Employé introuvable" }, { status: 404 });
    const permission = await authorizePermission("bulletin_paie", "validate", { companyId: employee.company_id, dossierId: employee.dossier_id });
    if (permission.response) return permission.response;

    const mois = Number(record?.mois ?? body.mois);
    const annee = Number(record?.annee ?? body.annee);
    if (!validPeriod(mois, annee)) return NextResponse.json({ error: "Période de paie invalide" }, { status: 400 });
    const locked = await enforcePeriodLock(mois, annee, employee.company_id, employee.dossier_id);
    if (locked) return locked;
    const scope = { company_id: employee.company_id, dossier_id: employee.dossier_id };

    if (body.action === "upsert_hours") {
      const numeric = (key: string) => Math.max(0, Number(body[key] ?? 0));
      const theoretical = numeric("heures_theoriques");
      if (!theoretical || !Number.isFinite(theoretical)) return NextResponse.json({ error: "Heures théoriques invalides" }, { status: 400 });
      const payload = { employee_id: employeeId, mois, annee, ...scope, heures_theoriques: theoretical, heures_normales: numeric("heures_normales"), heures_sup_25: numeric("heures_sup_25"), heures_sup_50: numeric("heures_sup_50"), heures_sup_100: numeric("heures_sup_100"), jours_absence: numeric("jours_absence"), heures_absence: numeric("heures_absence"), montant_heures_sup: numeric("montant_heures_sup"), montant_absence_deduit: numeric("montant_absence_deduit"), notes: body.notes || null };
      const { data, error } = await supabase.from("employee_heures").upsert(payload, { onConflict: "employee_id,mois,annee" }).select().single();
      if (error) throw error;
      return NextResponse.json({ data });
    }
    if (body.action === "create_earning") {
      const montant = Number(body.montant);
      if (!["prime", "indemnite"].includes(body.prime_type) || !String(body.label ?? "").trim() || !Number.isFinite(montant) || montant <= 0) return NextResponse.json({ error: "Élément variable invalide" }, { status: 400 });
      const { data, error } = await supabase.from("employee_primes").insert({ employee_id: employeeId, mois, annee, ...scope, prime_type: body.prime_type, label: String(body.label).trim(), montant: Math.round(montant * 100) / 100, is_imposable: body.is_imposable === true, is_soumis_cnss: body.is_soumis_cnss === true }).select().single();
      if (error) throw error;
      return NextResponse.json({ data });
    }
    if (body.action === "delete_earning") {
      const { error } = await supabase.from("employee_primes").delete().eq("id", body.id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }
    if (body.action === "create_leave") {
      const jours = Number(body.nombre_jours);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date_debut ?? "") || !/^\d{4}-\d{2}-\d{2}$/.test(body.date_fin ?? "") || body.date_fin < body.date_debut || !Number.isFinite(jours) || jours <= 0) return NextResponse.json({ error: "Absence invalide" }, { status: 400 });
      const startYear = Number(body.date_debut.slice(0, 4));
      const startMonth = Number(body.date_debut.slice(5, 7));
      const endYear = Number(body.date_fin.slice(0, 4));
      const endMonth = Number(body.date_fin.slice(5, 7));
      const startLock = await enforcePeriodLock(startMonth, startYear, employee.company_id, employee.dossier_id);
      if (startLock) return startLock;
      if (startMonth !== endMonth || startYear !== endYear) {
        const endLock = await enforcePeriodLock(endMonth, endYear, employee.company_id, employee.dossier_id);
        if (endLock) return endLock;
      }
      const { data, error } = await supabase.from("employee_leaves").insert({ employee_id: employeeId, ...scope, leave_type_id: body.leave_type_id || null, date_debut: body.date_debut, date_fin: body.date_fin, nombre_jours: jours, statut: "approuvé", is_paid: body.is_paid === true, impact_salaire: body.is_paid ? 0 : Math.max(0, Number(body.impact_salaire ?? 0)), notes: body.notes || null }).select().single();
      if (error) throw error;
      return NextResponse.json({ data });
    }
    return NextResponse.json({ error: "Action de paie inconnue" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
