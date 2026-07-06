import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import PublicFooter from "@/components/PublicFooter";
import PublicNavbar from "@/components/PublicNavbar";
import { appUrl } from "@/lib/public-urls";

type ProductPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  audience: string;
  ctaHref: string;
  ctaLabel: string;
  modules: Array<{
    title: string;
    description: string;
    features: string[];
  }>;
};

export default function ProductPage({ eyebrow, title, description, audience, ctaHref, ctaLabel, modules }: ProductPageProps) {
  const resolvedCtaHref = ctaHref.startsWith("/inscription") ? appUrl(ctaHref) : ctaHref;

  return (
    <main className="min-h-screen bg-[#FAFAF6]">
      <PublicNavbar />

      <section className="border-b border-[rgba(13,21,38,0.08)] bg-[#FAFAF6] px-6 py-[68px]">
        <div className="mx-auto max-w-5xl text-center">
          <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-[#C8924A]">{eyebrow}</p>
          <h1 className="mx-auto mt-4 max-w-4xl text-[38px] font-bold leading-tight text-[#0D1526] md:text-[56px]">{title}</h1>
          <p className="mx-auto mt-5 max-w-3xl text-[15px] leading-7 text-[#6B7280]">{description}</p>
          <p className="mx-auto mt-4 inline-flex rounded-full bg-white px-4 py-2 text-[12px] font-bold text-[#9A672E] shadow-sm">{audience}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href={resolvedCtaHref} className="inline-flex items-center gap-2 rounded-lg bg-[#C8924A] px-5 py-3 text-[13px] font-bold text-white transition hover:bg-[#B7833F]">
              {ctaLabel} <ArrowRight size={15} />
            </Link>
            <Link href="/tarifs" className="inline-flex items-center gap-2 rounded-lg border border-[#C8924A] bg-white px-5 py-3 text-[13px] font-bold text-[#C8924A] transition hover:bg-[#FFF7ED]">
              Voir les tarifs
            </Link>
          </div>
        </div>
      </section>

      <section className="px-6 py-14">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-5 md:grid-cols-2">
            {modules.map((module) => (
              <article key={module.title} className="rounded-2xl border border-[rgba(13,21,38,0.08)] bg-white p-6 shadow-[0_12px_32px_rgba(13,21,38,0.05)]">
                <h2 className="text-[19px] font-bold text-[#0D1526]">{module.title}</h2>
                <p className="mt-3 text-[13.5px] leading-6 text-[#6B7280]">{module.description}</p>
                <div className="mt-5 space-y-2">
                  {module.features.map((feature) => (
                    <div key={feature} className="flex gap-2 text-[12.5px] leading-5 text-[#374151]">
                      <CheckCircle2 className="mt-0.5 flex-shrink-0 text-[#C8924A]" size={15} />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 pb-16">
        <div className="mx-auto max-w-5xl rounded-3xl bg-[#0D1526] p-8 text-center text-white md:p-10">
          <h2 className="text-[28px] font-bold leading-tight">Essayez Mohasib gratuitement</h2>
          <p className="mx-auto mt-3 max-w-2xl text-[14px] leading-7 text-white/65">
            Créez un compte, testez les modules clés et voyez si l&apos;outil correspond à votre organisation.
          </p>
          <Link href={appUrl("/inscription")} className="mt-6 inline-flex rounded-lg bg-[#C8924A] px-5 py-3 text-[13px] font-bold text-white transition hover:bg-[#B7833F]">
            Créer un compte gratuitement
          </Link>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
