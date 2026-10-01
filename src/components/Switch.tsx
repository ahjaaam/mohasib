type SwitchProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
};

export default function Switch({
  checked,
  onCheckedChange,
  label,
  disabled = false,
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className="group inline-flex h-10 w-12 shrink-0 items-center justify-center bg-transparent outline-none transition-transform duration-150 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-[#C8924A] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
    >
      <span
        aria-hidden="true"
        className={`relative h-6 w-11 rounded-full border transition-[background-color,border-color,box-shadow] duration-200 ease-out motion-reduce:transition-none ${
          checked
            ? "border-[#0D1526] bg-[#0D1526] shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)] group-hover:border-[#19274A] group-hover:bg-[#19274A]"
            : "border-[#C9CED6] bg-[#E3E6EB] shadow-[inset_0_1px_2px_rgba(13,21,38,0.08)] group-hover:border-[#B9C0CA] group-hover:bg-[#D9DDE3]"
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-[18px] w-[18px] rounded-full border border-black/[0.06] bg-white shadow-[0_1px_3px_rgba(13,21,38,0.28)] transition-transform duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </span>
    </button>
  );
}
