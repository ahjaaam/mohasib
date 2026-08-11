export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveAccountOwnerId } from "@/lib/account-owner";
import { getAttentionItems } from "@/lib/attention-center";
import { GLOBAL_PERIOD_STORAGE_KEY, globalPeriodLabel, parseGlobalPeriod } from "@/lib/global-period";
import { ensureAccountingAutomationGuideNotification, fetchAllNotifications } from "@/lib/notifications/actions";
import type { Notification } from "@/lib/notifications/actions";
import NotificationsInbox from "./NotificationsInbox";

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  const ownerId = await resolveAccountOwnerId(user.id);
  const cookieStore = await cookies();
  const period = parseGlobalPeriod(cookieStore.get(GLOBAL_PERIOD_STORAGE_KEY)?.value);

  try {
    await ensureAccountingAutomationGuideNotification();
  } catch {
    // The inbox remains usable if the optional onboarding message cannot be created.
  }

  const [notifications, attentionItems] = await Promise.all([
    fetchAllNotifications(),
    getAttentionItems(ownerId, period),
  ]);
  const periodLabel = globalPeriodLabel(period);
  const attentionMessages: Notification[] = attentionItems
    .filter((item) => item.count > 0)
    .map((item) => ({
      id: `attention-${item.id}`,
      user_id: user.id,
      type: "attention_action",
      title: `${item.title} · ${item.count}`,
      message: `${item.description}\n${item.count} action${item.count > 1 ? "s" : ""} à traiter pour ${periodLabel}.`,
      link: item.href,
      is_read: true,
      is_dismissed: false,
      priority: item.severity === "critical" ? "high" : "normal",
      unique_key: `attention-${item.id}`,
      created_at: new Date().toISOString(),
    }));
  const inboxMessages = [...attentionMessages, ...notifications];

  return (
    <NotificationsInbox
      key={`${inboxMessages[0]?.id ?? "empty"}-${inboxMessages.length}-${notifications.filter((item) => !item.is_read).length}`}
      initialNotifications={inboxMessages}
    />
  );
}
