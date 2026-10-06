"use client";

import { useEffect, useState } from "react";

export default function DashboardGreeting({ firstName }: { firstName: string }) {
  const [localDate, setLocalDate] = useState<string | null>(null);
  const [greeting, setGreeting] = useState("Bonjour");

  useEffect(() => {
    const now = new Date();
    const hour = now.getHours();
    setGreeting(hour >= 18 || hour < 5 ? "Bonsoir" : "Bonjour");

    const date = now.toLocaleDateString("fr-MA", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    setLocalDate(date.charAt(0).toUpperCase() + date.slice(1));
  }, []);

  return (
    <div className="mb-7">
      <h1 className="text-[22px] font-semibold text-[#1A1A2E] leading-tight">
        {greeting}, {firstName}
      </h1>
      <p aria-live="off" className="text-[12.5px] text-[#6B7280] mt-0.5 min-h-[18px]">
        {localDate}
      </p>
    </div>
  );
}
