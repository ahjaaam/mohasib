import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calculateSalary } from "@/lib/payroll";
import { authorizePermission } from "@/lib/api-permissions";
import { requirePlanFeature } from "@/lib/api-plan";
import { createVersion, getDiff, logAccountingEvent, logAudit } from "@/lib/audit";
import { getRequestMeta } from "@/lib/request-meta";
import { enforcePeriodLock } from "@/lib/period-check";

export async function POST(req: NextRequest) {
  try {
    const { employee_id, mois, annee } = await req.json();
    if (!employee_id || !mois || !annee)
      return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    const permission = await authorizePermission("bulletin_paie", "validate");
    if (permission.response) return permission.response;
    const plan = await requirePlanFeature("paie");
    if (plan.response) return plan.response;

    const { data: emp, error: empErr } = await supabase
      .from("employees")
      .select("*")
      .eq("id", employee_id)
      .eq("user_id", user.id)
      .single();

    if (empErr || !emp)
      return NextResponse.json({ error: "Employé introuvable" }, { status: 404 });

    const calc = calculateSalary({
      salaire_brut: Number(emp.salaire_brut),
      situation_familiale: emp.situation_familiale ?? "Célibataire",
      nombre_enfants: Number(emp.nombre_enfants ?? 0),
    });

    const months = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
    const period_label = `${months[mois - 1]} ${annee}`;

    const { data: company } = await supabase
      .from("companies")
      .select("id")
      .eq("user_id", user.id)
      .single();
    const locked = await enforcePeriodLock(Number(mois), Number(annee), company?.id ?? null);
    if (locked) return locked;

    const { data: oldBulletin } = await supabase
      .from("bulletins_paie")
      .select("*")
      .eq("employee_id", employee_id)
      .eq("mois", mois)
      .eq("annee", annee)
      .maybeSingle();

    const { data: bulletin, error: bErr } = await supabase
      .from("bulletins_paie")
      .upsert({
        employee_id,
        company_id: company?.id ?? null,
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
        companyId: company?.id ?? null,
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
        companyId: company?.id ?? null,
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
