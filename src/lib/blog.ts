import { client, hasSanityConfig } from "./sanity";
import { articles as fallbackArticles } from "@/app/ressources/blog/articles";

export type BlogPostListItem = {
  _id: string;
  title: string;
  slug: { current: string } | string;
  category?: string;
  excerpt?: string;
  coverImage?: any;
  readTime?: number | string;
  publishedAt?: string;
};

export type BlogPost = BlogPostListItem & {
  body?: any[];
  seoTitle?: string;
  seoDescription?: string;
};

function fallbackList(): BlogPostListItem[] {
  return fallbackArticles.map((article) => ({
    _id: article.slug,
    title: article.title,
    slug: { current: article.slug },
    category: article.category.toLowerCase(),
    excerpt: article.excerpt,
    readTime: article.readTime,
    publishedAt: article.date,
  }));
}

function fallbackPost(slug: string): BlogPost | null {
  const article = fallbackArticles.find((item) => item.slug === slug);
  if (!article) return null;
  return {
    _id: article.slug,
    title: article.title,
    slug: { current: article.slug },
    category: article.category.toLowerCase(),
    excerpt: article.excerpt,
    readTime: article.readTime,
    publishedAt: article.date,
    body: article.body.map((paragraph, index) => ({
      _key: `${article.slug}-${index}`,
      _type: "block",
      style: "normal",
      markDefs: [],
      children: [{ _key: `${article.slug}-${index}-span`, _type: "span", text: paragraph, marks: [] }],
    })),
  };
}

export async function getAllPosts() {
  if (!hasSanityConfig) return fallbackList();
  try {
    return await client.fetch<BlogPostListItem[]>(`
      *[_type == "post" && defined(slug.current)] | order(publishedAt desc) {
        _id,
        title,
        slug,
        category,
        excerpt,
        coverImage,
        readTime,
        publishedAt
      }
    `);
  } catch {
    return fallbackList();
  }
}

export async function getPostBySlug(slug: string) {
  if (!hasSanityConfig) return fallbackPost(slug);
  try {
    const post = await client.fetch<BlogPost | null>(`
      *[_type == "post" && slug.current == $slug][0] {
        _id,
        title,
        slug,
        category,
        excerpt,
        coverImage,
        readTime,
        publishedAt,
        body,
        seoTitle,
        seoDescription
      }
    `, { slug });
    return post || fallbackPost(slug);
  } catch {
    return fallbackPost(slug);
  }
}

export async function getPostsByCategory(category: string) {
  if (!hasSanityConfig) {
    return fallbackList().filter((post) => post.category === category);
  }
  try {
    return await client.fetch<BlogPostListItem[]>(`
      *[_type == "post" && defined(slug.current) && category == $category] 
      | order(publishedAt desc) {
        _id, title, slug, category, 
        excerpt, readTime, publishedAt
      }
    `, { category });
  } catch {
    return fallbackList().filter((post) => post.category === category);
  }
}

export function getSlugValue(slug: BlogPost["slug"]) {
  return typeof slug === "string" ? slug : slug?.current;
}
