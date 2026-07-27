import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import PublicFooter from "@/components/PublicFooter";
import PublicNavbar from "@/components/PublicNavbar";
import { seoMetadata } from "@/lib/seo";
import { whatsappUrl } from "@/lib/public-urls";

export const metadata: Metadata = seoMetadata({
  title: "Centre d'aide | Mohasib AI",
  description: "Contactez Mohasib AI par email, LinkedIn ou WhatsApp pour une question, une démo ou un besoin d’accompagnement.",
  path: "/centre-aide",
});

const cards = [
  {
    title: "Follow us on LinkedIn",
    description: "Suivez les nouveautés, annonces produit et conseils pratiques autour de Mohasib AI.",
    cta: "Suivre Mohasib AI",
    href: "https://www.linkedin.com/company/mohasibai/",
  },
  {
    title: "Email us",
    description: "Pour une question, un bug, une demande de démo ou un besoin d'accompagnement.",
    cta: "Envoyer un email",
    href: "mailto:a.ahjame@gmail.com",
  },
  {
    title: "Live chat on WhatsApp",
    description: "Échangez rapidement avec l'équipe Mohasib pour une question, une démo ou un besoin d'aide.",
    cta: "Ouvrir WhatsApp",
    href: whatsappUrl(),
  },
];

export default function CentreAidePage() {
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
          <p className="public-eyebrow">Centre d&apos;aide · Mohasib AI</p>
          <h1 className="mx-auto mt-5 max-w-[900px] text-[42px] font-extrabold leading-[0.98] tracking-[-0.045em] text-[#0D1526] sm:text-[58px] lg:text-[72px]">
            Comment pouvons-nous vous aider ?
          </h1>
          <p className="mx-auto mt-6 max-w-[650px] text-[14px] leading-6 text-[#666B75] sm:text-[16px] sm:leading-7">
            Retrouvez les moyens simples pour contacter Mohasib AI, suivre les nouveautés ou demander de l&apos;aide.
          </p>
        </div>
      </section>

      <section className="bg-white px-5 py-16 sm:px-10 sm:py-24">
        <div className="mx-auto max-w-[1120px]">
          <div className="mb-9 border-b border-[#D1D5DB] pb-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8B765A]">Nous contacter</p>
            <h2 className="mt-2 text-[28px] font-bold tracking-[-0.025em] text-[#0D1526] sm:text-[36px]">
              Choisissez le canal qui vous convient.
            </h2>
          </div>

          <div className="grid items-stretch gap-5 md:grid-cols-3">
            {cards.map(({ title, description, cta, href }) => {
              const content = (
                <article className="flex h-full flex-col border border-[#9CA3AF] bg-white p-6 text-[#0D1526] sm:p-8">
                  <h3 className="text-[26px] font-bold leading-[1.15] sm:text-[30px]">{title}</h3>
                  <p className="mt-6 flex-1 text-[13.5px] leading-6 text-[#666B75]">{description}</p>
                  <div className="mt-8 inline-flex min-h-12 w-fit items-center gap-8 bg-[#0D1526] px-5 text-[12.5px] font-bold text-white transition-colors group-hover:bg-[#253047]">
                    {cta}
                    <ArrowRight size={15} />
                  </div>
                </article>
              );

              const isExternal = href?.startsWith("http");

              return href ? (
                <Link
                  key={title}
                  href={href}
                  className="group block h-full no-underline"
                  target={isExternal ? "_blank" : undefined}
                  rel={isExternal ? "noopener noreferrer" : undefined}
                >
                  {content}
                </Link>
              ) : (
                <div key={title}>{content}</div>
              );
            })}
          </div>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
