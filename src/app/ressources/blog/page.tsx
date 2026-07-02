import Link from "next/link";
import PublicNavbar from "@/components/PublicNavbar";
import PublicFooter from "@/components/PublicFooter";
import { getAllPosts, getSlugValue, type BlogPostListItem } from "@/lib/blog";
import { urlFor } from "@/lib/sanity";

export const revalidate = 60;

const filters = ["Tous", "TVA", "IS", "Paie", "Tresorerie", "Creation d'entreprise"];

const categoryLabels: Record<string, string> = {
  tva: "TVA",
  is: "IS",
  paie: "Paie",
  tresorerie: "Tresorerie",
  creation: "Creation",
  comptabilite: "Comptabilite",
};

const categoryStyles: Record<string, string> = {
  tva: "bg-[#EFF6FF] text-[#1D4ED8]",
  is: "bg-[#F0FDF4] text-[#15803D]",
  paie: "bg-[#FFF7ED] text-[#C8924A]",
  tresorerie: "bg-[#FDF2F8] text-[#BE185D]",
  creation: "bg-[#F5F3FF] text-[#6D28D9]",
  comptabilite: "bg-[#EEF2FF] text-[#4338CA]",
};

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

function coverUrl(post: BlogPostListItem) {
  try {
    return post.coverImage ? urlFor(post.coverImage).width(720).height(380).fit("crop").url() : null;
  } catch {
    return null;
  }
}

export default async function BlogPage() {
  const posts = await getAllPosts();

  return (
    <main className="min-h-screen bg-[#FAFAF6]">
      <PublicNavbar />
      <section className="bg-[#0D1526] px-6 py-[60px]">
        <div className="mx-auto max-w-6xl">
          <Link href="/ressources" className="text-[12px] font-semibold text-[#C8924A]">← Ressources</Link>
          <p className="mt-6 text-[12px] font-bold uppercase tracking-[0.18em] text-[#C8924A]">Blog Mohasib</p>
          <h1 className="mt-4 text-[38px] font-bold leading-tight text-white md:text-[52px]">
            Comptabilite & Entrepreneuriat
          </h1>
          <p className="mt-4 text-[15px] leading-7 text-white/60">
            Conseils pratiques pour gerer votre activite au Maroc
          </p>
        </div>
      </section>

      <section className="px-6 py-10">
        <div className="mx-auto max-w-6xl">
          <div className="flex gap-2 overflow-x-auto border-b border-[rgba(13,21,38,0.10)]">
            {filters.map((filter, index) => (
              <button
                key={filter}
                className={`whitespace-nowrap px-3 pb-3 text-[13px] font-semibold ${
                  index === 0 ? "border-b-2 border-[#C8924A] text-[#C8924A]" : "text-[#6B7280]"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {posts.map((post) => {
              const slug = getSlugValue(post.slug);
              const category = post.category || "comptabilite";
              const imageUrl = coverUrl(post);

              return (
                <Link
                  key={post._id}
                  href={`/ressources/blog/${slug}`}
                  className="overflow-hidden rounded-2xl border border-[rgba(0,0,0,0.08)] bg-white transition hover:border-[#C8924A] hover:shadow-[0_14px_35px_rgba(13,21,38,0.08)]"
                >
                  {imageUrl && <img src={imageUrl} alt="" className="h-40 w-full object-cover" />}
                  <div className="p-5">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${categoryStyles[category] || categoryStyles.comptabilite}`}>
                      {categoryLabels[category] || category}
                    </span>
                    <h2 className="mt-4 text-[16px] font-bold leading-6 text-[#0D1526]">{post.title}</h2>
                    <p className="mt-3 line-clamp-2 text-[13px] leading-6 text-[#6B7280]">{post.excerpt}</p>
                    <div className="mt-5 flex items-center justify-between text-[12px] text-[#9CA3AF]">
                      <span>{formatReadTime(post.readTime)}</span>
                      <span>{formatDate(post.publishedAt)}</span>
                    </div>
                    <span className="mt-5 inline-flex text-[13px] font-semibold text-[#C8924A]">Lire l'article -&gt;</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
      <PublicFooter />
    </main>
  );
}
