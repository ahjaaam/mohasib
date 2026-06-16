import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { getRequestMeta } from "@/lib/request-meta";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/tableau-de-bord";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
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
          .select("id,user_email,companies(user_type)")
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
          const memberDest = company?.user_type === "fiduciaire" ? "/comptable-pro" : "/tableau-de-bord";
          return NextResponse.redirect(`${origin}${memberDest}`);
        }
      }
      const dest = user?.user_metadata?.user_type === "fiduciaire" ? "/comptable-pro" : next;
      return NextResponse.redirect(`${origin}${dest}`);
    }

    console.error("[auth/callback] exchangeCodeForSession failed:", error.message);
  }

  return NextResponse.redirect(`${origin}/auth/erreur`);
}
