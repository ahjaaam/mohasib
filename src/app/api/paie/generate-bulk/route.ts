import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calculateSalary } from "@/lib/payroll";
import { authorizePermission } from "@/lib/api-permissions";
import { requirePlanFeature } from "@/lib/api-plan";
import { enforcePeriodLock } from "@/lib/period-check";
import {
  getEmployeePayrollEligibility,
  PAYROLL_ELIGIBILITY_LABELS,
} from "@/lib/paie/employment-period";

const MONTHS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const mois = Number(body.mois);
    const annee = Number(body.annee);
    const dossierId = body.dossierId;
    if (!Number.isInteger(mois) || mois < 1 || mois > 12 || !Number.isInteger(annee) || annee < 1900 || annee > 9999)
      return NextResponse.json({ error: "Période de paie invalide" }, { status: 400 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    const permission = await authorizePermission("bulletin_paie", "validate", { dossierId });
    if (permission.response) return permission.response;
    const plan = await requirePlanFeature("paie");
    if (plan.response) return plan.response;

    let empQuery = supabase
      .from("employees")
      .select("*")
      .eq("user_id", user.id);
    if (dossierId) empQuery = (empQuery as any).eq("dossier_id", dossierId);
    else empQuery = (empQuery as any).is("dossier_id", null);

    const { data: employees, error: empErr } = await empQuery;

    if (empErr) return NextResponse.json({ error: empErr.message }, { status: 500 });
    if (!employees?.length)
      return NextResponse.json({ error: "Aucun salarié dans ce dossier" }, { status: 422 });

    const eligibleEmployees = [];
    const skipped = [];
    for (const employee of employees) {
      const eligibility = getEmployeePayrollEligibility(employee, mois, annee);
      if (eligibility.eligible) {
        eligibleEmployees.push(employee);
      } else {
        skipped.push({
          employee_id: employee.id,
          name: `${employee.prenom ?? ""} ${employee.nom ?? ""}`.trim(),
          reason: eligibility.reason,
          message: PAYROLL_ELIGIBILITY_LABELS[eligibility.reason],
        });
      }
    }

    const period_label = `${MONTHS[mois - 1]} ${annee}`;
    if (!eligibleEmployees.length) {
      return NextResponse.json({
        error: `Aucun salarié éligible pour ${period_label}`,
        count: 0,
        skipped,
        period_label,
      }, { status: 422 });
    }

    const { data: company } = await supabase
      .from("companies")
      .select("id")
      .eq("user_id", user.id)
      .single();
    const locked = await enforcePeriodLock(mois, annee, company?.id ?? null);
    if (locked) return locked;

    const employeeIds = eligibleEmployees.map((employee) => employee.id);
    const { data: finalizedBulletins, error: finalizedErr } = await supabase
      .from("bulletins_paie")
      .select("employee_id, statut")
      .eq("mois", mois)
      .eq("annee", annee)
      .in("employee_id", employeeIds)
      .in("statut", ["validé", "payé"]);
    if (finalizedErr) return NextResponse.json({ error: finalizedErr.message }, { status: 500 });

    const finalizedIds = new Set((finalizedBulletins ?? []).map((bulletin) => bulletin.employee_id));
    for (const bulletin of finalizedBulletins ?? []) {
      const employee = eligibleEmployees.find((item) => item.id === bulletin.employee_id);
      skipped.push({
        employee_id: bulletin.employee_id,
        name: `${employee?.prenom ?? ""} ${employee?.nom ?? ""}`.trim(),
        reason: "finalized_bulletin",
        message: bulletin.statut === "payé" ? "Bulletin déjà payé" : "Bulletin déjà validé",
      });
    }

    const employeesToGenerate = eligibleEmployees.filter((employee) => !finalizedIds.has(employee.id));
    const rows = employeesToGenerate.map((emp) => {
      const calc = calculateSalary({
        salaire_brut: Number(emp.salaire_brut),
        situation_familiale: emp.situation_familiale ?? "Célibataire",
        nombre_enfants: Number(emp.nombre_enfants ?? 0),
      });
      return {
        employee_id: emp.id,
        company_id: company?.id ?? null,
        ...(dossierId ? { dossier_id: dossierId } : {}),
        mois, annee, period_label,
        salaire_brut: calc.salaire_brut,
        heures_sup: calc.heures_sup,
        primes: calc.primes,
        indemnites: calc.indemnites,
        cnss_salarie: calc.cnss_salarie,
        amo_salarie: calc.amo_salarie,
        frais_pro: calc.frais_pro,
        salaire_net_imposable: calc.salaire_net_imposable,
        ir_brut: calc.ir_mensuel_brut,
        deduction_charge_famille: calc.deduction_charge_famille,
        ir_net: calc.ir_net,
        salaire_net_payer: calc.salaire_net_payer,
        cnss_patronal: calc.cnss_patronal,
        amo_patronal: calc.amo_patronal,
        taxe_formation_pro: calc.taxe_formation_pro,
        cout_total_employeur: calc.cout_total_employeur,
        statut: "brouillon",
      };
    });

    if (rows.length) {
      const { error: upsertErr } = await supabase
        .from("bulletins_paie")
        .upsert(rows, { onConflict: "employee_id,mois,annee", ignoreDuplicates: false });

      if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 });
    }
    return NextResponse.json({ count: rows.length, skipped, period_label });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
