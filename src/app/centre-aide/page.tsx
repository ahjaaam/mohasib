import type { Metadata } from "next";
import Link from "next/link";
import { Linkedin, Mail, MessageCircle } from "lucide-react";
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
    icon: Linkedin,
  },
  {
    title: "Email us",
    description: "Pour une question, un bug, une demande de démo ou un besoin d'accompagnement.",
    cta: "Envoyer un email",
    href: "mailto:a.ahjame@gmail.com",
    icon: Mail,
  },
  {
    title: "Live chat on WhatsApp",
    description: "Échangez rapidement avec l'équipe Mohasib pour une question, une démo ou un besoin d'aide.",
    cta: "Ouvrir WhatsApp",
    href: whatsappUrl(),
    icon: MessageCircle,
  },
];

export default function CentreAidePage() {
  return (
    <main className="public-site">
      <PublicNavbar />

      <section className="public-page-hero">
        <div className="mx-auto max-w-4xl text-center">
          <p className="public-eyebrow">Centre d&apos;aide</p>
          <h1 className="mx-auto mt-4 max-w-3xl text-[38px] font-bold leading-tight text-[#0D1526] md:text-[54px]">
            Comment pouvons-nous vous aider ?
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-7 text-[#6B7280]">
            Retrouvez les moyens simples pour contacter Mohasib AI, suivre les nouveautés ou demander de l&apos;aide.
          </p>
        </div>
      </section>

      <section className="px-6 py-16 md:px-10 md:py-20">
        <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-3">
          {cards.map(({ title, description, cta, href, icon: Icon }) => {
            const content = (
              <div className="public-surface public-interactive-surface h-full p-7">
                <div className="public-icon-tile h-12 w-12">
                  <Icon size={23} />
                </div>
                <h2 className="mt-6 text-[19px] font-bold text-[#0D1526]">{title}</h2>
                <p className="mt-3 text-[13.5px] leading-6 text-[#6B7280]">{description}</p>
                <div className="mt-6 inline-flex border border-[#DADAD5] bg-[#F5F4EF] px-4 py-2 text-[12px] font-bold text-[#C8924A]">
                  {cta}
                </div>
              </div>
            );

            const isExternal = href?.startsWith("http");

            return href ? (
              <Link
                key={title}
                href={href}
                className="block no-underline"
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
      </section>

      <PublicFooter />
    </main>
  );
}
