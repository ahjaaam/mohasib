import Link from "next/link";
import PublicFooter from "@/components/PublicFooter";
import PublicNavbar from "@/components/PublicNavbar";
import { SimulatorPage } from "@/components/ressources/SimulatorPage";

export default function PaieToolPage() {
  return (
    <main className="min-h-screen bg-[#FAFAF6]">
      <PublicNavbar />
      <section className="bg-[#0D1526] px-6 py-[52px]">
        <div className="mx-auto max-w-6xl">
          <Link href="/ressources/outils" className="text-[12px] font-semibold text-[#C8924A]">← Outils de simulation</Link>
          <h1 className="mt-5 font-serif text-[38px] leading-tight text-white md:text-[52px]">Simulateur Bulletin de Paie</h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-7 text-white/60">Simulez le net a payer, les retenues salariales et le cout total employeur.</p>
        </div>
      </section>
      <section className="px-6 py-10">
        <SimulatorPage kind="paie" />
      </section>
      <PublicFooter />
    </main>
  );
}
