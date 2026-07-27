import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveAccountOwnerId } from "@/lib/account-owner";
import { getUserAccessProfile } from "@/lib/team";
import { sendLeadNotification } from "@/lib/lead-notifications";
import { appUrl } from "@/lib/public-urls";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const subject = String(body.subject ?? "").trim().slice(0, 150);
  const message = String(body.message ?? "").trim().slice(0, 4_000);
  const pageUrl = typeof body.page_url === "string" ? body.page_url.slice(0, 300) : null;
  if (!subject || !message) {
    return NextResponse.json({ error: "invalid", message: "Le sujet et le message sont requis." }, { status: 400 });
  }

  const admin = createAdminClient();
  const ownerId = await resolveAccountOwnerId(user.id);
  const access = await getUserAccessProfile(user.id);

  let dossierId: string | null = null;
  if (access.roleName === "client_portal") {
    const { data: membership } = await admin.from("user_memberships")
      .select("dossier_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .eq("role_name", "client_portal")
      .maybeSingle();
    dossierId = membership?.dossier_id ?? null;
  } else if (typeof body.dossier_id === "string") {
    const { data: dossier } = await admin.from("dossiers")
      .select("id")
      .eq("id", body.dossier_id)
      .eq("fiduciaire_user_id", ownerId)
      .maybeSingle();
    dossierId = dossier?.id ?? null;
  }

  const { data: company } = await admin.from("companies").select("id, raison_sociale").eq("user_id", ownerId).maybeSingle();
  const { data: profile } = await admin.from("users").select("full_name").eq("id", user.id).maybeSingle();

  const { data: ticket, error } = await admin.from("support_tickets").insert({
    user_id: user.id,
    company_id: company?.id ?? null,
    dossier_id: dossierId,
    user_email: user.email ?? "",
    user_name: profile?.full_name ?? null,
    subject,
    message,
    page_url: pageUrl,
  }).select("id").single();

  if (error || !ticket) {
    return NextResponse.json({ error: "create_failed", message: "Impossible d'envoyer votre demande. Réessayez." }, { status: 500 });
  }

  void sendLeadNotification({
    kind: "ticket",
    fullName: profile?.full_name ?? undefined,
    email: user.email ?? undefined,
    company: company?.raison_sociale ?? undefined,
    subject,
    message,
    link: pageUrl ? appUrl(pageUrl) : undefined,
  });

  return NextResponse.json({ success: true, id: ticket.id });
}
