import type { ReactNode } from "react";

interface Props {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  icon?: ReactNode;
}

export default function PageHeader({ title, subtitle, action, icon }: Props) {
  return (
    <div className="flex items-start justify-between mb-5">
      <div className="flex items-start gap-3">
        {icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#C8924A]/10 text-[#C8924A]">
            {icon}
          </div>
        )}
        <div>
          <h1 className="text-[18px] font-semibold text-[#1A1A2E] leading-tight">{title}</h1>
          {subtitle && <p className="text-[13px] text-[#6B7280] mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
