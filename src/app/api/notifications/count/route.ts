import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { resolveAccountOwnerId } from "@/lib/account-owner";
import { getAttentionItems } from "@/lib/attention-center";
import { GLOBAL_PERIOD_STORAGE_KEY, parseGlobalPeriod } from "@/lib/global-period";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ count: 0 }, { status: 401 });

  const ownerId = await resolveAccountOwnerId(user.id);
  const cookieStore = await cookies();
  const period = parseGlobalPeriod(cookieStore.get(GLOBAL_PERIOD_STORAGE_KEY)?.value);

  const [notificationResult, attentionItems] = await Promise.all([
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false)
      .eq("is_dismissed", false),
    getAttentionItems(ownerId, period),
  ]);

  const attentionMessageCount = attentionItems.filter((item) => item.count > 0).length;
  return NextResponse.json({
    count: (notificationResult.count ?? 0) + attentionMessageCount,
    unreadCount: notificationResult.count ?? 0,
    attentionCount: attentionMessageCount,
  });
}
