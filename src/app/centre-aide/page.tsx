import type { Metadata } from "next";
import Link from "next/link";
import { Linkedin, Mail, MessageCircle } from "lucide-react";
import PublicFooter from "@/components/PublicFooter";
import PublicNavbar from "@/components/PublicNavbar";

export const metadata: Metadata = {
  title: "Centre d'aide | Mohasib AI",
  description: "Contactez Mohasib AI par email, LinkedIn ou WhatsApp.",
};

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
    href: "https://wa.me/212777884056",
    icon: MessageCircle,
  },
];

export default function CentreAidePage() {
  return (
    <main className="min-h-screen bg-white">
      <PublicNavbar />

      <section className="border-b border-[rgba(13,21,38,0.08)] bg-[#FAFAF6] px-6 py-[64px]">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-[#C8924A]">Centre d&apos;aide</p>
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
              <div className="h-full rounded-2xl border border-black/[0.08] bg-white p-7 shadow-[0_12px_32px_rgba(13,21,38,0.05)] transition hover:border-[#C8924A] hover:shadow-[0_16px_42px_rgba(13,21,38,0.09)]">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#C8924A]/10 text-[#C8924A]">
                  <Icon size={23} />
                </div>
                <h2 className="mt-6 text-[19px] font-bold text-[#0D1526]">{title}</h2>
                <p className="mt-3 text-[13.5px] leading-6 text-[#6B7280]">{description}</p>
                <div className="mt-6 inline-flex rounded-full bg-[#F8F8F5] px-4 py-2 text-[12px] font-bold text-[#9A672E]">
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
