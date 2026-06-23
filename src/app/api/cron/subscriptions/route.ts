import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createAdminClient } from "@/lib/supabase/admin";

function assertCronSecret(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    throw new Error("CRON_SECRET is not configured");
  }
  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

function assertNoSupabaseError<T extends { error: { message: string } | null }>(result: T, action: string) {
  if (result.error) {
    throw new Error(`${action}: ${result.error.message}`);
  }
  return result;
}

export async function GET(request: NextRequest) {
  if (!assertCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let scheduledApplied = 0;
  let trialsExpired = 0;
  await Sentry.withMonitor(
    "subscription-lifecycle",
    async () => {
      const admin = createAdminClient();
      const today = new Date();
      const todayDate = today.toISOString().slice(0, 10);
      const graceStart = new Date(today);
      graceStart.setDate(graceStart.getDate() - 7);
      const graceDate = graceStart.toISOString().slice(0, 10);
      const { data: scheduled } = assertNoSupabaseError(
        await admin.from("companies").select("id, scheduled_plan").not("scheduled_plan", "is", null).lte("scheduled_plan_date", todayDate),
        "Fetch scheduled plan changes",
      );
      scheduledApplied = scheduled?.length ?? 0;
      for (const company of scheduled ?? []) {
        const { data: scheduledSubscription } = assertNoSupabaseError(
          await admin.from("subscriptions").select("id, ends_at").eq("company_id", company.id).eq("status", "scheduled").order("starts_at", { ascending: true }).limit(1).maybeSingle(),
          `Fetch scheduled subscription for company ${company.id}`,
        );
        assertNoSupabaseError(
          await admin.from("subscriptions").update({ status: "cancelled" }).eq("company_id", company.id).eq("status", "active"),
          `Cancel active subscriptions for company ${company.id}`,
        );
        if (scheduledSubscription) {
          assertNoSupabaseError(
            await admin.from("subscriptions").update({ status: "active" }).eq("id", scheduledSubscription.id),
            `Activate scheduled subscription ${scheduledSubscription.id}`,
          );
        }
        assertNoSupabaseError(
          await admin.from("companies").update({ plan: company.scheduled_plan, subscription_status: "active", subscription_ends_at: scheduledSubscription?.ends_at ?? null, scheduled_plan: null, scheduled_plan_date: null }).eq("id", company.id),
          `Apply scheduled plan for company ${company.id}`,
        );
      }
      const expiredTrialResult = assertNoSupabaseError(
        await admin
          .from("companies")
          .update({ subscription_status: "expired" }, { count: "exact" })
          .eq("subscription_status", "trial")
          .lt("trial_ends_at", todayDate),
        "Expire ended trials",
      );
      trialsExpired = expiredTrialResult.count ?? 0;
      assertNoSupabaseError(
        await admin.from("companies").update({ subscription_status: "grace" }).eq("subscription_status", "active").lt("subscription_ends_at", todayDate).gte("subscription_ends_at", graceDate),
        "Move expired paid subscriptions into grace",
      );
      assertNoSupabaseError(
        await admin.from("companies").update({ subscription_status: "expired" }).in("subscription_status", ["active", "grace"]).lt("subscription_ends_at", graceDate),
        "Expire subscriptions past grace period",
      );
      assertNoSupabaseError(
        await admin.from("subscriptions").update({ status: "expired" }).eq("status", "active").lt("ends_at", todayDate),
        "Expire subscription history rows",
      );
      assertNoSupabaseError(
        await admin.from("company_limit_overrides").delete().lt("expires_at", todayDate),
        "Delete expired limit overrides",
      );
    },
    {
      schedule: { type: "crontab", value: "0 6 * * *" },
      checkinMargin: 5,
      maxRuntime: 10,
      timezone: "UTC",
      failureIssueThreshold: 1,
      recoveryThreshold: 1,
    },
  );
  return NextResponse.json({ ok: true, scheduledApplied, trialsExpired });
}
