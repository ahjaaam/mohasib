import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";
import { notFound } from "next/navigation";
import { PortableText } from "@portabletext/react";
import PublicFooter from "@/components/PublicFooter";
import PublicNavbar from "@/components/PublicNavbar";
import DocumentLeadForm from "@/components/ressources/DocumentLeadForm";
import { getAllGuides, getGuideBySlug } from "@/lib/guides";

export const revalidate = 60;

function slugValue(slug: { current?: string } | string | undefined) {
  return typeof slug === "string" ? slug : slug?.current ?? null;
}

function isPortableText(value: unknown): value is unknown[] {
  return Array.isArray(value) && value.some((block) => typeof block === "object" && block !== null && "_type" in block);
}

export async function generateStaticParams() {
  const documents = await getAllGuides();
  return documents
    .map((document) => ({ slug: slugValue(document.slug) }))
    .filter((item): item is { slug: string } => Boolean(item.slug));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const document = await getGuideBySlug(slug);

  if (!document) {
    return {
      title: "Document introuvable | Mohasib AI",
    };
  }

  const title = `${document.title} gratuit | Mohasib AI`;
  const description = document.description || `Téléchargez gratuitement ${document.title}, un modèle utile pour les entrepreneurs et professionnels au Maroc.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
    },
    alternates: {
      canonical: `/ressources/documents/${encodeURIComponent(slugValue(document.slug) ?? slug)}`,
    },
  };
}

export default async function DocumentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const document = await getGuideBySlug(slug);
  if (!document) notFound();

  const currentSlug = slugValue(document.slug);

  return (
    <main className="min-h-screen bg-[#FAFAF6]">
      <PublicNavbar />

      <section className="border-b border-[rgba(13,21,38,0.08)] bg-[#FAFAF6] px-6 py-[56px]">
        <div className="mx-auto max-w-5xl">
          <Link href="/ressources/documents" className="text-[12px] font-semibold text-[#C8924A]">← Documents téléchargeables</Link>
          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px] lg:items-start">
            <div>
              <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-[#C8924A]">Modèle gratuit</p>
              <h1 className="mt-4 text-[38px] font-bold leading-tight text-[#0D1526] md:text-[52px]">{document.title}</h1>
              {isPortableText(document.descriptionRich) ? (
                <div className="mt-5 max-w-2xl space-y-4 text-[15px] leading-7 text-[#6B7280]">
                  <PortableText
                    value={document.descriptionRich as any}
                    components={{
                      block: {
                        normal: ({ children }) => <p>{children}</p>,
                        h2: ({ children }) => <h2 className="pt-3 text-[24px] font-bold leading-tight text-[#0D1526]">{children}</h2>,
                        h3: ({ children }) => <h3 className="pt-2 text-[19px] font-bold leading-tight text-[#0D1526]">{children}</h3>,
                        blockquote: ({ children }) => (
                          <blockquote className="border-l-4 border-[#C8924A] bg-white/70 py-2 pl-4 italic text-[#4B5563]">{children}</blockquote>
                        ),
                      },
                      list: {
                        bullet: ({ children }) => <ul className="ml-5 list-disc space-y-2">{children}</ul>,
                        number: ({ children }) => <ol className="ml-5 list-decimal space-y-2">{children}</ol>,
                      },
                      marks: {
                        link: ({ children, value }) => (
                          <a href={value?.href} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#C8924A] underline underline-offset-4">
                            {children}
                          </a>
                        ),
                        code: ({ children }) => <code className="rounded bg-white px-1.5 py-0.5 text-[13px] text-[#0D1526]">{children}</code>,
                        underline: ({ children }) => <span className="underline underline-offset-4">{children}</span>,
                      },
                    }}
                  />
                </div>
              ) : document.description ? (
                <p className="mt-5 max-w-2xl text-[15px] leading-7 text-[#6B7280]">{document.description}</p>
              ) : null}
              {isPortableText(document.descriptionRich) && document.description && (
                <p className="sr-only">{document.description}</p>
              )}
              <div className="mt-6 flex flex-wrap gap-2">
                {document.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-[#C8924A]/10 px-3 py-1.5 text-[11px] font-semibold text-[#C8924A]">{tag}</span>
                ))}
                {Boolean(document.pages) && (
                  <span className="rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-[#6B7280]">{document.pages} {typeof document.pages === "number" ? "pages" : ""}</span>
                )}
              </div>
            </div>

            <DocumentLeadForm
              resource={{
                id: document._id,
                title: document.title,
                slug: currentSlug,
                fileUrl: document.fileUrl,
              }}
            />
          </div>
        </div>
      </section>

      <section className="px-6 py-12">
        <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-3">
          {[
            ["Format pratique", "Un document prêt à adapter selon votre situation."],
            ["Pensé pour le Maroc", "Conçu pour les besoins fréquents des entrepreneurs, financiers et professionnels marocains."],
            ["Accès immédiat", "Recevez le lien après avoir saisi votre email."],
          ].map(([title, description]) => (
            <div key={title} className="rounded-2xl border border-[rgba(13,21,38,0.08)] bg-white p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#C8924A]/10 text-[#C8924A]">
                <FileText size={22} />
              </div>
              <h2 className="mt-5 text-[16px] font-bold text-[#0D1526]">{title}</h2>
              <p className="mt-2 text-[13px] leading-6 text-[#6B7280]">{description}</p>
            </div>
          ))}
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
