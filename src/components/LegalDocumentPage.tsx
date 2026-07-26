import Link from "next/link";
import type { ReactNode } from "react";
import PublicFooter from "@/components/PublicFooter";
import PublicNavbar from "@/components/PublicNavbar";

export type LegalSection = {
  id: string;
  title: string;
  content: ReactNode;
};

type LegalDocumentPageProps = {
  title: string;
  updatedAt: string;
  intro?: ReactNode;
  sections: LegalSection[];
  seeAlso: {
    label: string;
    href: string;
  };
};

export default function LegalDocumentPage({ title, updatedAt, intro, sections, seeAlso }: LegalDocumentPageProps) {
  return (
    <main className="public-site text-[#374151]">
      <PublicNavbar />
      <div className="mx-auto grid max-w-[1040px] gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[220px_minmax(0,720px)] lg:py-20">
        <aside className="lg:sticky lg:top-8 lg:self-start">
          <nav className="public-surface bg-[#F5F4EF] p-4">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[1.4px] text-[#6B7280]">Sommaire</p>
            <ol className="space-y-2">
              {sections.map((section, index) => (
                <li key={section.id}>
                  <a href={`#${section.id}`} className="block text-[12px] leading-5 text-[#374151] hover:text-[#7A6668]">
                    {index + 1}. {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </aside>

        <article className="max-w-[720px]">
          <header className="mb-10 border-b border-black/[0.08] pb-8">
            <h1 className="text-[clamp(30px,4vw,44px)] font-bold leading-tight text-[#0D1526]">{title}</h1>
            <p className="mt-3 text-[13px] font-medium text-[#6B7280]">Dernière mise à jour : {updatedAt}</p>
            {intro && <div className="mt-6 text-[15px] leading-[1.7] text-[#374151]">{intro}</div>}
          </header>

          <div className="space-y-10">
            {sections.map((section, index) => (
              <section key={section.id} id={section.id} className="scroll-mt-8">
                <h2 className="mb-4 text-[20px] font-bold leading-snug text-[#0D1526]">
                  {index + 1}. {section.title}
                </h2>
                <div className="legal-content text-[15px] leading-[1.7] text-[#374151]">
                  {section.content}
                </div>
              </section>
            ))}
          </div>

          <div className="public-surface mt-12 bg-[#F5F4EF] p-5 text-[14px]">
            Voir aussi :{" "}
            <Link href={seeAlso.href} className="font-semibold text-[#7A6668] hover:underline">
              {seeAlso.label}
            </Link>
          </div>
        </article>
      </div>

      <style>{`
        .legal-content p { margin: 0 0 14px; }
        .legal-content ul { margin: 0 0 14px 18px; padding: 0; }
        .legal-content li { margin: 0 0 8px; }
        .legal-content strong { color: #0D1526; font-weight: 700; }
      `}</style>
      <PublicFooter />
    </main>
  );
}
