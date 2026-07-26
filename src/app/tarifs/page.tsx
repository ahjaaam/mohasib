"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Building2,
  Check,
  Landmark,
  X,
} from "lucide-react";
import { Fragment, Suspense, useState } from "react";
import PublicFooter from "@/components/PublicFooter";
import PublicNavbar from "@/components/PublicNavbar";
import { appUrl } from "@/lib/public-urls";

type Track = "business" | "comptable";

type Plan = {
  name: string;
  price: number;
  priceLabel?: string;
  tagline: string;
  features: string[];
  missing?: string[];
  note?: string;
  popular?: boolean;
  dark?: boolean;
};

type ComparisonSection = {
  title: string;
  rows: [string, string, string, string][];
};

const INCLUDED = "included";
const EXCLUDED = "excluded";

const businessPlans: Plan[] = [
  {
    name: "Starter",
    price: 99,
    tagline: "Pour démarrer votre activité",
    features: [
      "Factures illimitées",
      "Devis illimités",
      "Clients illimités",
      "Déclaration TVA",
      "Boîte de réception (50 docs OCR/mois)",
      "Archivage documents (5 GB)",
      "Suivi des paiements",
      "Support 7j/7",
    ],
    missing: [
      "Avoirs clients",
      "Import relevés bancaires",
      "Export EDI XML TVA",
      "Écritures automatiques",
      "La paie",
      "Export CGNC",
    ],
  },
  {
    name: "Business",
    price: 229,
    tagline: "La solution complète pour votre activité",
    popular: true,
    features: [
      "Toutes les fonctionnalités Starter",
      "Avoirs clients",
      "Import relevés bancaires",
      "Déclaration TVA + EDI XML",
      "Écritures automatiques",
      "La paie (10 employés)",
      "Export CGNC complet",
      "Boîte de réception (250 docs OCR/mois)",
      "Archivage documents (25 GB)",
      "Suivi des paiements",
      "Support 7j/7",
    ],
    missing: ["Multi-utilisateurs"],
  },
  {
    name: "Business Pro",
    price: 449,
    priceLabel: "À partir de 449",
    tagline: "Pour piloter sans limites",
    dark: true,
    features: [
      "Toutes les fonctionnalités Business",
      "Gestion de la paie sans limite d’employés",
      "Boîte de réception illimitée",
      "Archivage des documents illimité",
      "3 utilisateurs inclus",
      "Bilan comptable automatique",
      "CPC automatique",
      "Avoirs, TVA EDI, import bancaire et exports inclus",
      "Support 7j/7",
    ],
  },
];

const comptablePlans: Plan[] = [
  {
    name: "Starter",
    price: 299,
    tagline: "Pour débuter avec vos premiers clients",
    features: [
      "5 dossiers clients",
      "Interface cabinet dédiée",
      "Adresse email dédiée par dossier",
      "Facturation complète par dossier",
      "Écritures automatiques par dossier",
      "Déclaration TVA + EDI XML",
      "La paie (5 employés par dossier)",
      "Export CGNC par dossier",
      "Suivi des paiements",
      "Bilan & CPC automatique",
      "Calendrier fiscal intégré",
      "100 scans OCR/mois (tous dossiers)",
      "Archive (25 GB)",
      "Support 7j/7",
    ],
    missing: [
      "Déclarations TVA en masse",
      "Export ZIP multi-dossiers",
      "Multi-utilisateurs cabinet",
    ],
  },
  {
    name: "Essentiel",
    price: 599,
    tagline: "Le cabinet connecté et productif",
    popular: true,
    features: [
      "20 dossiers clients",
      "Tout Starter +",
      "Déclarations TVA en masse",
      "Export ZIP multi-dossiers (1 click)",
      "Inbox global + routage IA",
      "2 collaborateurs du cabinet",
      "La paie (10 employés par dossier)",
      "500 scans OCR/mois (tous dossiers)",
      "Archive (100 GB)",
      "Support 7j/7",
    ],
    missing: ["Dossiers illimités"],
  },
  {
    name: "Illimité",
    price: 999,
    priceLabel: "À partir de 999",
    tagline: "Toute la puissance pour votre cabinet",
    dark: true,
    features: [
      "Dossiers illimités",
      "Tout Essentiel +",
      "Employés illimités par dossier",
      "Scans OCR illimités",
      "Archive illimitée",
      "5 collaborateurs du cabinet",
      "Support prioritaire WhatsApp",
      "Support 7j/7",
      "Onboarding + formation incluse",
      "Migration depuis Synergie/Sage assistée",
    ],
  },
];

