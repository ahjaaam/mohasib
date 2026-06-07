import Link from "next/link";
import { Calculator, ChartNoAxesCombined, Landmark, ReceiptText } from "lucide-react";
import PublicFooter from "@/components/PublicFooter";
import PublicNavbar from "@/components/PublicNavbar";

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
      <section className="bg-[#0D1526] px-6 py-[60px]">
        <div className="mx-auto max-w-6xl">
          <Link href="/ressources" className="text-[12px] font-semibold text-[#C8924A]">← Ressources</Link>
          <p className="mt-6 text-[12px] font-bold uppercase tracking-[0.18em] text-[#C8924A]">Outils de simulation</p>
          <h1 className="mt-4 font-serif text-[38px] leading-tight text-white md:text-[52px]">Choisissez un simulateur</h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-7 text-white/60">
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
