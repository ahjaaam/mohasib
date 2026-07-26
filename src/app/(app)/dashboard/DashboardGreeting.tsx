"use client";

function getGreeting(firstName: string): string {
  const hour = new Date().getHours();
  return hour >= 18 || hour < 5
    ? `Bonsoir, ${firstName}`
    : `Bonjour, ${firstName}`;
}

export default function DashboardGreeting({ firstName }: { firstName: string }) {
  return (
    <div className="mb-7">
      <h2 className="text-[22px] font-semibold text-[#1A1A2E] leading-tight">
        {getGreeting(firstName)}
      </h2>
      <p className="text-[12.5px] text-[#6B7280] mt-0.5">
        {(() => { const d = new Date().toLocaleDateString("fr-MA", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); return d.charAt(0).toUpperCase() + d.slice(1); })()}
      </p>
    </div>
  );
}
