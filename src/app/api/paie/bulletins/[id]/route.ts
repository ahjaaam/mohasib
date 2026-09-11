import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { authorizePermission } from "@/lib/api-permissions";
import { requirePlanFeature } from "@/lib/api-plan";
import { enforcePeriodLock } from "@/lib/period-check";
import { createVersion, getDiff, logAccountingEvent, logAudit } from "@/lib/audit";
import { getRequestMeta } from "@/lib/request-meta";

async function context(id: string) {
  const supabase = await createClient();
  const { data: bulletin, error } = await supabase.from("bulletins_paie").select("*").eq("id", id).single();
  return { supabase, bulletin, error };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const plan = await requirePlanFeature("paie");
    if (plan.response) return plan.response;
    const { id } = await params;
    const { supabase, bulletin, error } = await context(id);
    if (error || !bulletin) return NextResponse.json({ error: "Bulletin introuvable" }, { status: 404 });
    const permission = await authorizePermission("bulletin_paie", "validate", { companyId: bulletin.company_id, dossierId: bulletin.dossier_id });
    if (permission.response) return permission.response;
    const locked = await enforcePeriodLock(bulletin.mois, bulletin.annee, bulletin.company_id, bulletin.dossier_id);
    if (locked) return locked;
    const body = await req.json();
    const target = body.statut;
    if (target !== "validé" && target !== "payé") return NextResponse.json({ error: "Transition de paie invalide" }, { status: 400 });
    const { data, error: transitionError } = await supabase.rpc("transition_payroll_bulletin", {
      p_bulletin_id: id,
      p_target_status: target,
      p_payment_date: target === "payé" ? (body.date_paiement ?? new Date().toISOString().slice(0, 10)) : null,
    });
    if (transitionError) return NextResponse.json({ error: transitionError.message }, { status: 409 });
    const user = permission.user!;
    const diff = getDiff(bulletin, data);
    await createVersion("bulletin_paie", id, data, user.id, user.email ?? null, "UPDATE", `Bulletin ${target}`, diff);
    await logAudit({ userId: user.id, userEmail: user.email ?? null, companyId: bulletin.company_id, dossierId: bulletin.dossier_id, action: target === "payé" ? "PAY" : "VALIDATE", entityType: "bulletin_paie", entityId: id, oldValues: bulletin, newValues: data, changedFields: Object.keys(diff), ...getRequestMeta(req) });
    await logAccountingEvent({ companyId: bulletin.company_id, dossierId: bulletin.dossier_id, eventType: target === "payé" ? "PAYROLL_PAID" : "PAYROLL_VALIDATED", triggeredBy: user.id, triggeredByEmail: user.email ?? null, entityType: "bulletin_paie", entityId: id, amount: Number(bulletin.salaire_net_payer), periodMois: bulletin.mois, periodAnnee: bulletin.annee, eventData: { status: target } });
    return NextResponse.json({ bulletin: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const plan = await requirePlanFeature("paie");
    if (plan.response) return plan.response;
    const { id } = await params;
    const { supabase, bulletin, error } = await context(id);
    if (error || !bulletin) return NextResponse.json({ error: "Bulletin introuvable" }, { status: 404 });
    const permission = await authorizePermission("bulletin_paie", "validate", { companyId: bulletin.company_id, dossierId: bulletin.dossier_id });
    if (permission.response) return permission.response;
    const locked = await enforcePeriodLock(bulletin.mois, bulletin.annee, bulletin.company_id, bulletin.dossier_id);
    if (locked) return locked;
    if (bulletin.statut !== "brouillon") return NextResponse.json({ error: "Un bulletin finalisé ne peut pas être supprimé" }, { status: 409 });
    const { error: deleteError } = await supabase.from("bulletins_paie").delete().eq("id", id);
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
    return new NextResponse(null, { status: 204 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
