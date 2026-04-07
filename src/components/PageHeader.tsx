import type { ReactNode } from "react";

interface Props {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export default function PageHeader({ title, subtitle, action }: Props) {
  return (
    <div className="flex items-start justify-between mb-5">
      <div>
        <h1 className="text-[18px] font-semibold text-[#1A1A2E] leading-tight">{title}</h1>
        {subtitle && <p className="text-[13px] text-[#6B7280] mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
