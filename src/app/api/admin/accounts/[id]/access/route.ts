import { NextResponse } from "next/server";
import { logAdminAudit, requireAdminApi } from "@/lib/admin-api";

const STATUSES = ["trial", "active", "grace", "expired"] as const;

function validIsoDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, admin, response } = await requireAdminApi();
  if (response) return response;

  const body = await request.json();
  if (!STATUSES.includes(body.status)) {
    return NextResponse.json({ message: "Statut invalide" }, { status: 400 });
  }

  const { data: company } = await admin!.from("companies").select("*").eq("id", id).maybeSingle();
  if (!company) return NextResponse.json({ message: "Compte introuvable" }, { status: 404 });

  const endDate = body.ends_at || null;
  if (endDate && !validIsoDate(endDate)) {
    return NextResponse.json({ message: "Date de fin invalide" }, { status: 400 });
  }
  if (body.status === "active" && !endDate) {
    return NextResponse.json({ message: "La date de fin est obligatoire pour un accès actif" }, { status: 400 });
  }
  const amountMad = Number(body.amount_mad ?? 0);
  if (!Number.isFinite(amountMad) || amountMad < 0) {
    return NextResponse.json({ message: "Le montant doit être un nombre positif ou nul" }, { status: 400 });
  }
  const updateValues = {
    plan: body.status === "trial" ? "trial" : "custom",
    subscription_status: body.status,
    subscription_ends_at: body.status === "trial" ? company.subscription_ends_at : endDate,
    trial_ends_at: body.status === "trial" && endDate ? `${endDate}T23:59:59.999Z` : company.trial_ends_at,
    scheduled_plan: null,
    scheduled_plan_date: null,
  };
  const update = await admin!.from("companies").update(updateValues).eq("id", id);
  if (update.error) return NextResponse.json({ message: update.error.message }, { status: 400 });

  if (body.status === "active" && endDate) {
    await admin!.from("subscriptions").update({ status: "cancelled" }).eq("company_id", id).eq("status", "active");
    const startsAt = new Date().toISOString().slice(0, 10);
    const inserted = await admin!.from("subscriptions").insert({
      company_id: id,
      plan: "custom",
      previous_plan: company.plan,
      change_type: company.subscription_status === "active" ? "renewal" : "activation",
      billing_period: body.billing_period === "annual" ? "annual" : "monthly",
      amount_mad: amountMad,
      payment_method: body.payment_method || null,
      payment_reference: body.payment_reference || null,
      starts_at: startsAt,
      ends_at: endDate,
      status: "active",
      created_by_email: user!.email,
    });
    if (inserted.error) return NextResponse.json({ message: inserted.error.message }, { status: 400 });
  }

  await logAdminAudit({
    adminEmail: user!.email!,
    action: "ACCOUNT_ACCESS_UPDATE",
    entityType: "company",
    entityId: id,
    entityLabel: company.raison_sociale,
    companyId: id,
    oldValues: { plan: company.plan, subscription_status: company.subscription_status, subscription_ends_at: company.subscription_ends_at },
    newValues: updateValues,
  });
  return NextResponse.json({ ok: true });
}
