import type { MetadataRoute } from "next";
import { getAllPosts, getSlugValue } from "@/lib/blog";
import { getAllGuides } from "@/lib/guides";
import { MARKETING_URL } from "@/lib/public-urls";

type StaticRoute = {
  path: string;
  priority: number;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
};

const staticRoutes: StaticRoute[] = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/tarifs", priority: 0.9, changeFrequency: "weekly" },
  { path: "/logiciels/business", priority: 0.9, changeFrequency: "monthly" },
  { path: "/logiciels/comptable-pro", priority: 0.9, changeFrequency: "monthly" },
  { path: "/ressources", priority: 0.8, changeFrequency: "weekly" },
  { path: "/ressources/blog", priority: 0.8, changeFrequency: "weekly" },
  { path: "/ressources/documents", priority: 0.85, changeFrequency: "weekly" },
  { path: "/ressources/outils", priority: 0.75, changeFrequency: "monthly" },
  { path: "/ressources/outils/tva", priority: 0.75, changeFrequency: "monthly" },
  { path: "/ressources/outils/is", priority: 0.7, changeFrequency: "monthly" },
  { path: "/ressources/outils/paie", priority: 0.7, changeFrequency: "monthly" },
  { path: "/ressources/outils/rentabilite", priority: 0.65, changeFrequency: "monthly" },
  { path: "/centre-aide", priority: 0.5, changeFrequency: "monthly" },
  { path: "/cgu", priority: 0.3, changeFrequency: "yearly" },
  { path: "/confidentialite", priority: 0.3, changeFrequency: "yearly" },
];

function url(path: string) {
  return `${MARKETING_URL}${path}`;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const [posts, documents] = await Promise.all([getAllPosts(), getAllGuides()]);

  const staticEntries = staticRoutes.map((route) => ({
    url: url(route.path),
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  const blogEntries = posts
    .map((post) => {
      const slug = getSlugValue(post.slug);
      if (!slug) return null;
      return {
        url: url(`/ressources/blog/${encodeURIComponent(slug)}`),
        lastModified: post.publishedAt ? new Date(post.publishedAt) : now,
        changeFrequency: "monthly" as const,
        priority: 0.75,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  const documentEntries = documents
    .map((document) => {
      const slug = typeof document.slug === "string" ? document.slug : document.slug?.current;
      if (!slug) return null;
      return {
        url: url(`/ressources/documents/${encodeURIComponent(slug)}`),
        lastModified: document.publishedAt ? new Date(document.publishedAt) : now,
        changeFrequency: "monthly" as const,
        priority: 0.8,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  return [...staticEntries, ...blogEntries, ...documentEntries];
}
