import type { Metadata } from "next";
import Link from "next/link";
import PublicFooter from "@/components/PublicFooter";
import PublicNavbar from "@/components/PublicNavbar";
import { SimulatorPage } from "@/components/ressources/SimulatorPage";
import { seoMetadata } from "@/lib/seo";

export const metadata: Metadata = seoMetadata({
  title: "Simulateur rentabilité gratuit — Marge, charges et résultat net",
  description: "Projetez votre rentabilité avec un simulateur simple : chiffre d’affaires, charges, salaires, marge et résultat net estimé.",
  path: "/ressources/outils/rentabilite",
});

export default function RentabiliteToolPage() {
  return (
    <main className="min-h-screen bg-[#FAFAF6]">
      <PublicNavbar />
      <section className="border-b border-[rgba(13,21,38,0.08)] bg-[#FAFAF6] px-6 py-[52px]">
        <div className="mx-auto max-w-4xl text-center">
          <Link href="/ressources/outils" className="text-[12px] font-semibold text-[#C8924A]">← Outils de simulation</Link>
          <h1 className="mt-5 font-serif text-[38px] leading-tight text-[#0D1526] md:text-[52px]">Simulateur Rentabilite</h1>
          <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-7 text-[#6B7280]">Projetez votre resultat net estime et votre marge avec vos charges et votre masse salariale.</p>
        </div>
      </section>
      <section className="px-6 py-10">
        <SimulatorPage kind="rentabilite" />
      </section>
      <PublicFooter />
    </main>
  );
}
