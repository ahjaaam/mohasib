import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { getRequestMeta } from "@/lib/request-meta";
import { getAccountApprovalStatus } from "@/lib/account-approval";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/tableau-de-bord";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && !user.user_metadata?.invitation_token) {
        const approvalStatus = await getAccountApprovalStatus(user.id);
        if (approvalStatus === "pending" || approvalStatus === "rejected") {
          await supabase.auth.signOut();
          return NextResponse.redirect(`${origin}/en-attente`);
        }
      }
      if (user) {
        logAudit({
          userId: user.id,
          userEmail: user.email ?? null,
          action: "LOGIN",
          entityType: "session",
          entityId: user.id,
          entityLabel: user.email ?? null,
          ...getRequestMeta(request),
        }).catch(() => {});
      }
      const invitationToken = user?.user_metadata?.invitation_token;
      if (user && invitationToken && user.email) {
        const admin = createAdminClient();
        const { data: membership } = await admin.from("user_memberships")
          .select("id,user_email,access_scope,companies(user_type)")
          .eq("invitation_token", invitationToken)
          .eq("status", "invited")
          .maybeSingle();
        if (membership?.user_email?.toLowerCase() === user.email.toLowerCase()) {
          await admin.from("user_memberships").update({
            user_id: user.id,
            status: "active",
            accepted_at: new Date().toISOString(),
            invitation_token: null,
            invitation_expires_at: null,
          }).eq("id", membership.id);
          const company = Array.isArray(membership.companies) ? membership.companies[0] : membership.companies;
          const memberDest = membership.access_scope === "comptable_pro_only"
            ? "/comptable-pro"
            : membership.access_scope === "business_only"
              ? "/tableau-de-bord"
              : company?.user_type === "fiduciaire" ? "/comptable-pro" : "/tableau-de-bord";
          return NextResponse.redirect(`${origin}${memberDest}`);
        }
      }
      if (user) {
        const admin = createAdminClient();
        const { data: memberships } = await admin.from("user_memberships")
          .select("access_scope,role_name")
          .eq("user_id", user.id)
          .eq("status", "active");
        const collaboratorMemberships = (memberships ?? []).filter(membership => ["manager", "collaborateur"].includes(membership.role_name));
        if (collaboratorMemberships.length > 0 && collaboratorMemberships.every(membership => membership.access_scope === "comptable_pro_only")) {
          return NextResponse.redirect(`${origin}/comptable-pro`);
        }
      }
      const dest = user?.user_metadata?.user_type === "fiduciaire" ? "/comptable-pro" : next;
      return NextResponse.redirect(`${origin}${dest}`);
    }

    console.error("[auth/callback] exchangeCodeForSession failed:", error.message);
  }

  return NextResponse.redirect(`${origin}/auth/erreur`);
}
