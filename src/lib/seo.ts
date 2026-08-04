import type { Metadata } from "next";
import { marketingUrl } from "@/lib/public-urls";

const SITE_NAME = "Mohasib AI";
const DEFAULT_TITLE = "Mohasib AI — Logiciel de comptabilité, facturation et TVA au Maroc";
const DEFAULT_DESCRIPTION =
  "Mohasib AI aide les entrepreneurs, PME et cabinets comptables marocains à gérer factures, TVA, paie, documents, trésorerie et exports comptables.";
const DEFAULT_SOCIAL_IMAGE = "/og-image-2026.png";

type SeoMetadataInput = {
  title?: string;
  description?: string;
  path?: string;
  type?: "website" | "article";
  image?: string;
  noIndex?: boolean;
};

export function seoMetadata({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  path = "/",
  type = "website",
  image = DEFAULT_SOCIAL_IMAGE,
  noIndex = false,
}: SeoMetadataInput = {}): Metadata {
  const url = marketingUrl(path);
  const imageUrl = image.startsWith("http") ? image : marketingUrl(image);
  const usesDefaultImage = image === DEFAULT_SOCIAL_IMAGE;

  return {
    title,
    description,
    alternates: { canonical: url },
    robots: noIndex ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      title,
      description,
      url,
      type,
      locale: "fr_MA",
      siteName: SITE_NAME,
      images: [{
        url: imageUrl,
        width: usesDefaultImage ? 1920 : 1200,
        height: usesDefaultImage ? 1080 : 630,
        alt: title,
      }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Mohasib AI",
  url: marketingUrl("/"),
  logo: marketingUrl("/logo2.png"),
  sameAs: ["https://www.linkedin.com/company/mohasibai/"],
  contactPoint: [
    {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: "a.ahjame@gmail.com",
      areaServed: "MA",
      availableLanguage: ["fr", "ar"],
    },
  ],
};

export const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Mohasib AI",
  url: marketingUrl("/"),
  inLanguage: "fr-MA",
  publisher: {
    "@type": "Organization",
    name: "Mohasib AI",
  },
};
