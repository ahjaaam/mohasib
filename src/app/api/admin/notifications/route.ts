import { NextResponse } from "next/server";
import { requireAdminApi, logAdminAudit } from "@/lib/admin-api";
import { dispatchNotificationCampaign, type NotificationAudience } from "@/lib/admin-notifications";

const CHANNELS = new Set(["in_app", "email", "both"]);
const CATEGORIES = new Set(["service", "billing", "compliance", "support", "product", "marketing"]);

export async function POST(request: Request) {
  const { user, admin, response } = await requireAdminApi();
  if (response) return response;
  const body = await request.json();
  const title = String(body.title ?? "").trim();
  const message = String(body.message ?? "").trim();
  const channel = String(body.channel ?? "in_app");
  const category = String(body.category ?? "service");
  const link = String(body.link ?? "").trim();
  const audience = (body.audience ?? { type: "all" }) as NotificationAudience;
  const mode = String(body.mode ?? "send");
  const scheduledAt = body.scheduled_at ? new Date(String(body.scheduled_at)) : null;

  if (!title || !message) return NextResponse.json({ message: "Le titre et le message sont obligatoires." }, { status: 400 });
  if (!CHANNELS.has(channel) || !CATEGORIES.has(category)) return NextResponse.json({ message: "Canal ou catégorie invalide." }, { status: 400 });
  if (link && !link.startsWith("/") && !/^https:\/\//i.test(link)) return NextResponse.json({ message: "Le lien doit être interne ou utiliser HTTPS." }, { status: 400 });
  if (scheduledAt && Number.isNaN(scheduledAt.getTime())) return NextResponse.json({ message: "Date de programmation invalide." }, { status: 400 });

  const status = mode === "draft" ? "draft" : scheduledAt && scheduledAt.getTime() > Date.now() ? "scheduled" : "draft";
  const { data: campaign, error } = await admin!.from("notification_campaigns").insert({
    title,
    message,
    link: link || null,
    priority: body.priority === "high" ? "high" : "normal",
    category,
    channel,
    audience,
    status,
    scheduled_at: scheduledAt?.toISOString() ?? null,
    created_by_email: user!.email,
  }).select("id,status").single();
  if (error || !campaign) return NextResponse.json({ message: error?.message || "Création impossible." }, { status: 400 });

  await logAdminAudit({
    adminEmail: user!.email!, action: "NOTIFICATION_CAMPAIGN_CREATE", entityType: "notification_campaign",
    entityId: campaign.id, entityLabel: title, newValues: { channel, category, audience, status },
  });

  if (mode === "send" && status !== "scheduled") {
    try {
      await dispatchNotificationCampaign(campaign.id);
    } catch (dispatchError) {
      await admin!.from("notification_campaigns").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", campaign.id);
      return NextResponse.json({ message: dispatchError instanceof Error ? dispatchError.message : "Envoi impossible." }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true, id: campaign.id, status });
}
