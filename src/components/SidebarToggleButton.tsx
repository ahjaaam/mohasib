"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  collapsed: boolean;
  onToggle: () => void;
};

export default function SidebarToggleButton({ collapsed, onToggle }: Props) {
  const label = collapsed ? "Développer la navigation" : "Réduire la navigation";

  return (
    <button
      type="button"
      onClick={onToggle}
      title={label}
      aria-label={label}
      className="absolute bottom-6 right-0 z-30 hidden h-8 w-6 translate-x-1/2 items-center justify-center rounded-none border border-white/[0.14] bg-[#171922] text-white/90 shadow-[0_5px_14px_rgba(0,0,0,0.28)] transition-colors hover:border-white/25 hover:bg-[#20232E] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8924A] focus-visible:ring-offset-2 focus-visible:ring-offset-[#171922] md:flex"
    >
      {collapsed ? <ChevronRight size={13} strokeWidth={2.2} /> : <ChevronLeft size={13} strokeWidth={2.2} />}
    </button>
  );
}
