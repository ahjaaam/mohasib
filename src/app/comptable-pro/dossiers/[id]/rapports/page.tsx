"use client";

import { BarChart2 } from "lucide-react";

export default function RapportsPage() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="w-12 h-12 rounded-xl bg-[rgba(200,146,74,0.12)] flex items-center justify-center mb-4">
        <BarChart2 size={22} className="text-[#C8924A]" />
      </div>
      <p className="text-[14px] font-semibold text-[#1A1A2E] mb-1">Rapports</p>
      <p className="text-[12.5px] text-[#6B7280]">Fonctionnalité disponible prochainement.</p>
    </div>
  );
}
