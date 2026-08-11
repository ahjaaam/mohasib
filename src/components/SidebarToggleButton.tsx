"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  collapsed: boolean;
  onToggle: () => void;
  light?: boolean;
};

export default function SidebarToggleButton({ collapsed, onToggle, light = false }: Props) {
  const label = collapsed ? "Développer la navigation" : "Réduire la navigation";

  return (
    <button
      type="button"
      onClick={onToggle}
      title={label}
      aria-label={label}
      className={`absolute bottom-6 right-0 z-30 hidden h-8 w-6 translate-x-1/2 items-center justify-center rounded-none border shadow-[0_5px_14px_rgba(0,0,0,0.18)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8924A] focus-visible:ring-offset-2 md:flex ${
        light
          ? "border-[#D8D2C2] bg-white text-[#5D584E] hover:border-[#C8BFA9] hover:bg-[#F7F7F7] hover:text-[#1A1A2E] focus-visible:ring-offset-white"
          : "border-white/[0.14] bg-[#171922] text-white/90 hover:border-white/25 hover:bg-[#20232E] hover:text-white focus-visible:ring-offset-[#171922]"
      }`}
    >
      {collapsed ? <ChevronRight size={13} strokeWidth={2.2} /> : <ChevronLeft size={13} strokeWidth={2.2} />}
    </button>
  );
}
