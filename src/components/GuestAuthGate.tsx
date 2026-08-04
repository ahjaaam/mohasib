"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type MouseEvent, type ReactNode } from "react";
import { ArrowRight, Check, ReceiptText, X } from "lucide-react";
import { appUrl } from "@/lib/public-urls";

type GateIntent = "facture" | "devis" | "avoir" | "client" | "article" | "import";

const COPY: Record<GateIntent, { title: string; description: string }> = {
  facture: { title: "Créez votre compte pour enregistrer cette facture", description: "Votre compte conserve vos factures, votre numérotation et vos paiements." },
  devis: { title: "Créez votre compte pour enregistrer ce devis", description: "Envoyez vos devis, suivez leur statut et transformez-les en factures." },
  avoir: { title: "Créez votre compte pour émettre un avoir", description: "Gardez un historique fiable de vos corrections et notes de crédit." },
  client: { title: "Créez votre compte pour ajouter ce client", description: "Centralisez les coordonnées, factures et paiements de vos clients." },
  article: { title: "Créez votre compte pour ajouter cet article", description: "Réutilisez vos produits, prestations, prix et taux de TVA." },
  import: { title: "Créez votre compte pour importer vos données", description: "Importez votre fichier Excel et retrouvez vos données dans votre espace." },
};

function intentFrom(value: string): GateIntent {
  const normalized = value.toLowerCase();
  if (normalized.includes("import")) return "import";
  if (normalized.includes("devis")) return "devis";
  if (normalized.includes("avoir")) return "avoir";
  if (normalized.includes("client")) return "client";
  if (normalized.includes("article") || normalized.includes("prestation")) return "article";
  return "facture";
}

export default function GuestAuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [intent, setIntent] = useState<GateIntent | null>(() =>
    pathname.includes("/new") || pathname.includes("/nouvelle") ? intentFrom(pathname) : null,
  );

  function interceptProtectedAction(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    const protectedControl = target.closest<HTMLElement>(
      '[data-auth-required], [data-permission="invoice:create"]',
    );
    if (!protectedControl) return;

    event.preventDefault();
    event.stopPropagation();
    const label = [
      protectedControl.dataset.authRequired,
      protectedControl.getAttribute("href"),
      protectedControl.textContent,
    ].filter(Boolean).join(" ");
    setIntent(intentFrom(label));
  }

  const copy = intent ? COPY[intent] : null;

  return (
    <div className="contents" onClickCapture={interceptProtectedAction}>
      {children}
      {intent && copy && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-[#0D1526]/55 p-4" onMouseDown={() => setIntent(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="guest-auth-title" className="relative w-full max-w-[430px] border border-black/10 bg-white p-6 shadow-[0_24px_70px_rgba(13,21,38,0.24)] sm:p-8" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" onClick={() => setIntent(null)} aria-label="Fermer" className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center text-[#777E8B] hover:bg-[#F2F2EE] hover:text-[#0D1526]"><X size={17} /></button>
            <div className="mb-5 flex h-11 w-11 items-center justify-center bg-[#F7EFE4] text-[#C8924A]"><ReceiptText size={21} /></div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#A28358]">Mohasib Facturation · Gratuit</p>
            <h2 id="guest-auth-title" className="mt-2 pr-5 text-[23px] font-bold leading-tight tracking-[-0.025em] text-[#0D1526]">{copy.title}</h2>
            <p className="mt-3 text-[13px] leading-6 text-[#666B75]">{copy.description}</p>
            <div className="my-6 grid gap-2 border-y border-black/10 py-5 text-[12px] text-[#374151] sm:grid-cols-2">
              {["Gratuit sans limite", "Sans carte bancaire", "PDF professionnels", "Envoi par e-mail"].map((item) => <span key={item} className="flex items-center gap-2"><Check size={14} className="text-[#059669]" />{item}</span>)}
            </div>
            <Link href="/inscription?mode=invoicing" className="flex min-h-12 w-full items-center justify-center gap-2 bg-[#0D1526] px-5 text-[13px] font-bold text-white hover:bg-[#1B2A47]">Créer mon compte gratuit <ArrowRight size={15} /></Link>
            <p className="mt-4 text-center text-[12px] text-[#777E8B]">Déjà inscrit ? <Link href={appUrl("/connexion")} className="font-bold text-[#A2773E] hover:underline">Se connecter</Link></p>
          </div>
        </div>
      )}
    </div>
  );
}
