import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchNotificationCampaign } from "@/lib/admin-notifications";

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse(null, { status: 401 });
  }
  const admin = createAdminClient();
  const { data: campaigns, error } = await admin.from("notification_campaigns")
    .select("id").eq("status", "scheduled").lte("scheduled_at", new Date().toISOString()).limit(25);
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  const results = [];
  for (const campaign of campaigns ?? []) {
    try { await dispatchNotificationCampaign(campaign.id); results.push({ id: campaign.id, ok: true }); }
    catch (dispatchError) {
      const message = dispatchError instanceof Error ? dispatchError.message : "unknown";
      await admin.from("notification_campaigns").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", campaign.id);
      results.push({ id: campaign.id, ok: false, error: message });
    }
  }
  return NextResponse.json({ ok: true, processed: results.length, results });
}
