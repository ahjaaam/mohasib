import Link from "next/link";
import { BookOpen, Calculator, Download } from "lucide-react";
import PublicNavbar from "@/components/PublicNavbar";
import PublicFooter from "@/components/PublicFooter";

const cards = [
  {
    title: "Blog",
    subtitle: "Tout savoir sur la comptabilite et l'entrepreneuriat",
    description:
      "Articles pratiques sur la TVA, l'IS, la paie, la gestion de tresorerie et les obligations fiscales au Maroc. Rediges pour les non-comptables.",
    cta: "Lire les articles ->",
    href: "/ressources/blog",
    icon: BookOpen,
  },
  {
    title: "Outils de simulation",
    subtitle: "Simulations personnalisees",
    description:
      "Calculez votre TVA, estimez votre IS, simulez vos bulletins de paie et anticipez vos charges sociales - sans inscription requise.",
    cta: "Acceder aux outils ->",
    href: "/ressources/outils",
    icon: Calculator,
  },
  {
    title: "Documents téléchargeables",
    subtitle: "Modèles, templates et documents prêts à l’emploi",
    description:
      "Contrats, modèles Word, PDF pratiques, checklists et documents utiles pour les entrepreneurs, financiers et comptables au Maroc.",
    cta: "Voir les documents ->",
    href: "/ressources/documents",
    icon: Download,
  },
];

export default function RessourcesPage() {
  return (
    <main className="min-h-screen bg-white">
      <PublicNavbar />
      <section className="border-b border-[rgba(13,21,38,0.08)] bg-[#FAFAF6] px-6 py-[60px]">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-[#C8924A]">Ressources</p>
          <h1 className="mx-auto mt-4 max-w-3xl text-[38px] font-bold leading-tight text-[#0D1526] md:text-[52px]">
            Tout ce qu'il vous faut pour gerer votre comptabilite
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-7 text-[#6B7280]">
            Articles, simulateurs et documents gratuits conçus pour les entrepreneurs marocains
          </p>
        </div>
      </section>

      <section className="bg-white px-6 py-16 md:px-10 md:py-20">
        <div className="mx-auto grid max-w-6xl gap-5 md:grid-cols-3">
          {cards.map(({ title, subtitle, description, cta, href, icon: Icon }) => (
            <Link
              key={title}
              href={href}
              className="group rounded-2xl border border-[rgba(0,0,0,0.08)] bg-white p-7 transition hover:border-[#C8924A] hover:shadow-[0_14px_35px_rgba(13,21,38,0.08)]"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#C8924A]/10 text-[#C8924A]">
                <Icon size={24} />
              </div>
              <h2 className="mt-6 text-[20px] font-bold text-[#0D1526]">{title}</h2>
              <p className="mt-2 text-[13px] font-semibold text-[#C8924A]">{subtitle}</p>
              <p className="mt-4 text-[13.5px] leading-6 text-[#6B7280]">{description}</p>
              <span className="mt-6 inline-flex text-[13px] font-semibold text-[#C8924A]">{cta}</span>
            </Link>
          ))}
        </div>
      </section>
      <PublicFooter />
    </main>
  );
}
