import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calculateSalary, isSupportedPayrollYear } from "@/lib/payroll";
import { authorizePermission } from "@/lib/api-permissions";
import { requirePlanFeature } from "@/lib/api-plan";
import { createVersion, getDiff, logAccountingEvent, logAudit } from "@/lib/audit";
import { getRequestMeta } from "@/lib/request-meta";
import { enforcePeriodLock } from "@/lib/period-check";
import { getEmployeePayrollEligibility, PAYROLL_ELIGIBILITY_LABELS } from "@/lib/paie/employment-period";
import { loadPayrollVariables, payrollBulletinDetailFields, recalculatePayrollVariableAmounts } from "@/lib/paie/payroll-variables";
import { loadPayrollStatutorySettings } from "@/lib/paie/statutory-settings";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const employee_id = body.employee_id;
    const mois = Number(body.mois);
    const annee = Number(body.annee);
    if (!employee_id || !Number.isInteger(mois) || mois < 1 || mois > 12 || !Number.isInteger(annee) || !isSupportedPayrollYear(annee))
      return NextResponse.json({ error: "Paramètres de paie invalides" }, { status: 400 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    const plan = await requirePlanFeature("paie");
    if (plan.response) return plan.response;

    const { data: emp, error: empErr } = await supabase
      .from("employees")
      .select("*")
      .eq("id", employee_id)
      .single();

    if (empErr || !emp)
      return NextResponse.json({ error: "Employé introuvable" }, { status: 404 });
    const permission = await authorizePermission("bulletin_paie", "validate", {
      companyId: emp.company_id ?? null,
      dossierId: emp.dossier_id ?? null,
    });
    if (permission.response) return permission.response;

    const eligibility = getEmployeePayrollEligibility(emp, mois, annee);
    if (!eligibility.eligible) {
      return NextResponse.json({
        error: `Bulletin impossible : ${PAYROLL_ELIGIBILITY_LABELS[eligibility.reason].toLowerCase()}`,
        reason: eligibility.reason,
      }, { status: 422 });
    }

    const months = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
    const period_label = `${months[mois - 1]} ${annee}`;

    const companyId = emp.dossier_id ? null : emp.company_id ?? null;
    const statutorySettings = await loadPayrollStatutorySettings(supabase, {
      companyId,
      dossierId: emp.dossier_id ?? null,
    });
    const locked = await enforcePeriodLock(Number(mois), Number(annee), companyId, emp.dossier_id ?? null);
    if (locked) return locked;

    const { data: oldBulletin } = await supabase
      .from("bulletins_paie")
      .select("*")
      .eq("employee_id", employee_id)
      .eq("mois", mois)
      .eq("annee", annee)
      .maybeSingle();
    if (oldBulletin?.statut === "validé" || oldBulletin?.statut === "payé") {
      return NextResponse.json({
        error: oldBulletin.statut === "payé"
          ? "Ce bulletin est déjà payé et ne peut pas être régénéré"
          : "Ce bulletin est déjà validé et ne peut pas être régénéré",
      }, { status: 409 });
    }

    const variablesByEmployee = await loadPayrollVariables(supabase, [employee_id], mois, annee);
    const variables = recalculatePayrollVariableAmounts(variablesByEmployee.get(employee_id)!, Number(emp.salaire_brut));
    const calc = calculateSalary({
      salaire_brut: Number(emp.salaire_brut),
      situation_familiale: emp.situation_familiale ?? "Célibataire",
      nombre_enfants: Number(emp.nombre_enfants ?? 0),
      heures_sup: variables.montant_heures_sup,
      primes: variables.primes,
      indemnites: variables.indemnites,
      retenue_absence: variables.montant_absence_deduit,
      elements_imposables: variables.elements_imposables,
      elements_soumis_cnss: variables.elements_soumis_cnss,
      mois,
      annee,
      date_embauche: emp.date_embauche,
      date_fin_contrat: emp.date_fin_contrat,
      has_mutuelle: emp.has_mutuelle,
      mutuelle_taux_salarie: Number(emp.mutuelle_taux_salarie ?? 0),
      mutuelle_taux_patronal: Number(emp.mutuelle_taux_patronal ?? 0),
      has_cimr: emp.has_cimr,
      cimr_taux_salarie: Number(emp.cimr_taux_salarie ?? 0),
      cimr_taux_patronal: Number(emp.cimr_taux_patronal ?? 0),
      ...statutorySettings,
    });

    const { data: bulletin, error: bErr } = await supabase
      .from("bulletins_paie")
      .upsert({
        employee_id,
        company_id: companyId,
        ...(emp.dossier_id ? { dossier_id: emp.dossier_id } : {}),
        mois, annee, period_label,
        mode_paiement: emp.mode_paiement ?? "virement",
        salaire_brut: calc.salaire_brut,
        heures_sup: calc.heures_sup,
        primes: calc.primes,
        indemnites: calc.indemnites,
        cnss_salarie: calc.cnss_salarie,
        amo_salarie: calc.amo_salarie,
        mutuelle_salarie: calc.mutuelle_salarie,
        cimr_salarie: calc.cimr_salarie,
        frais_pro: calc.frais_pro,
        salaire_net_imposable: calc.salaire_net_imposable,
        ir_brut: calc.ir_mensuel_brut,
        deduction_charge_famille: calc.deduction_charge_famille,
        ir_net: calc.ir_net,
        salaire_net_payer: calc.salaire_net_payer,
        cnss_patronal: calc.cnss_patronal,
        amo_patronal: calc.amo_patronal,
        mutuelle_patronal: calc.mutuelle_patronal,
        cimr_patronal: calc.cimr_patronal,
        taxe_formation_pro: calc.taxe_formation_pro,
        cout_total_employeur: calc.cout_total_employeur,
        ...payrollBulletinDetailFields(variables, calc, Number(emp.salaire_brut)),
        statut: "brouillon",
      }, { onConflict: "employee_id,mois,annee" })
      .select()
      .single();

    if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 });
    if (bulletin) {
      const diff = getDiff(oldBulletin as any, bulletin as any);
      await createVersion(
        "bulletin_paie",
        bulletin.id,
        bulletin as any,
        user.id,
        user.email ?? null,
        oldBulletin ? "UPDATE" : "CREATE",
        "Bulletin de paie généré",
        diff,
      );
      await logAudit({
        userId: user.id,
        userEmail: user.email ?? null,
        companyId,
        action: "VALIDATE",
        entityType: "bulletin_paie",
        entityId: bulletin.id,
        entityLabel: `${emp.prenom ?? ""} ${emp.nom ?? ""} - ${period_label}`.trim(),
        oldValues: oldBulletin as any,
        newValues: bulletin as any,
        changedFields: Object.keys(diff),
        ...getRequestMeta(req),
      });
      await logAccountingEvent({
        companyId,
        eventType: "PAYROLL_CALCULATED",
        triggeredBy: user.id,
        triggeredByEmail: user.email ?? null,
        entityType: "bulletin_paie",
        entityId: bulletin.id,
        amount: Number(bulletin.salaire_net_payer ?? 0),
        periodMois: Number(mois),
        periodAnnee: Number(annee),
        eventData: { employee: emp, bulletin },
      });
    }
    return NextResponse.json({ bulletin, calc });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