const businessComparison: ComparisonSection[] = [
  {
    title: "Facturation",
    rows: [
      ["Factures", "Illimitées", "Illimitées", "Illimitées"],
      ["Devis", "Illimités", "Illimités", "Illimités"],
      ["Avoirs", EXCLUDED, "Illimités", "Illimités"],
      ["Envoi WhatsApp", INCLUDED, INCLUDED, INCLUDED],
    ],
  },
  {
    title: "Comptabilité",
    rows: [
      ["Import relevé bancaire", EXCLUDED, INCLUDED, INCLUDED],
      ["Écritures automatiques", EXCLUDED, INCLUDED, INCLUDED],
      ["Déclaration TVA", INCLUDED, INCLUDED, INCLUDED],
      ["Export EDI XML TVA", EXCLUDED, INCLUDED, INCLUDED],
      ["Export CGNC", EXCLUDED, INCLUDED, INCLUDED],
      ["Bilan & CPC", EXCLUDED, EXCLUDED, INCLUDED],
    ],
  },
  {
    title: "IA & OCR",
    rows: [
      ["Scans OCR", "50/mois", "250/mois", "Illimités"],
      ["Boîte de réception", INCLUDED, INCLUDED, INCLUDED],
    ],
  },
  {
    title: "Paie & RH",
    rows: [
      ["Gestion employés", EXCLUDED, "10 max", "Illimités"],
      ["Bulletins de paie", EXCLUDED, INCLUDED, INCLUDED],
    ],
  },
  {
    title: "Stockage & accès",
    rows: [
      ["Archive", "5 GB", "25 GB", "Illimitée"],
      ["Utilisateurs", "1", "1", "3"],
      ["Support 7j/7", INCLUDED, INCLUDED, INCLUDED],
    ],
  },
  { title: "Prix", rows: [["Prix mensuel", "99 MAD", "229 MAD", "À partir de 449 MAD"]] },
];

const comptableComparison: ComparisonSection[] = [
  {
    title: "Dossiers",
    rows: [
      ["Nombre dossiers", "5", "20", "Illimités"],
      ["Email dédié/dossier", INCLUDED, INCLUDED, INCLUDED],
      ["Inbox global", EXCLUDED, INCLUDED, INCLUDED],
    ],
  },
  {
    title: "Par dossier",
    rows: [
      ["Facturation", "Illimitée", "Illimitée", "Illimitée"],
      ["Écritures automatiques", INCLUDED, INCLUDED, INCLUDED],
      ["Déclaration TVA + EDI", INCLUDED, INCLUDED, INCLUDED],
      ["Export CGNC", INCLUDED, INCLUDED, INCLUDED],
      ["Employés paie", "5", "10", "Illimités"],
      ["Bilan & CPC", INCLUDED, INCLUDED, INCLUDED],
    ],
  },
  {
    title: "Masse",
    rows: [
      ["TVA en masse", EXCLUDED, INCLUDED, INCLUDED],
      ["Export ZIP", EXCLUDED, INCLUDED, INCLUDED],
    ],
  },
  {
    title: "OCR & stockage",
    rows: [
      ["Scans OCR", "100/mois", "500/mois", "Illimités"],
      ["Archive", "25 GB", "100 GB", "Illimitée"],
      ["Collaborateurs", "1", "2", "5"],
      ["Support 7j/7", INCLUDED, INCLUDED, INCLUDED],
    ],
  },
  { title: "Prix", rows: [["Prix mensuel", "299 MAD", "599 MAD", "À partir de 999 MAD"]] },
];

