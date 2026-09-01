import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Download } from "lucide-react";
import PublicNavbar from "@/components/PublicNavbar";
import PublicFooter from "@/components/PublicFooter";
import { seoMetadata } from "@/lib/seo";

export const metadata: Metadata = seoMetadata({
  title: "Ressources pour gérer votre entreprise au Maroc | Mohasib AI",
  description: "Consultez des articles pratiques et téléchargez des modèles pour mieux gérer la comptabilité, la fiscalité et l’administration de votre entreprise au Maroc.",
  path: "/ressources",
});

const cards = [
  {
    title: "Blog",
    subtitle: "Des réponses claires aux questions de gestion courantes",
    description:
      "Comprenez la TVA, l’IS, la paie, la trésorerie et les obligations fiscales au Maroc grâce à des articles directement applicables.",
    cta: "Consulter le blog →",
    href: "/ressources/blog",
    icon: BookOpen,
  },
  {
    title: "Documents téléchargeables",
    subtitle: "Des modèles prêts à adapter à votre activité",
    description:
      "Gagnez du temps avec des contrats, tableaux, checklists et documents utiles aux dirigeants, financiers et comptables au Maroc.",
    cta: "Parcourir les documents →",
    href: "/ressources/documents",
    icon: Download,
  },
];

export default function RessourcesPage() {
  return (
    <main className="public-site ressources-page">
      <PublicNavbar />
      <section className="public-page-hero">
        <div className="mx-auto max-w-4xl text-center">
          <p className="public-eyebrow">Ressources</p>
          <h1 className="mx-auto mt-4 max-w-3xl text-[38px] font-bold leading-tight text-[#0D1526] md:text-[52px]">
            Des ressources pratiques pour mieux gérer votre entreprise
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-7 text-[#6B7280]">
            Des contenus clairs et des modèles prêts à l’emploi pour passer plus vite de la question à l’action.
          </p>
        </div>
      </section>

      <section className="px-6 py-16 md:px-10 md:py-20">
        <div className="mx-auto grid max-w-4xl gap-5 md:grid-cols-2">
          {cards.map(({ title, subtitle, description, cta, href, icon: Icon }) => (
            <Link
              key={title}
              href={href}
              className="public-surface public-interactive-surface group p-7"
            >
              <div className="public-icon-tile h-12 w-12">
                <Icon size={24} />
              </div>
              <h2 className="mt-6 text-[20px] font-bold text-[#0D1526]">{title}</h2>
              <p className="mt-2 text-[13px] font-semibold text-[#B58A52]">{subtitle}</p>
              <p className="mt-4 text-[13.5px] leading-6 text-[#6B7280]">{description}</p>
              <span className="mt-6 inline-flex text-[13px] font-semibold text-[#B58A52]">{cta}</span>
            </Link>
          ))}
        </div>
      </section>
      <PublicFooter />
    </main>
  );
}
