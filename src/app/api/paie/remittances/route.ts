import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { authorizePermission } from "@/lib/api-permissions";
import { requirePlanFeature } from "@/lib/api-plan";
import { enforcePeriodLock } from "@/lib/period-check";
import { resolveTeamContext } from "@/lib/team";
import { logAccountingEvent, logAudit } from "@/lib/audit";
import { getRequestMeta } from "@/lib/request-meta";

function validPeriod(mois: number, annee: number) {
  return Number.isInteger(mois) && mois >= 1 && mois <= 12 && Number.isInteger(annee) && annee >= 1900 && annee <= 9999;
}

async function scopeFor(dossierId: string | null) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, companyId: null, dossierId, response: NextResponse.json({ error: "Non authentifié" }, { status: 401 }) };
  const companyId = dossierId ? null : (await resolveTeamContext(user.id))?.companyId ?? null;
  if (!companyId && !dossierId) return { supabase, user, companyId, dossierId, response: NextResponse.json({ error: "Entreprise introuvable" }, { status: 404 }) };
  return { supabase, user, companyId, dossierId, response: null };
}

export async function GET(req: NextRequest) {
  try {
    const plan = await requirePlanFeature("paie");
    if (plan.response) return plan.response;
    const mois = Number(new URL(req.url).searchParams.get("mois"));
    const annee = Number(new URL(req.url).searchParams.get("annee"));
    if (!validPeriod(mois, annee)) return NextResponse.json({ error: "Période de paie invalide" }, { status: 400 });
    const scope = await scopeFor(new URL(req.url).searchParams.get("dossierId"));
    if (scope.response) return scope.response;
    const permission = await authorizePermission("bulletin_paie", "read", { companyId: scope.companyId, dossierId: scope.dossierId });
    if (permission.response) return permission.response;
    let query = scope.supabase.from("bulletins_paie")
      .select("statut,ir_net,cnss_salarie,cnss_patronal,amo_salarie,amo_patronal,taxe_formation_pro,mutuelle_salarie,mutuelle_patronal,cimr_salarie,cimr_patronal,social_paid_at,ir_paid_at")
      .eq("mois", mois).eq("annee", annee).in("statut", ["validé", "payé"]);
    query = scope.dossierId ? query.eq("dossier_id", scope.dossierId) : query.eq("company_id", scope.companyId!);
    const { data, error } = await query;
    if (error) throw error;
    const rows = data ?? [];
    const socialKeys = ["cnss_salarie", "cnss_patronal", "amo_salarie", "amo_patronal", "taxe_formation_pro", "mutuelle_salarie", "mutuelle_patronal", "cimr_salarie", "cimr_patronal"] as const;
    const socialOutstanding = rows.filter((row) => !row.social_paid_at).reduce((sum, row) => sum + socialKeys.reduce((total, key) => total + Number(row[key] ?? 0), 0), 0);
    const irOutstanding = rows.filter((row) => !row.ir_paid_at).reduce((sum, row) => sum + Number(row.ir_net ?? 0), 0);
    return NextResponse.json({ count: rows.length, social_outstanding: socialOutstanding, ir_outstanding: irOutstanding, social_paid: rows.length > 0 && rows.every((row) => Boolean(row.social_paid_at)), ir_paid: rows.length > 0 && rows.every((row) => Boolean(row.ir_paid_at)) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const plan = await requirePlanFeature("paie");
    if (plan.response) return plan.response;
    const body = await req.json();
    const mois = Number(body.mois);
    const annee = Number(body.annee);
    const kind = body.kind;
    const paymentDate = body.payment_date ?? new Date().toISOString().slice(0, 10);
    if (!validPeriod(mois, annee) || !["social", "ir"].includes(kind) || !/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) return NextResponse.json({ error: "Règlement de paie invalide" }, { status: 400 });
    const scope = await scopeFor(body.dossierId ?? null);
    if (scope.response) return scope.response;
    const permission = await authorizePermission("bulletin_paie", "validate", { companyId: scope.companyId, dossierId: scope.dossierId });
    if (permission.response) return permission.response;
    const locked = await enforcePeriodLock(mois, annee, scope.companyId, scope.dossierId);
    if (locked) return locked;
    const { data: count, error } = await scope.supabase.rpc("settle_payroll_period", { p_mois: mois, p_annee: annee, p_company_id: scope.companyId, p_dossier_id: scope.dossierId, p_kind: kind, p_payment_date: paymentDate });
    if (error) return NextResponse.json({ error: error.message }, { status: 409 });
    await logAudit({ userId: scope.user!.id, userEmail: scope.user!.email ?? null, companyId: scope.companyId, dossierId: scope.dossierId, action: "PAY", entityType: `payroll_${kind}_remittance`, entityId: null, oldValues: null, newValues: { mois, annee, payment_date: paymentDate, count }, changedFields: [kind], ...getRequestMeta(req) });
    await logAccountingEvent({ companyId: scope.companyId, dossierId: scope.dossierId, eventType: kind === "social" ? "PAYROLL_SOCIAL_PAID" : "PAYROLL_IR_PAID", triggeredBy: scope.user!.id, triggeredByEmail: scope.user!.email ?? null, entityType: "payroll_period", entityId: null, amount: 0, periodMois: mois, periodAnnee: annee, eventData: { payment_date: paymentDate, count } });
    return NextResponse.json({ count });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
