"use client";

import { type ReactNode, useState } from "react";
import { createPortal } from "react-dom";

interface Props {
  children: ReactNode;
  enabled: boolean;
  label: string;
}

export default function SidebarItemTooltip({ children, enabled, label }: Props) {
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);

  if (!enabled) return children;

  function showTooltip(element: HTMLElement) {
    const rect = element.getBoundingClientRect();
    setPosition({
      left: rect.right + 10,
      top: rect.top + rect.height / 2,
    });
  }

  return (
    <div
      className="relative"
      onMouseEnter={(event) => showTooltip(event.currentTarget)}
      onMouseLeave={() => setPosition(null)}
      onFocusCapture={(event) => showTooltip(event.currentTarget)}
      onBlurCapture={() => setPosition(null)}
    >
      {children}
      {position && createPortal(
        <div
          role="tooltip"
          className="pointer-events-none fixed z-[100] -translate-y-1/2 whitespace-nowrap rounded-md bg-[#242424] px-3 py-2 text-[13px] font-medium leading-none text-white shadow-[0_8px_24px_rgba(0,0,0,0.24)]"
          style={{ left: position.left, top: position.top }}
        >
          <span className="absolute left-[-4px] top-1/2 h-2 w-2 -translate-y-1/2 rotate-45 bg-[#242424]" aria-hidden="true" />
          {label}
        </div>,
        document.body,
      )}
    </div>
  );
}
