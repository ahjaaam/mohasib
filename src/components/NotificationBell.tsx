"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ensureAccountingAutomationGuideNotification } from "@/lib/notifications/actions";
import { GLOBAL_PERIOD_EVENT } from "@/lib/global-period";

export default function NotificationBell({ userId, onOpen }: { userId: string; onOpen?: () => void }) {
  const [messageCount, setMessageCount] = useState(0);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let active = true;

    async function loadCount() {
      try {
        const response = await fetch("/api/notifications/count", { cache: "no-store" });
        const payload = response.ok ? await response.json() as { count?: number } : { count: 0 };
        if (active) setMessageCount(Number(payload.count ?? 0));
      } catch {
        if (active) setMessageCount(0);
      }
    }

    void loadCount();
    void ensureAccountingAutomationGuideNotification().catch(() => undefined).then(loadCount);
    const channel = supabase
      .channel(`notifications-mail-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => { void loadCount(); },
      )
      .subscribe();
    window.addEventListener(GLOBAL_PERIOD_EVENT, loadCount);

    return () => {
      active = false;
      window.removeEventListener(GLOBAL_PERIOD_EVENT, loadCount);
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  return (
    <Link
      href="/notifications"
      onClick={onOpen}
      className="relative flex h-10 w-10 items-center justify-center border border-transparent text-[#777E8B] transition-colors hover:border-[#E1E0DA] hover:bg-[#F5F4EF] hover:text-[#1A1A2E]"
      title="Boîte de réception"
      aria-label={`Ouvrir la boîte de réception${messageCount ? `, ${messageCount} message${messageCount > 1 ? "s" : ""} à traiter` : ""}`}
    >
      <Mail size={16} />
      {messageCount > 0 && (
        <span className="absolute -right-0.5 top-0 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-[#FCFCFA] bg-[#DC2626] px-1 text-[9px] font-bold leading-none text-white">
          {messageCount > 99 ? "99+" : messageCount}
        </span>
      )}
    </Link>
  );
}
