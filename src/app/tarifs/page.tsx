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

const businessPlans: Plan[] = [
  {
    name: "Starter",
    price: 99,
    tagline: "Pour démarrer votre activité",
    features: [
      "Factures illimitées",
      "Devis illimités",
      "Clients illimités",
      "Déclarations TVA",
      "Boîte de réception (50 docs OCR/mois)",
      "Archivage documents (5 GB)",
      "Suivi des paiements",
      "Export PDF factures",
      "Support 24/7",
    ],
    missing: [
      "Import relevés bancaires",
      "Saisie comptable",
      "La Paie",
      "Export Fiduciaire CGNC",
      "Avoirs clients/fournisseurs",
    ],
  },
  {
    name: "Business",
    price: 229,
    tagline: "La solution complète pour votre activité",
    popular: true,
    features: [
      "Tout Starter +",
      "Import relevés bancaires PDF",
      "Saisie comptable",
      "La Paie (10 employés)",
      "Export Fiduciaire CGNC complet",
      "Avoirs clients et fournisseurs",
      "Boîte de réception (250 docs OCR/mois)",
      "Archivage documents (25 GB)",
      "Déclaration TVA avancée + EDI XML",
      "Suivi paiements (clients + fournisseurs)",
      "Devis avec signature client",
      "Support 24/7",
    ],
    missing: ["Multi-utilisateurs", "Comptable partenaire"],
  },
  {
    name: "Business Pro",
    price: 449,
    tagline: "Pour piloter sans limites",
    dark: true,
    features: [
      "Tout Business +",
      "Employés illimités (La Paie)",
      "Scans OCR illimités",
      "Archive illimitée",
      "3 utilisateurs inclus",
      "Bilan comptable automatique",
      "CPC (Compte de Produits et Charges)",
      "Comptable partenaire (2h/mois)",
      "Support 24/7",
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
      "Saisie comptable par dossier",
      "Déclaration TVA + EDI XML",
      "La Paie (5 employés par dossier)",
      "Export CGNC par dossier",
      "Avoirs clients et fournisseurs",
      "Suivi des paiements",
      "Bilan & CPC automatique",
      "Calendrier fiscal intégré",
      "100 scans OCR/mois (tous dossiers)",
      "Archive (25 GB)",
      "Support 24/7",
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
      "La Paie (10 employés par dossier)",
      "500 scans OCR/mois (tous dossiers)",
      "Archive (100 GB)",
      "Support 24/7",
    ],
    missing: ["Dossiers illimités", "White label cabinet", "Accès API"],
  },
  {
    name: "Illimité",
    price: 999,
    tagline: "Toute la puissance pour votre cabinet",
    dark: true,
    features: [
      "Dossiers illimités",
      "Tout Essentiel +",
      "Employés illimités par dossier",
      "Scans OCR illimités",
      "Archive illimitée",
      "5 collaborateurs du cabinet",
      "White label (votre logo cabinet)",
      "Accès API Mohasib",
      "Support prioritaire WhatsApp",
      "Support 24/7",
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
      ["Avoirs", "✗", "✓", "✓"],
      ["Envoi WhatsApp", "✓", "✓", "✓"],
      ["Signature client devis", "✗", "✓", "✓"],
    ],
  },
  {
    title: "Comptabilité",
    rows: [
      ["Import relevé bancaire", "✗", "✓", "✓"],
      ["Saisie comptable", "✗", "✓", "✓"],
      ["Déclaration TVA", "Basique", "Complète + EDI", "Complète + EDI"],
      ["Export Fiduciaire CGNC", "✗", "✓", "✓"],
      ["Bilan & CPC", "✗", "✗", "✓"],
    ],
  },
  {
    title: "IA & OCR",
    rows: [
      ["Scans OCR", "50/mois", "250/mois", "Illimités"],
      ["Boîte de réception", "✓", "✓", "✓"],
    ],
  },
  {
    title: "Paie & RH",
    rows: [
      ["Gestion employés", "✗", "10 max", "Illimités"],
      ["Bulletins de paie", "✗", "✓", "✓"],
    ],
  },
  {
    title: "Stockage & accès",
    rows: [
      ["Archive", "5 GB", "25 GB", "Illimitée"],
      ["Utilisateurs", "1", "1", "3"],
      ["Comptable partenaire", "✗", "✗", "2h/mois"],
      ["Support 24/7", "✓", "✓", "✓"],
    ],
  },
  { title: "Prix", rows: [["Prix mensuel", "99 MAD", "229 MAD", "449 MAD"]] },
];

const comptableComparison: ComparisonSection[] = [
  {
    title: "Dossiers",
    rows: [
      ["Nombre dossiers", "5", "20", "Illimités"],
      ["Email dédié/dossier", "✓", "✓", "✓"],
      ["Inbox global", "✗", "✓", "✓"],
    ],
  },
  {
    title: "Par dossier",
    rows: [
      ["Facturation", "Illimitée", "Illimitée", "Illimitée"],
      ["Saisie comptable", "✓", "✓", "✓"],
      ["Déclaration TVA + EDI", "✓", "✓", "✓"],
      ["Export CGNC", "✓", "✓", "✓"],
      ["Employés paie", "5", "10", "Illimités"],
      ["Bilan & CPC", "✓", "✓", "✓"],
    ],
  },
  {
    title: "Masse",
    rows: [
      ["TVA en masse", "✗", "✓", "✓"],
      ["Export ZIP", "✗", "✓", "✓"],
    ],
  },
  {
    title: "OCR & stockage",
    rows: [
      ["Scans OCR", "100/mois", "500/mois", "Illimités"],
      ["Archive", "25 GB", "100 GB", "Illimitée"],
      ["Collaborateurs", "1", "2", "5"],
      ["Support 24/7", "✓", "✓", "✓"],
    ],
  },
  { title: "Prix", rows: [["Prix mensuel", "299 MAD", "599 MAD", "999 MAD"]] },
];

