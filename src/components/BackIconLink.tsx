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
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[rgba(0,0,0,0.08)] bg-white text-[#6B7280] transition hover:border-[#C8924A]/40 hover:text-[#C8924A]"
    >
      <ArrowLeft size={16} />
    </Link>
  );
}
