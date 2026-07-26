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
    label: string;
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
    <main className="public-site">
      <PublicNavbar />

      <section className="public-page-hero">
        <div className="mx-auto max-w-5xl text-center">
          <p className="public-eyebrow">{eyebrow}</p>
          <h1 className="mx-auto mt-4 max-w-4xl text-[38px] font-bold leading-tight text-[#0D1526] md:text-[56px]">{title}</h1>
          <p className="mx-auto mt-5 max-w-3xl text-[15px] leading-7 text-[#6B7280]">{description}</p>
          <p className="mx-auto mt-4 inline-flex border border-[#DADAD5] bg-white px-4 py-2 text-[12px] font-bold text-[#7A6668]">{audience}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href={resolvedCtaHref} className="public-primary-action">
              {ctaLabel} <ArrowRight size={15} />
            </Link>
            <Link href="/tarifs" className="public-secondary-action">
              Voir les tarifs
            </Link>
          </div>
          {heroImage && (
            <div className="mx-auto mt-12 max-w-6xl">
              <div className="public-surface p-2">
                <Image
                  src={heroImage.src}
                  alt={heroImage.alt}
                  width={2048}
                  height={1051}
                  priority
                  className="h-auto w-full border border-black/[0.06]"
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
            <div className="public-surface p-7 md:p-8">
              <p className="public-eyebrow">Pourquoi ça compte</p>
              <h2 className="mt-3 text-[28px] font-bold leading-tight text-[#0D1526] md:text-[34px]">{painTitle}</h2>
              <p className="mt-4 text-[14px] leading-7 text-[#6B7280]">{painDescription}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {highlights.map((highlight) => (
                <div key={highlight.label} className="public-surface p-5">
                  <div className="text-[26px] font-extrabold leading-none text-[#7A6668]">{highlight.value}</div>
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
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#C0AEAF] text-[12px] font-extrabold text-[#0D1526]">{index + 1}</div>
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
                <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#7A6668]">Dans le produit</p>
                <h2 className="mt-2 text-[28px] font-bold leading-tight text-[#0D1526] md:text-[34px]">Des écrans pensés pour le travail réel</h2>
                <p className="mx-auto mt-3 max-w-2xl text-[14px] leading-7 text-[#6B7280]">
                  Chaque module doit réduire une friction concrète : retrouver une facture, vérifier une TVA, suivre un paiement ou préparer une déclaration.
                </p>
              </div>
              <div className="grid gap-5">
                {screenshots.map((screenshot) => (
                  <article key={screenshot.src} className="public-surface grid overflow-hidden md:grid-cols-[1.35fr_0.65fr]">
                    <div className="border-b border-black/[0.06] bg-[#F7F4EE] p-2 md:border-b-0 md:border-r">
                      <Image
                        src={screenshot.src}
                        alt={screenshot.alt}
                        width={2048}
                        height={1051}
                        className="h-auto w-full border border-black/[0.06]"
                      />
                    </div>
                    <div className="flex flex-col justify-center p-6 md:p-8 lg:p-10">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#7A6668]">{screenshot.label}</p>
                      <h3 className="mt-3 text-[22px] font-bold leading-tight text-[#0D1526] lg:text-[26px]">{screenshot.title}</h3>
                      <p className="mt-4 text-[13.5px] leading-7 text-[#6B7280]">{screenshot.description}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-5 md:grid-cols-2">
            {modules.map((module) => (
              <article key={module.title} className="public-surface p-6">
                <h2 className="text-[19px] font-bold text-[#0D1526]">{module.title}</h2>
                <p className="mt-3 text-[13.5px] leading-6 text-[#6B7280]">{module.description}</p>
                <p className="mt-4 border border-[rgba(192,174,175,0.24)] bg-[rgba(192,174,175,0.08)] px-4 py-3 text-[12.5px] font-semibold leading-5 text-[#7A6668]">{module.impact}</p>
                <div className="mt-5 space-y-2">
                  {module.features.map((feature) => (
                    <div key={feature} className="flex gap-2 text-[12.5px] leading-5 text-[#374151]">
                      <CheckCircle2 className="mt-0.5 flex-shrink-0 text-[#7A6668]" size={15} />
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
          <Link href={appUrl("/inscription")} className="public-primary-action mt-6">
            Créer un compte gratuitement
          </Link>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
