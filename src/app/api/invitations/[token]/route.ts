import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ROLE_LABELS } from "@/lib/team";
import { logAudit } from "@/lib/audit";

async function invitation(token: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("user_memberships")
    .select("id,user_email,company_id,role_name,dossier_scope,status,invitation_expires_at,companies(raison_sociale,user_id,user_type)")
    .eq("invitation_token", token).maybeSingle();
  return data;
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const membership = await invitation(token);
  if (!membership || membership.status !== "invited") return NextResponse.json({ error: "invalid" }, { status: 404 });
  if (!membership.invitation_expires_at || new Date(membership.invitation_expires_at) < new Date()) {
    return NextResponse.json({ error: "expired" }, { status: 410 });
  }
  const company = Array.isArray(membership.companies) ? membership.companies[0] : membership.companies;
  return NextResponse.json({
    email: membership.user_email,
    role: membership.role_name,
    role_label: ROLE_LABELS[membership.role_name] ?? membership.role_name,
    dossier_count: membership.dossier_scope?.length ?? 0,
    account_name: company?.raison_sociale || "Mohasib",
    track: company?.user_type === "fiduciaire" ? "comptable" : "business",
  });
}

export async function POST(_: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { token } = await params;
  const membership = await invitation(token);
  if (!membership || membership.status !== "invited") return NextResponse.json({ error: "invalid" }, { status: 404 });
  if (!membership.invitation_expires_at || new Date(membership.invitation_expires_at) < new Date()) {
    return NextResponse.json({ error: "expired" }, { status: 410 });
  }
  if (user.email?.toLowerCase() !== membership.user_email?.toLowerCase()) {
    return NextResponse.json({ error: "email_mismatch", invited_email: membership.user_email }, { status: 403 });
  }

  const admin = createAdminClient();
  await admin.from("user_memberships").update({
    user_id: user.id,
    status: "active",
    accepted_at: new Date().toISOString(),
    invitation_token: null,
    invitation_expires_at: null,
  }).eq("id", membership.id);

  void logAudit({
    action: "LOGIN",
    entityType: "membership",
    entityId: membership.id,
    entityLabel: membership.user_email,
    companyId: membership.company_id,
    userId: user.id,
  });
  const company = Array.isArray(membership.companies) ? membership.companies[0] : membership.companies;
  return NextResponse.json({ success: true, redirect: company?.user_type === "fiduciaire" ? "/comptable-pro" : "/tableau-de-bord" });
}
