"use client";

import Link from "next/link";
import { Lock } from "lucide-react";

export default function AccessRestricted({
  backHref = "/tableau-de-bord",
  reason = "permission",
  message,
}: {
  backHref?: string;
  reason?: "permission" | "plan" | "suspended";
  message?: string;
}) {
  const copy = message ?? (reason === "plan"
    ? "Cette fonctionnalité n'est pas incluse dans le plan actuel du compte."
    : reason === "suspended"
      ? "Ce compte est suspendu. Contactez le support Mohasib pour obtenir de l'aide."
      : "Le propriétaire ne vous a pas accordé l'accès à cette section. Demandez-lui d'ajuster vos permissions dans Paramètres > Équipe.");

  return (
    <div className="flex min-h-[55vh] items-center justify-center p-5">
      <div className="max-w-md text-center">
        <Lock className="mx-auto text-[#C8924A]" size={28} />
        <h1 className="mt-4 text-[18px] font-bold text-[#0D1526]">Accès restreint</h1>
        <p className="mt-2 text-[13px] leading-6 text-[#6B7280]">{copy}</p>
        <Link href={backHref} className="mt-5 inline-flex rounded-lg bg-[#0D1526] px-4 py-2.5 text-[12px] font-bold text-white">Retour</Link>
      </div>
    </div>
  );
}
