import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

type SubscriptionLifecycleResult = {
  scheduledApplied: number;
  trialsExpired: number;
  subscriptionsMovedToGrace: number;
  subscriptionsExpired: number;
  subscriptionRowsExpired: number;
  limitOverridesDeleted: number;
};

function assertCronSecret(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    throw new Error("CRON_SECRET is not configured");
  }
  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest) {
  if (!assertCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let lifecycleResult: SubscriptionLifecycleResult | null = null;
  try {
    await Sentry.withMonitor(
      "subscription-lifecycle",
      async () => {
        const admin = createAdminClient();
        const todayDate = new Date().toISOString().slice(0, 10);
        const { data, error } = await admin
          .rpc("run_subscription_lifecycle", { p_today: todayDate })
          .abortSignal(AbortSignal.timeout(45_000));

        if (error) {
          throw new Error(`Run subscription lifecycle: ${error.message}`);
        }
        if (!data) {
          throw new Error("Run subscription lifecycle returned no result");
        }
        lifecycleResult = data as SubscriptionLifecycleResult;
      },
      {
        schedule: { type: "crontab", value: "0 6 * * *" },
        checkinMargin: 5,
        maxRuntime: 1,
        timezone: "UTC",
        failureIssueThreshold: 1,
        recoveryThreshold: 1,
      },
    );
  } finally {
    // Ensure the final cron check-in leaves the serverless process before it exits.
    await Sentry.flush(2_000);
  }

  return NextResponse.json({ ok: true, ...lifecycleResult });
}
