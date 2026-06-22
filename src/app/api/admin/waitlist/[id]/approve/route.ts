import { NextResponse } from "next/server";
import { logAdminAudit, requireAdminApi } from "@/lib/admin-api";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user: adminUser, admin, response } = await requireAdminApi();
  if (response) return response;
  const { id } = await params;

  const { data: entry } = await admin!.from("fiduciaire_waitlist").select("*").eq("id", id).maybeSingle();
  if (!entry) return NextResponse.json({ message: "Demande introuvable." }, { status: 404 });
  if (!entry.auth_user_id || entry.request_kind !== "signup") {
    return NextResponse.json({ message: "Cette demande ne contient pas encore de compte à activer." }, { status: 400 });
  }

  const authResult = await admin!.auth.admin.getUserById(entry.auth_user_id);
  const owner = authResult.data.user;
  if (authResult.error || !owner) {
    return NextResponse.json({ message: authResult.error?.message || "Compte Auth introuvable." }, { status: 400 });
  }

  const userType = entry.track === "comptable" ? "fiduciaire" : "entrepreneur";
  const accountName = entry.entreprise || owner.user_metadata?.company || entry.nom || "Mon entreprise";
  const trialEnd = new Date(Date.now() + 7 * 86400000).toISOString();

  let { data: company } = await admin!.from("companies").select("*").eq("user_id", owner.id).maybeSingle();
  if (!company) {
    const created = await admin!.from("companies").insert({
      user_id: owner.id,
      raison_sociale: accountName,
      email: owner.email,
      phone: entry.telephone || owner.user_metadata?.phone || null,
      user_type: userType,
      plan: "trial",
      trial_ends_at: trialEnd,
      subscription_status: "trial",
      is_suspended: false,
    }).select().single();
    if (created.error || !created.data) {
      return NextResponse.json({ message: created.error?.message || "Création de l'entreprise impossible." }, { status: 400 });
    }
    company = created.data;
  }

  const { data: existingMembership } = await admin!.from("user_memberships")
    .select("id")
    .eq("user_id", owner.id)
    .eq("company_id", company.id)
    .maybeSingle();

  const authUpdate = await admin!.auth.admin.updateUserById(owner.id, { email_confirm: true });
  if (authUpdate.error) {
    return NextResponse.json({ message: authUpdate.error.message }, { status: 400 });
  }

  const profileUpdate = await admin!.from("users").upsert({
    id: owner.id,
    email: owner.email,
    full_name: entry.nom || owner.user_metadata?.full_name || "",
    company: accountName,
    phone: entry.telephone || owner.user_metadata?.phone || null,
  });
  if (profileUpdate.error) {
    return NextResponse.json({ message: profileUpdate.error.message }, { status: 400 });
  }

  if (!existingMembership) {
    const membershipInsert = await admin!.from("user_memberships").insert({
      user_id: owner.id,
      user_email: owner.email,
      company_id: company.id,
      role_name: userType === "fiduciaire" ? "cabinet_owner" : "owner",
      status: "active",
      accepted_at: new Date().toISOString(),
    });
    if (membershipInsert.error) {
      return NextResponse.json({ message: membershipInsert.error.message }, { status: 400 });
    }
  }
  if (userType === "fiduciaire") {
    const cabinetUpsert = await admin!.from("cabinets").upsert({
      user_id: owner.id,
      nom_cabinet: accountName,
      email: owner.email,
      telephone: entry.telephone || owner.user_metadata?.phone || null,
    });
    if (cabinetUpsert.error) {
      return NextResponse.json({ message: cabinetUpsert.error.message }, { status: 400 });
    }
  }

  const approvalUpdate = await admin!.from("fiduciaire_waitlist").update({
    status: "approved",
    approved_at: new Date().toISOString(),
    approved_by: adminUser!.email,
  }).eq("id", id);
  if (approvalUpdate.error) {
    return NextResponse.json({ message: approvalUpdate.error.message }, { status: 400 });
  }

  await logAdminAudit({
    adminEmail: adminUser!.email!,
    action: "WAITLIST_APPROVE",
    entityType: "waitlist",
    entityId: id,
    entityLabel: entry.email,
    companyId: company.id,
    newValues: { auth_user_id: owner.id, status: "approved", user_type: userType },
  });

  return NextResponse.json({ success: true, companyId: company.id });
}
