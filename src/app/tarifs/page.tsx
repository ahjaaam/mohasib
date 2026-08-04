import Link from "next/link";
import { ArrowRight } from "lucide-react";
import PublicFooter from "@/components/PublicFooter";
import PublicNavbar from "@/components/PublicNavbar";
import PricingCalculator from "./PricingCalculator";
import { invoicingUrl } from "@/lib/public-urls";

export default function TarifsPage() {
  return (
    <main className="public-site bg-white">
      <PublicNavbar />

      <section className="relative overflow-hidden bg-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            backgroundImage:
              "linear-gradient(rgba(13,21,38,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(13,21,38,0.035) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
            maskImage: "linear-gradient(to bottom, black, transparent 78%)",
          }}
        />

        <div className="relative mx-auto max-w-[1120px] px-5 pb-14 pt-16 text-center sm:px-10 sm:pb-20 sm:pt-24 lg:pt-28">
          <p className="public-eyebrow">Une tarification simple · Maroc</p>
          <h1 className="mx-auto mt-5 max-w-[900px] text-[42px] font-extrabold leading-[0.98] tracking-[-0.045em] text-[#0D1526] sm:text-[58px] lg:text-[72px]">
            Un prix qui suit le rythme de votre activité.
          </h1>
          <p className="mx-auto mt-6 max-w-[650px] text-[14px] leading-6 text-[#666B75] sm:text-[16px] sm:leading-7">
            Commencez simplement, puis adaptez votre formule au volume de documents, de dossiers,
            d&apos;utilisateurs ou d&apos;employés dont vous avez réellement besoin.
          </p>
        </div>
      </section>

      <section className="bg-white px-5 py-16 sm:px-10 sm:py-24">
        <div className="mx-auto max-w-[1180px]">
          <div className="mb-12 grid gap-6 border border-[#D8C19D] bg-[#FAFAF6] p-6 sm:grid-cols-[1fr_auto] sm:items-center sm:p-8">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#A28358]">Mohasib Gratuit · 0 MAD</p>
              <h2 className="mt-2 text-[26px] font-bold tracking-[-0.025em] text-[#0D1526]">Facturez gratuitement, sans limite de durée.</h2>
              <p className="mt-3 max-w-[720px] text-[13px] leading-6 text-[#666B75]">
                Factures, devis, avoirs, PDF, envoi par e-mail et gestion des clients — sans carte bancaire.
              </p>
            </div>
            <Link href={invoicingUrl("/inscription")} className="inline-flex min-h-12 items-center justify-center gap-4 bg-[#C8924A] px-5 text-[12.5px] font-bold text-white transition-colors hover:bg-[#B6823F]">
              Créer mon compte gratuit
              <ArrowRight size={15} />
            </Link>
          </div>
          <PricingCalculator />
        </div>
      </section>

      <section className="bg-white px-5 py-12 sm:px-10">
        <div className="mx-auto grid max-w-[1120px] gap-7 sm:grid-cols-3">
          {[
            ["01", "Pensé pour le Maroc", "TVA, CGNC, paie et obligations locales intégrées."],
            ["02", "Votre usage, votre prix", "Vous payez selon la taille réelle de votre activité."],
            ["03", "Une équipe disponible", "Accompagnement humain et support 7 jours sur 7."],
          ].map(([number, title, description]) => (
            <div key={number} className="border-l border-[#D1D5DB] pl-5">
              <p className="text-[10px] font-bold tracking-[0.15em] text-[#A28358]">{number}</p>
              <h3 className="mt-2 text-[15px] font-bold text-[#0D1526]">{title}</h3>
              <p className="mt-1.5 text-[12px] leading-5 text-[#737883]">{description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white px-5 py-16 text-[#0D1526] sm:px-10 sm:py-24">
        <div className="mx-auto flex max-w-[1120px] flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8B765A]">Besoin d&apos;une formule sur mesure ?</p>
            <h2 className="mt-4 max-w-[690px] text-[34px] font-bold leading-[1.05] tracking-[-0.035em] sm:text-[50px]">
              Parlons de votre activité, pas seulement d&apos;un abonnement.
            </h2>
            <p className="mt-5 max-w-[590px] text-[13px] leading-6 text-[#737883]">
              Chaque entreprise et chaque cabinet fonctionne différemment. Nous vous aiderons à trouver la configuration juste.
            </p>
          </div>
          <a
            href="mailto:contact@mohasibai.com"
            className="inline-flex min-h-12 shrink-0 items-center justify-between gap-8 bg-[#0D1526] px-5 text-[12.5px] font-bold text-white transition-colors hover:bg-[#253047]"
          >
            Demander un devis
            <ArrowRight size={15} />
          </a>
        </div>
        <div className="mx-auto mt-12 max-w-[1120px] pt-5 text-[10.5px] text-[#92969E]">
          En souscrivant à Mohasib AI, vous acceptez nos{" "}
          <Link href="/cgu" className="font-semibold text-[#0D1526] hover:underline">CGU</Link>
          {" "}et notre{" "}
          <Link href="/confidentialite" className="font-semibold text-[#0D1526] hover:underline">Politique de Confidentialité</Link>.
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
