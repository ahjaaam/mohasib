"use client";

import { Check, Minus } from "lucide-react";

export default function TableSelectionCheckbox({
  checked,
  indeterminate = false,
  onChange,
  label,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  label: string;
}) {
  const active = checked || indeterminate;

  return (
    <label className="relative inline-flex h-4 w-4 cursor-pointer items-center justify-center">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        aria-label={label}
        className="peer absolute inset-0 m-0 h-full w-full cursor-pointer opacity-0"
      />
      <span
        aria-hidden="true"
        className={`pointer-events-none flex h-3.5 w-3.5 items-center justify-center border transition-colors ${
          active
            ? "border-[#C8924A] bg-[#C8924A] text-white"
            : "border-[#E5E2DC] bg-white text-transparent peer-hover:border-[#D3CEC5]"
        }`}
      >
        {indeterminate ? <Minus size={10} strokeWidth={2.5} /> : <Check size={10} strokeWidth={2.5} />}
      </span>
    </label>
  );
}
