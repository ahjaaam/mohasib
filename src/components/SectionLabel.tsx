import type { ReactNode } from "react";

export default function SectionLabel({
  children,
  className = "mb-3",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="h-4 w-[3px] flex-shrink-0 bg-[#C8924A]" />
      <span className="text-[11px] font-semibold uppercase tracking-[1px] text-[#6B7280]">
        {children}
      </span>
    </div>
  );
}
