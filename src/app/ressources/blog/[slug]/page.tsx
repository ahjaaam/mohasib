import Link from "next/link";
import { notFound } from "next/navigation";
import { PortableText, type PortableTextComponents } from "@portabletext/react";
import PublicNavbar from "@/components/PublicNavbar";
import PublicFooter from "@/components/PublicFooter";
import { getAllPosts, getPostBySlug, getSlugValue } from "@/lib/blog";
import { urlFor } from "@/lib/sanity";

export const revalidate = 3600;

const categoryLabels: Record<string, string> = {
  tva: "TVA",
  is: "IS",
  paie: "Paie",
  tresorerie: "Tresorerie",
  creation: "Creation",
  comptabilite: "Comptabilite",
};

const portableTextComponents: PortableTextComponents = {
  block: {
    h2: ({ children }) => <h2 className="mt-10 text-[26px] font-bold leading-tight text-[#0D1526]">{children}</h2>,
    h3: ({ children }) => <h3 className="mt-8 text-[20px] font-bold leading-tight text-[#0D1526]">{children}</h3>,
    normal: ({ children }) => <p className="text-[16px] leading-8 text-[#374151]">{children}</p>,
    blockquote: ({ children }) => <blockquote className="border-l-4 border-[#C8924A] pl-5 text-[16px] italic leading-8 text-[#374151]">{children}</blockquote>,
  },
  list: {
    bullet: ({ children }) => <ul className="ml-5 list-disc space-y-2 text-[16px] leading-8 text-[#374151]">{children}</ul>,
    number: ({ children }) => <ol className="ml-5 list-decimal space-y-2 text-[16px] leading-8 text-[#374151]">{children}</ol>,
  },
  types: {
    image: ({ value }) => {
      if (!value?.asset) return null;
      return (
        <figure className="my-8">
          <img src={urlFor(value).width(1100).fit("max").url()} alt="" className="w-full rounded-2xl" />
        </figure>
      );
    },
    callout: ({ value }) => (
      <div className={`my-6 rounded-2xl border p-5 text-[14px] leading-7 ${
        value?.type === "warning"
          ? "border-[#F59E0B]/25 bg-[#FFFBEB] text-[#92400E]"
          : value?.type === "tip"
            ? "border-[#10B981]/25 bg-[#ECFDF5] text-[#065F46]"
            : "border-[#3B82F6]/25 bg-[#EFF6FF] text-[#1E40AF]"
      }`}>
        {value?.text}
      </div>
    ),
  },
  marks: {
    link: ({ children, value }) => {
      const href = value?.href || "#";
      return <a href={href} className="font-semibold text-[#C8924A] underline">{children}</a>;
    },
  },
};

export async function generateStaticParams() {
  const posts = await getAllPosts();
  return posts.map((post) => ({ slug: getSlugValue(post.slug) })).filter((item) => item.slug);
}

function formatReadTime(readTime?: number | string) {
  if (!readTime) return "5 min de lecture";
  if (typeof readTime === "number") return `${readTime} min de lecture`;
  return readTime.includes("lecture") ? readTime : `${readTime} min de lecture`;
}

function formatDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export default async function ArticlePage({ params }: { params: { slug: string } }) {
  const post = await getPostBySlug(params.slug);
  if (!post) notFound();

  const category = post.category || "comptabilite";
  const coverImageUrl = post.coverImage ? urlFor(post.coverImage).width(1200).height(560).fit("crop").url() : null;

  return (
    <main className="min-h-screen bg-[#FAFAF6]">
      <PublicNavbar />
      <article className="mx-auto max-w-3xl px-6 py-10">
        <Link href="/ressources/blog" className="text-[13px] font-semibold text-[#C8924A]">← Retour au blog</Link>
        <div className="mt-8">
          <span className="inline-flex rounded-full bg-[#C8924A]/10 px-3 py-1 text-[12px] font-semibold text-[#C8924A]">
            {categoryLabels[category] || category}
          </span>
          <h1 className="mt-5 font-serif text-[38px] leading-tight text-[#0D1526] md:text-[52px]">{post.title}</h1>
          <p className="mt-4 text-[13px] text-[#6B7280]">
            {formatDate(post.publishedAt)} · {formatReadTime(post.readTime)} · Equipe Mohasib
          </p>
        </div>

        {coverImageUrl && <img src={coverImageUrl} alt="" className="mt-8 w-full rounded-2xl object-cover" />}

        <div className="my-8 h-px bg-[rgba(13,21,38,0.12)]" />

        <div className="space-y-6">
          {post.body?.length ? <PortableText value={post.body} components={portableTextComponents} /> : (
            <p className="text-[16px] leading-8 text-[#374151]">{post.excerpt}</p>
          )}
        </div>

        <div className="mt-12 rounded-2xl bg-[#0D1526] p-7 text-white">
          <h2 className="text-[22px] font-bold">Mohasib calcule votre TVA automatiquement</h2>
          <p className="mt-3 max-w-2xl text-[14px] leading-7 text-white/65">
            Plus besoin de tout faire manuellement. Centralisez vos factures, calculez vos declarations et gardez une vision claire de vos obligations.
          </p>
          <Link
            href="/inscription"
            className="mt-6 inline-flex rounded-lg bg-[#C8924A] px-5 py-3 text-[13px] font-bold text-white transition hover:bg-[#B7833F]"
          >
            Créer un compte -&gt;
          </Link>
        </div>
      </article>
      <PublicFooter />
    </main>
  );
}
