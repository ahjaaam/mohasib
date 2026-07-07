import type { Metadata } from "next";
import Link from "next/link";
import { Calculator, ChartNoAxesCombined, Landmark, ReceiptText } from "lucide-react";
import PublicFooter from "@/components/PublicFooter";
import PublicNavbar from "@/components/PublicNavbar";
import { seoMetadata } from "@/lib/seo";

export const metadata: Metadata = seoMetadata({
  title: "Simulateurs comptables Maroc — TVA, IS, paie et rentabilité",
  description: "Utilisez les simulateurs gratuits Mohasib AI pour calculer la TVA, estimer l’IS, simuler un bulletin de paie et projeter votre rentabilité au Maroc.",
  path: "/ressources/outils",
});

const tools = [
  {
    title: "Simulateur TVA",
    description: "Calculez la TVA collectee, la TVA deductible et le montant net a payer.",
    href: "/ressources/outils/tva",
    icon: ReceiptText,
  },
  {
    title: "Simulateur IS",
    description: "Estimez l'impot sur les societes avec les tranches progressives marocaines.",
    href: "/ressources/outils/is",
    icon: Landmark,
  },
  {
    title: "Simulateur Bulletin de Paie",
    description: "Simulez le net a payer, les retenues salariales et le cout employeur.",
    href: "/ressources/outils/paie",
    icon: Calculator,
  },
  {
    title: "Simulateur Rentabilite",
    description: "Projetez votre resultat net estime avec charges, salaires et TVA.",
    href: "/ressources/outils/rentabilite",
    icon: ChartNoAxesCombined,
  },
];

export default function OutilsPage() {
  return (
    <main className="min-h-screen bg-[#FAFAF6]">
      <PublicNavbar />
      <section className="border-b border-[rgba(13,21,38,0.08)] bg-[#FAFAF6] px-6 py-[60px]">
        <div className="mx-auto max-w-4xl text-center">
          <Link href="/ressources" className="text-[12px] font-semibold text-[#C8924A]">← Ressources</Link>
          <p className="mt-6 text-[12px] font-bold uppercase tracking-[0.18em] text-[#C8924A]">Outils de simulation</p>
          <h1 className="mt-4 text-[38px] font-bold leading-tight text-[#0D1526] md:text-[52px]">Choisissez un simulateur</h1>
          <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-7 text-[#6B7280]">
            Des calculateurs simples pour anticiper vos obligations fiscales, sociales et financieres.
          </p>
        </div>
      </section>

      <section className="px-6 py-10">
        <div className="mx-auto grid max-w-6xl gap-5 md:grid-cols-2">
          {tools.map(({ title, description, href, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="group rounded-2xl border border-[rgba(0,0,0,0.08)] bg-white p-6 shadow-[0_10px_28px_rgba(13,21,38,0.05)] transition hover:border-[#C8924A]"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#C8924A]/10 text-[#C8924A]">
                <Icon size={23} />
              </div>
              <h2 className="mt-5 text-[19px] font-bold text-[#0D1526]">{title}</h2>
              <p className="mt-3 text-[13.5px] leading-6 text-[#6B7280]">{description}</p>
              <span className="mt-6 inline-flex text-[13px] font-semibold text-[#C8924A]">Ouvrir le simulateur -&gt;</span>
            </Link>
          ))}
        </div>
      </section>
      <PublicFooter />
    </main>
  );
}
