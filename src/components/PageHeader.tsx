import type { ReactNode } from "react";

interface Props {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  icon?: ReactNode;
  iconBare?: boolean;
}

export default function PageHeader({ title, subtitle, action, icon, iconBare = false }: Props) {
  return (
    <div className="mb-5 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        {icon && (iconBare ? icon : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center bg-[rgba(200,146,74,0.12)] text-[#C8924A]">
            {icon}
          </div>
        ))}
        <div className="min-w-0">
          <h1 className="text-[18px] font-bold leading-none text-[#1A1A2E]">{title}</h1>
          {subtitle && <p className="mt-0.5 text-[11px] text-[#9CA3AF]">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}
