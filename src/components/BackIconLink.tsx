import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface Props {
  href: string;
  label?: string;
}

export default function BackIconLink({ href, label = "Retour" }: Props) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[rgba(0,0,0,0.16)] bg-[#FAFAF6] text-[#6B7280] shadow-[0_1px_2px_rgba(13,21,38,0.06)] transition hover:border-[#C8924A]/45 hover:bg-[#F0EDE5] hover:text-[#C8924A]"
    >
      <ArrowLeft size={16} />
    </Link>
  );
}
