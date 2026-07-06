import { client, hasSanityConfig } from "./sanity";

export type DownloadableGuide = {
  _id: string;
  title: string;
  slug?: { current: string } | string;
  description?: string;
  pages?: string | number;
  tags: string[];
  fileUrl?: string;
  publishedAt?: string;
};

export async function getAllGuides() {
  if (!hasSanityConfig) return [];
  try {
    return await client.fetch<DownloadableGuide[]>(`
      *[_type == "guide" && active == true && defined(slug.current)] | order(coalesce(sortOrder, 9999) asc, publishedAt desc) {
        _id,
        title,
        slug,
        "description": coalesce(description, excerpt, ""),
        pages,
        "tags": coalesce(tags, []),
        "fileUrl": coalesce(fileUrl, downloadFile.asset->url, file.asset->url, pdf.asset->url),
        publishedAt
      }
    `);
  } catch {
    return [];
  }
}

export async function getGuideBySlug(slug: string) {
  if (!hasSanityConfig) return null;
  try {
    const decodedSlug = decodeURIComponent(slug);
    return await client.fetch<DownloadableGuide | null>(`
      *[_type == "guide" && active == true && slug.current == $slug][0] {
        _id,
        title,
        slug,
        "description": coalesce(description, excerpt, ""),
        pages,
        "tags": coalesce(tags, []),
        "fileUrl": coalesce(fileUrl, downloadFile.asset->url, file.asset->url, pdf.asset->url),
        publishedAt
      }
    `, { slug: decodedSlug });
  } catch {
    return null;
  }
}
