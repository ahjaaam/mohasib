"use client";

function getGreeting(firstName: string): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12)  return `Bonjour, ${firstName}`;
  if (hour >= 12 && hour < 18) return `Bon après-midi, ${firstName}`;
  if (hour >= 18 && hour < 22) return `Bonsoir, ${firstName}`;
  return `Bonne nuit, ${firstName}`;
}

export default function DashboardGreeting({ firstName }: { firstName: string }) {
  return (
    <div className="mb-7">
      <h2 className="text-[22px] font-semibold text-[#1A1A2E] leading-tight">
        {getGreeting(firstName)}
      </h2>
      <p className="text-[12.5px] text-[#6B7280] mt-0.5">
        {new Date().toLocaleDateString("fr-MA", {
          weekday: "long", day: "numeric", month: "long", year: "numeric",
        })}
      </p>
    </div>
  );
}
