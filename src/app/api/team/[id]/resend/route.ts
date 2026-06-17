import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/rbac";
import { resolveTeamContext, ROLE_LABELS } from "@/lib/team";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const context = await resolveTeamContext(user.id);
  if (!context) return NextResponse.json({ error: "account_not_found" }, { status: 404 });
  const denied = await requirePermission({ userId: user.id, companyId: context.companyId, scope: context.track === "comptable" ? "comptable_pro" : "business" }, "settings", "manage_team");
  if (denied) return denied;

  const { id } = await params;
  const admin = createAdminClient();
  const { data: membership } = await admin.from("user_memberships")
    .select("id,user_email,role_name,status")
    .eq("id", id).eq("company_id", context.companyId).maybeSingle();
  if (!membership || membership.status !== "invited") return NextResponse.json({ error: "not_found" }, { status: 404 });

  const token = randomBytes(32).toString("hex");
  await admin.from("user_memberships").update({
    invitation_token: token,
    invitation_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    invited_at: new Date().toISOString(),
  }).eq("id", id);

  const invitationUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/invitations/${token}`;
  if (process.env.RESEND_API_KEY) {
    await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: process.env.RESEND_FROM_EMAIL || "Mohasib <noreply@mohasibai.com>",
      to: membership.user_email,
      subject: `${context.ownerName} vous invite à rejoindre Mohasib`,
      html: `<p>${context.ownerName} vous invite à rejoindre <strong>${context.accountName}</strong>.</p><p>Rôle : ${ROLE_LABELS[membership.role_name] ?? membership.role_name}</p><p><a href="${invitationUrl}">Accepter l'invitation</a></p>`,
    });
  }
  return NextResponse.json({ success: true, invitationUrl });
}
