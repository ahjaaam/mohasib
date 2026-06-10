"use client";

import Link from "next/link";
import { Lock } from "lucide-react";

export default function AccessRestricted({ backHref = "/tableau-de-bord" }: { backHref?: string }) {
  return (
    <div className="flex min-h-[55vh] items-center justify-center p-5">
      <div className="max-w-md text-center">
        <Lock className="mx-auto text-[#C8924A]" size={28} />
        <h1 className="mt-4 text-[18px] font-bold text-[#0D1526]">Accès restreint</h1>
        <p className="mt-2 text-[13px] leading-6 text-[#6B7280]">Vous n&apos;avez pas la permission de voir cette page.</p>
        <Link href={backHref} className="mt-5 inline-flex rounded-lg bg-[#0D1526] px-4 py-2.5 text-[12px] font-bold text-white">Retour</Link>
      </div>
    </div>
  );
}
