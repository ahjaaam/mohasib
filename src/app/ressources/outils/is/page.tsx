import Link from "next/link";
import PublicFooter from "@/components/PublicFooter";
import PublicNavbar from "@/components/PublicNavbar";
import { SimulatorPage } from "@/components/ressources/SimulatorPage";

export default function IsToolPage() {
  return (
    <main className="min-h-screen bg-[#FAFAF6]">
      <PublicNavbar />
      <section className="border-b border-[rgba(13,21,38,0.08)] bg-[#FAFAF6] px-6 py-[52px]">
        <div className="mx-auto max-w-4xl text-center">
          <Link href="/ressources/outils" className="text-[12px] font-semibold text-[#C8924A]">← Outils de simulation</Link>
          <h1 className="mt-5 font-serif text-[38px] leading-tight text-[#0D1526] md:text-[52px]">Simulateur IS</h1>
          <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-7 text-[#6B7280]">Estimez l'impot sur les societes et les acomptes a partir de votre chiffre d'affaires et de vos charges.</p>
        </div>
      </section>
      <section className="px-6 py-10">
        <SimulatorPage kind="is" />
      </section>
      <PublicFooter />
    </main>
  );
}
