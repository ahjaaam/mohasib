"use client";

import { useRouter } from "next/navigation";
import { Folder, X } from "lucide-react";

interface Props {
  dossier: { id: string; raison_sociale: string; ice?: string | null; regime_tva: string };
}

export default function DossierBanner({ dossier }: Props) {
  const router = useRouter();

  function exitDossier() {
    document.cookie = "active_dossier_id=; path=/; max-age=0";
    router.push(`/comptable-pro/dossiers/${dossier.id}`);
    router.refresh();
  }

  return (
    <div
      className="flex items-center justify-between px-4 h-10 text-white text-[12.5px] flex-shrink-0"
      style={{ backgroundColor: "#C8924A" }}
    >
      <div className="flex items-center gap-2.5">
        <Folder size={14} />
        <span className="font-semibold">{dossier.raison_sociale}</span>
        {dossier.ice && <span className="opacity-75">· ICE: {dossier.ice}</span>}
        <span className="opacity-60 uppercase text-[10px] tracking-wider bg-white/20 px-1.5 py-0.5 rounded">
          TVA {dossier.regime_tva}
        </span>
      </div>
      <button
        onClick={exitDossier}
        className="flex items-center gap-1.5 opacity-80 hover:opacity-100 transition-opacity"
      >
        <span>← Retour au dossier</span>
        <X size={13} />
      </button>
    </div>
  );
}
