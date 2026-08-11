import { NextResponse } from "next/server";
import { requireAdminApi, logAdminAudit } from "@/lib/admin-api";
import { dispatchNotificationCampaign } from "@/lib/admin-notifications";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, admin, response } = await requireAdminApi();
  if (response) return response;
  const { action } = await request.json();
  const { data: campaign } = await admin!.from("notification_campaigns").select("id,title,status").eq("id", id).maybeSingle();
  if (!campaign) return NextResponse.json({ message: "Campagne introuvable." }, { status: 404 });

  if (action === "cancel") {
    if (!["draft", "scheduled"].includes(campaign.status)) return NextResponse.json({ message: "Cette campagne ne peut plus être annulée." }, { status: 400 });
    await admin!.from("notification_campaigns").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", id);
  } else if (action === "send" || action === "retry") {
    await admin!.from("notification_campaigns").update({ status: "draft", updated_at: new Date().toISOString() }).eq("id", id);
    try { await dispatchNotificationCampaign(id); }
    catch (error) { return NextResponse.json({ message: error instanceof Error ? error.message : "Envoi impossible." }, { status: 500 }); }
  } else {
    return NextResponse.json({ message: "Action invalide." }, { status: 400 });
  }

  await logAdminAudit({ adminEmail: user!.email!, action: `NOTIFICATION_CAMPAIGN_${String(action).toUpperCase()}`, entityType: "notification_campaign", entityId: id, entityLabel: campaign.title });
  return NextResponse.json({ ok: true });
}
