import { NextResponse } from "next/server";
import { logAdminAudit, requireAdminApi } from "@/lib/admin-api";

export async function POST(request: Request) {
  const { user, admin, response } = await requireAdminApi();
  if (response) return response;
  const body = await request.json();
  const phone = String(body.phone ?? "").trim();
  if (!body.email || !body.raison_sociale || !phone) return NextResponse.json({ message: "Email, raison sociale et téléphone obligatoires" }, { status: 400 });
  const created = await admin!.auth.admin.createUser({
    email: String(body.email).trim().toLowerCase(),
    email_confirm: true,
    user_metadata: { full_name: body.full_name || "", phone, user_type: body.user_type || "entrepreneur" },
  });
  if (created.error || !created.data.user) return NextResponse.json({ message: created.error?.message || "Création impossible" }, { status: 400 });
  const owner = created.data.user;
  const { data: company, error } = await admin!.from("companies").insert({
    user_id: owner.id,
    raison_sociale: body.raison_sociale,
    email: owner.email,
    phone,
    user_type: body.user_type || "entrepreneur",
    plan: "custom",
    trial_ends_at: null,
    subscription_ends_at: null,
    subscription_status: "active",
    admin_notes: body.admin_notes || null,
  }).select().single();
  if (error) {
    await admin!.auth.admin.deleteUser(owner.id);
    return NextResponse.json({ message: error.message }, { status: 400 });
  }
  await Promise.all([
    admin!.from("users").upsert({ id: owner.id, email: owner.email, full_name: body.full_name || "", phone, company: body.raison_sociale }),
    admin!.from("user_memberships").insert({ user_id: owner.id, user_email: owner.email, company_id: company.id, role_name: body.user_type === "fiduciaire" ? "cabinet_owner" : "owner", status: "active", accepted_at: new Date().toISOString() }),
    admin!.from("user_preferences").upsert({ user_id: owner.id, sidebar_theme: "dark" }, { onConflict: "user_id", ignoreDuplicates: true }),
    body.user_type === "fiduciaire" ? admin!.from("cabinets").upsert({ user_id: owner.id, nom_cabinet: body.raison_sociale, email: owner.email, telephone: phone }) : Promise.resolve(),
  ]);
  if (body.waitlist_id) {
    await admin!.from("fiduciaire_waitlist").update({
      auth_user_id: owner.id,
      user_id: owner.id,
      status: "approved",
      approved_at: new Date().toISOString(),
      approved_by: user!.email,
    }).eq("id", body.waitlist_id);
  }
  const link = await admin!.auth.admin.generateLink({ type: "recovery", email: owner.email! });
  await logAdminAudit({ adminEmail: user!.email!, action: "ACCOUNT_CREATE", entityType: "company", entityId: company.id, entityLabel: company.raison_sociale, companyId: company.id, newValues: { plan: company.plan, user_type: company.user_type, owner_email: owner.email, phone } });
  return NextResponse.json({ companyId: company.id, recoveryLink: link.data.properties?.action_link ?? null });
}