function Feature({ children, missing = false, dark = false }: { children: React.ReactNode; missing?: boolean; dark?: boolean }) {
  const Icon = missing ? X : Check;
  return (
    <li className={`flex items-start gap-2.5 text-[13px] leading-5 ${missing ? "text-[#9CA3AF]" : dark ? "text-white/85" : "text-[#374151]"}`}>
      <Icon className={`mt-0.5 shrink-0 ${missing ? "text-[#9CA3AF]" : "text-[#C8924A]"}`} size={15} strokeWidth={2.5} />
      <span>{children}</span>
    </li>
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  return (
    <article className={`relative flex h-full flex-col rounded-2xl border p-7 ${plan.popular ? "border-2 border-[#C8924A] bg-white shadow-[0_18px_50px_rgba(13,21,38,0.10)]" : plan.dark ? "border-[#0D1526] bg-[#0D1526]" : "border-black/[0.08] bg-white"}`}>
      <h2 className={`text-[17px] font-bold uppercase ${plan.dark ? "text-white" : "text-[#0D1526]"}`}>{plan.name}</h2>
      <p className={`mt-3 flex items-end gap-1 font-extrabold leading-none ${plan.popular ? "text-[#C8924A]" : plan.dark ? "text-white" : "text-[#0D1526]"}`}>
        <span className="text-[45px]">{plan.price}</span>
        <span className={`pb-1 text-[12px] font-semibold ${plan.dark ? "text-white/55" : "text-[#6B7280]"}`}>MAD/mois</span>
      </p>
      <p className={`mt-3 text-[13px] ${plan.dark ? "text-white/55" : "text-[#6B7280]"}`}>{plan.tagline}</p>

      <Link
        href={appUrl("/inscription")}
        className={`mt-3 inline-flex w-fit text-[12px] font-bold underline underline-offset-4 transition hover:text-[#B6813F] ${plan.dark ? "text-[#D9AE73]" : "text-[#C8924A]"}`}
      >
        Créer un compte gratuitement
      </Link>

      <div className={`my-6 h-px ${plan.dark ? "bg-white/10" : "bg-black/[0.07]"}`} />
      <ul className="space-y-2.5">
        {plan.features.map((feature) => <Feature key={feature} dark={plan.dark}>{feature}</Feature>)}
        {plan.missing?.map((feature) => <Feature key={feature} missing dark={plan.dark}>{feature}</Feature>)}
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
    if (value === "✓") return <Check aria-label="Inclus" className="text-[#C8924A]" size={17} strokeWidth={2.8} />;
    if (value === "✗") return <X aria-label="Non inclus" className="text-[#B8BEC7]" size={16} strokeWidth={2.4} />;
    return value;
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-black/[0.08] bg-white">
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
                <tr key={`${section.title}-${row[0]}`} className={rowIndex % 2 === 0 ? "bg-white" : "bg-[#FAFAF6]"}>
                  {row.map((value, index) => (
                    <td key={`${row[0]}-${index}`} className={`border-t border-black/[0.06] px-5 py-3.5 ${index === 0 ? "font-semibold text-[#374151]" : value === "✓" || value === "✗" ? "text-left" : "text-[#6B7280]"}`}>
                      <span className={value === "✓" || value === "✗" ? "inline-flex items-center justify-start" : undefined}>
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
    <main className="min-h-screen bg-[#FAFAF6] text-[#0D1526]">
      <PublicNavbar />

      <div className="mx-auto max-w-[1200px] px-5 pb-20 pt-16 sm:px-10 sm:pb-24 sm:pt-24">
        <header className="text-center">
          <p className="text-[11px] font-bold uppercase tracking-[2px] text-[#C8924A]">Tarification</p>
          <h1 className="mt-3 text-[38px] font-bold leading-tight md:text-[52px]">Choisissez votre plan</h1>
          <p className="mt-3 text-[15px] text-[#6B7280]">Des plans adaptés à votre activité et à la taille de votre équipe.</p>

          <div className="mt-9 inline-flex rounded-full border border-black/[0.08] bg-white p-1 shadow-sm" role="tablist" aria-label="Type de plan">
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
          <a href="mailto:contact@mohasibai.com" className="mt-2 inline-block text-[13px] font-bold text-[#C8924A] hover:underline">Contactez-nous pour un devis sur mesure →</a>
          <p className="mt-5 text-[12px] text-[#6B7280]">
            En souscrivant à Mohasib AI, vous acceptez nos{" "}
            <Link href="/cgu" className="font-semibold text-[#C8924A] hover:underline">CGU</Link>
            {" "}et notre{" "}
            <Link href="/confidentialite" className="font-semibold text-[#C8924A] hover:underline">Politique de Confidentialité</Link>.
          </p>
        </section>
      </div>

      <PublicFooter />
    </main>
  );
}

export default function TarifsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FAFAF6]" />}>
      <PricingContent />
    </Suspense>
  );
}
