import Link from "next/link";
import Image from "next/image";
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
  heroImage?: {
    src: string;
    alt: string;
    caption?: string;
  };
  painTitle: string;
  painDescription: string;
  highlights: Array<{
    value: string;
    label: string;
  }>;
  workflowTitle: string;
  workflowDescription: string;
  workflow: Array<{
    title: string;
    description: string;
  }>;
  screenshots?: Array<{
    src: string;
    alt: string;
    title: string;
    description: string;
  }>;
  modules: Array<{
    title: string;
    description: string;
    impact: string;
    features: string[];
  }>;
};

export default function ProductPage({
  eyebrow,
  title,
  description,
  audience,
  ctaHref,
  ctaLabel,
  heroImage,
  painTitle,
  painDescription,
  highlights,
  workflowTitle,
  workflowDescription,
  workflow,
  screenshots,
  modules,
}: ProductPageProps) {
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
          {heroImage && (
            <div className="mx-auto mt-12 max-w-6xl">
              <div className="rounded-[28px] border border-[rgba(13,21,38,0.10)] bg-white p-2 shadow-[0_24px_80px_rgba(13,21,38,0.14)]">
                <Image
                  src={heroImage.src}
                  alt={heroImage.alt}
                  width={2048}
                  height={1051}
                  priority
                  className="h-auto w-full rounded-[20px] border border-black/[0.04]"
                />
              </div>
              {heroImage.caption && (
                <p className="mx-auto mt-4 max-w-2xl text-[12.5px] leading-6 text-[#6B7280]">{heroImage.caption}</p>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="px-6 py-14">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-3xl border border-[rgba(13,21,38,0.08)] bg-white p-7 shadow-[0_12px_32px_rgba(13,21,38,0.05)] md:p-8">
              <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#C8924A]">Pourquoi ça compte</p>
              <h2 className="mt-3 text-[28px] font-bold leading-tight text-[#0D1526] md:text-[34px]">{painTitle}</h2>
              <p className="mt-4 text-[14px] leading-7 text-[#6B7280]">{painDescription}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {highlights.map((highlight) => (
                <div key={highlight.label} className="rounded-2xl border border-[rgba(13,21,38,0.08)] bg-white p-5 shadow-[0_10px_24px_rgba(13,21,38,0.04)]">
                  <div className="text-[26px] font-extrabold leading-none text-[#C8924A]">{highlight.value}</div>
                  <div className="mt-2 text-[12.5px] font-semibold leading-5 text-[#374151]">{highlight.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-8 rounded-3xl bg-[#0D1526] p-7 text-white md:p-8">
            <div className="grid gap-7 lg:grid-cols-[0.85fr_1.15fr]">
              <div>
                <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#D9AE73]">La journée avec Mohasib</p>
                <h2 className="mt-3 text-[28px] font-bold leading-tight md:text-[34px]">{workflowTitle}</h2>
                <p className="mt-4 text-[14px] leading-7 text-white/65">{workflowDescription}</p>
              </div>
              <div className="grid gap-3">
                {workflow.map((step, index) => (
                  <div key={step.title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                    <div className="flex gap-4">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#C8924A] text-[12px] font-extrabold text-white">{index + 1}</div>
                      <div>
                        <h3 className="text-[15px] font-bold">{step.title}</h3>
                        <p className="mt-1.5 text-[13px] leading-6 text-white/65">{step.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {screenshots && screenshots.length > 0 && (
            <div className="mb-8">
              <div className="mb-5 text-center">
                <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#C8924A]">Dans le produit</p>
                <h2 className="mt-2 text-[28px] font-bold leading-tight text-[#0D1526] md:text-[34px]">Des écrans pensés pour le travail réel</h2>
                <p className="mx-auto mt-3 max-w-2xl text-[14px] leading-7 text-[#6B7280]">
                  Chaque module doit réduire une friction concrète : retrouver une facture, vérifier une TVA, suivre un paiement ou préparer une déclaration.
                </p>
              </div>
              <div className="grid gap-5">
                {screenshots.map((screenshot) => (
                  <article key={screenshot.src} className="overflow-hidden rounded-3xl border border-[rgba(13,21,38,0.08)] bg-white shadow-[0_14px_40px_rgba(13,21,38,0.07)]">
                    <div className="p-6 md:p-7">
                      <h3 className="text-[20px] font-bold text-[#0D1526]">{screenshot.title}</h3>
                      <p className="mt-2 max-w-3xl text-[13.5px] leading-6 text-[#6B7280]">{screenshot.description}</p>
                    </div>
                    <div className="border-t border-black/[0.06] bg-[#F7F4EE] p-2">
                      <Image
                        src={screenshot.src}
                        alt={screenshot.alt}
                        width={2048}
                        height={1051}
                        className="h-auto w-full rounded-2xl border border-black/[0.04]"
                      />
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-5 md:grid-cols-2">
            {modules.map((module) => (
              <article key={module.title} className="rounded-2xl border border-[rgba(13,21,38,0.08)] bg-white p-6 shadow-[0_12px_32px_rgba(13,21,38,0.05)]">
                <h2 className="text-[19px] font-bold text-[#0D1526]">{module.title}</h2>
                <p className="mt-3 text-[13.5px] leading-6 text-[#6B7280]">{module.description}</p>
                <p className="mt-4 rounded-xl bg-[#FFF7ED] px-4 py-3 text-[12.5px] font-semibold leading-5 text-[#9A672E]">{module.impact}</p>
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
