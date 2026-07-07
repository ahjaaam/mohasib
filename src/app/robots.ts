import type { MetadataRoute } from "next";
import { MARKETING_URL } from "@/lib/public-urls";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/tarifs",
          "/logiciels",
          "/logiciels/",
          "/ressources",
          "/ressources/",
          "/centre-aide",
          "/cgu",
          "/confidentialite",
        ],
        disallow: [
          "/admin",
          "/admin/",
          "/api/",
          "/auth/",
          "/dashboard",
          "/settings",
          "/inbox",
          "/invoices",
          "/transactions",
          "/clients",
          "/paie",
          "/tva",
          "/rapports",
          "/rapprochement",
          "/saisie",
          "/export",
          "/comptable-pro/",
          "/connexion",
          "/inscription",
          "/mot-de-passe-oublie",
          "/reinitialiser-mot-de-passe",
          "/invitations/",
        ],
      },
    ],
    sitemap: `${MARKETING_URL}/sitemap.xml`,
    host: MARKETING_URL,
  };
}
