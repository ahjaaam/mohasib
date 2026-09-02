"use client";

import { useEffect, useMemo, useState } from "react";
import { Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ensureAccountingAutomationGuideNotification } from "@/lib/notifications/actions";

export default function NotificationBell({
  userId,
  open,
  onToggle,
}: {
  userId: string;
  open: boolean;
  onToggle: () => void;
}) {
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

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`ui-control relative flex h-10 w-10 items-center justify-center border text-[#777E8B] transition-colors ${
        open
          ? "border-[#C8924A] bg-[rgba(200,146,74,0.16)]"
          : "border-transparent bg-[rgba(200,146,74,0.08)] hover:border-[#D8C19D] hover:bg-[rgba(200,146,74,0.14)]"
      }`}
      title="Boîte de réception"
      aria-label={`Ouvrir la boîte de réception${messageCount ? `, ${messageCount} message${messageCount > 1 ? "s" : ""} à traiter` : ""}`}
      aria-expanded={open}
      aria-controls="mohasib-notifications-dock"
    >
      <Mail size={18} />
      {messageCount > 0 && (
        <span className="absolute -right-0.5 bottom-0 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-[#FCFCFA] bg-[#DC2626] px-1 text-[9px] font-bold leading-none text-white">
          {messageCount > 99 ? "99+" : messageCount}
        </span>
      )}
    </button>
  );
}
