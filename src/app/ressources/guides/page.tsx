import Link from "next/link";
import PublicFooter from "@/components/PublicFooter";
import PublicNavbar from "@/components/PublicNavbar";
import { getAllGuides } from "@/lib/guides";
import GuidesClient from "./GuidesClient";

export const revalidate = 3600;

export default async function GuidesPage() {
  const guides = await getAllGuides();

  return (
    <main className="min-h-screen bg-[#FAFAF6]">
      <PublicNavbar />
      <section className="bg-[#0D1526] px-6 py-[60px]">
        <div className="mx-auto max-w-6xl">
          <Link href="/ressources" className="text-[12px] font-semibold text-[#C8924A]">← Ressources</Link>
          <p className="mt-6 text-[12px] font-bold uppercase tracking-[0.18em] text-[#C8924A]">Guides telechargeables</p>
          <h1 className="mt-4 font-serif text-[38px] leading-tight text-white md:text-[52px]">Ressources gratuites</h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-7 text-white/60">
            PDFs pratiques pour les entrepreneurs marocains. Telechargement immediat.
          </p>
        </div>
      </section>

      <GuidesClient guides={guides} />
      <PublicFooter />
    </main>
  );
}
