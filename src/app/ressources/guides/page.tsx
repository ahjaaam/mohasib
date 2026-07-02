import Link from "next/link";
import PublicFooter from "@/components/PublicFooter";
import PublicNavbar from "@/components/PublicNavbar";
import { getAllGuides } from "@/lib/guides";
import GuidesClient from "./GuidesClient";

export const revalidate = 60;

export default async function GuidesPage() {
  const guides = await getAllGuides();

  return (
    <main className="min-h-screen bg-[#FAFAF6]">
      <PublicNavbar />
      <section className="bg-[#0D1526] px-6 py-[60px]">
        <div className="mx-auto max-w-6xl">
          <Link href="/ressources" className="text-[12px] font-semibold text-[#C8924A]">← Ressources</Link>
          <p className="mt-6 text-[12px] font-bold uppercase tracking-[0.18em] text-[#C8924A]">Documents téléchargeables</p>
          <h1 className="mt-4 text-[38px] font-bold leading-tight text-white md:text-[52px]">Modèles, templates et documents gratuits</h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-7 text-white/60">
            Une bibliothèque de documents utiles pour gérer, créer et sécuriser votre activité au Maroc.
          </p>
        </div>
      </section>

      <GuidesClient guides={guides} />
      <PublicFooter />
    </main>
  );
}