function Feature({ children, missing = false }: { children: React.ReactNode; missing?: boolean; dark?: boolean }) {
  const Icon = missing ? X : Check;
  return (
    <li className={`flex items-start gap-2.5 text-[13px] leading-5 ${missing ? "text-[#9CA3AF]" : "text-[#374151]"}`}>
      <Icon className={`mt-0.5 shrink-0 ${missing ? "text-[#9CA3AF]" : "text-[#7A6668]"}`} size={15} strokeWidth={2.5} />
      <span>{children}</span>
    </li>
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  return (
    <article className={`public-surface relative flex h-full flex-col p-7 ${plan.popular || plan.dark ? "public-accent-surface" : ""}`}>
      <h2 className="text-[17px] font-bold uppercase text-[#0D1526]">{plan.name}</h2>
      <p className={`mt-3 flex items-end gap-1 font-extrabold leading-none ${plan.popular || plan.dark ? "text-[#7A6668]" : "text-[#0D1526]"}`}>
        <span className={plan.priceLabel ? "text-[28px]" : "text-[45px]"}>{plan.priceLabel ?? plan.price}</span>
        <span className="pb-1 text-[12px] font-semibold text-[#6B7280]">MAD/mois</span>
      </p>
      <p className="mt-3 text-[13px] text-[#6B7280]">{plan.tagline}</p>

      <Link
        href={appUrl("/inscription")}
        className="mt-3 inline-flex w-fit text-[12px] font-bold text-[#7A6668] underline underline-offset-4 transition hover:text-[#A18E8F]"
      >
        Créer un compte gratuitement
      </Link>

      <div className="my-6 h-px bg-black/[0.07]" />
      <ul className="space-y-2.5">
        {plan.features.map((feature) => <Feature key={feature}>{feature}</Feature>)}
        {plan.missing?.map((feature) => <Feature key={feature} missing>{feature}</Feature>)}
      </ul>
      {plan.note && <p className="mt-4 pl-6 text-[11px] italic text-[#D9AE73]">{plan.note}</p>}
    </article>
  );
}

function ComparisonTable({ track }: { track: Track }) {
  const sections = track === "business" ? businessComparison : comptableComparison;
  const headings = track === "business"
    ? ["Fonctionnalité", "Starter", "Business", "Business Pro"]
    : ["Fonctionnalité", "Starter", "Essentiel", "Illimité"];
  const renderValue = (value: string) => {
    if (value === INCLUDED) return <Check aria-label="Inclus" className="text-[#7A6668]" size={17} strokeWidth={2.8} />;
    if (value === EXCLUDED) return <X aria-label="Non inclus" className="text-[#B8BEC7]" size={16} strokeWidth={2.4} />;
    return value;
  };

  return (
    <div className="public-surface overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-left text-[12px]">
        <thead className="bg-[#0D1526] text-white">
          <tr>{headings.map((heading) => <th key={heading} className="px-5 py-4 font-semibold">{heading}</th>)}</tr>
        </thead>
        <tbody>
          {sections.map((section) => (
            <Fragment key={section.title}>
              <tr className="bg-[#F2F2ED]">
                <th colSpan={4} className="px-5 py-3 text-[11px] font-bold uppercase tracking-[1.5px] text-[#6B7280]">{section.title}</th>
              </tr>
              {section.rows.map((row, rowIndex) => (
                <tr key={`${section.title}-${row[0]}`} className={rowIndex % 2 === 0 ? "bg-white" : "bg-[#F8F7F7]"}>
                  {row.map((value, index) => (
                    <td key={`${row[0]}-${index}`} className={`border-t border-black/[0.06] px-5 py-3.5 ${index === 0 ? "font-semibold text-[#374151]" : value === INCLUDED || value === EXCLUDED ? "text-left" : "text-[#6B7280]"}`}>
                      <span className={value === INCLUDED || value === EXCLUDED ? "inline-flex items-center justify-start" : undefined}>
                        {renderValue(value)}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PricingContent() {
  const searchParams = useSearchParams();
  const initialTrack = searchParams.get("plan") === "comptable" ? "comptable" : "business";
  const [track, setTrack] = useState<Track>(initialTrack);
  const plans = track === "business" ? businessPlans : comptablePlans;

  function selectTrack(nextTrack: Track) {
    setTrack(nextTrack);
    window.history.replaceState(null, "", nextTrack === "comptable" ? "/tarifs?plan=comptable" : "/tarifs");
  }

  return (
    <main className="public-site">
      <PublicNavbar />

      <div className="mx-auto max-w-[1200px] px-5 pb-20 pt-16 sm:px-10 sm:pb-24 sm:pt-24">
        <header className="text-center">
          <p className="public-eyebrow">Tarification</p>
          <h1 className="mt-3 text-[38px] font-bold leading-tight md:text-[52px]">Choisissez votre plan</h1>
          <p className="mt-3 text-[15px] text-[#6B7280]">Des plans adaptés à votre activité et à la taille de votre équipe.</p>

          <div className="mt-9 inline-flex border border-[#DADAD5] bg-white p-1" role="tablist" aria-label="Type de plan">
            <button onClick={() => selectTrack("business")} role="tab" aria-selected={track === "business"} className={`inline-flex min-h-10 items-center gap-2 rounded-full px-5 text-[13px] font-semibold transition-colors ${track === "business" ? "bg-[#0D1526] text-white" : "text-[#6B7280] hover:text-[#0D1526]"}`}>
              <Building2 size={16} /> Business
            </button>
            <button onClick={() => selectTrack("comptable")} role="tab" aria-selected={track === "comptable"} className={`inline-flex min-h-10 items-center gap-2 rounded-full px-5 text-[13px] font-semibold transition-colors ${track === "comptable" ? "bg-[#0D1526] text-white" : "text-[#6B7280] hover:text-[#0D1526]"}`}>
              <Landmark size={16} /> Comptable Pro
            </button>
          </div>
        </header>

        <section key={track} className="mx-auto mt-14 grid max-w-[1040px] gap-5 md:grid-cols-3">
          {plans.map((plan) => <PlanCard key={plan.name} plan={plan} />)}
        </section>

        <section className="mx-auto mt-12 max-w-[1040px]">
          <ComparisonTable track={track} />
        </section>

        <section className="mx-auto mt-16 max-w-[1040px] text-center">
          <p className="text-[15px] font-semibold">Vous avez des besoins spécifiques ?</p>
          <a href="mailto:contact@mohasibai.com" className="mt-2 inline-block text-[13px] font-bold text-[#7A6668] hover:underline">Contactez-nous pour un devis sur mesure →</a>
          <p className="mt-5 text-[12px] text-[#6B7280]">
            En souscrivant à Mohasib AI, vous acceptez nos{" "}
            <Link href="/cgu" className="font-semibold text-[#7A6668] hover:underline">CGU</Link>
            {" "}et notre{" "}
            <Link href="/confidentialite" className="font-semibold text-[#7A6668] hover:underline">Politique de Confidentialité</Link>.
          </p>
        </section>
      </div>

      <PublicFooter />
    </main>
  );
}

export default function TarifsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F8F7F7]" />}>
      <PricingContent />
    </Suspense>
  );
}
