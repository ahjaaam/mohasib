import type { MetadataRoute } from "next";
import { MARKETING_URL } from "@/lib/public-urls";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
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
          "/ressources/outils",
          "/ressources/outils/",
          "/tableau-de-bord",
          "/parametres",
          "/journal-audit",
          "/boite-de-reception",
          "/notes-de-frais",
          "/factures",
          "/transactions",
          "/clients",
          "/paie",
          "/tva",
          "/rapports",
          "/rapprochement",
          "/saisie",
          "/export-fiduciaire",
          "/comptable-pro/",
          "/connexion",
          "/inscription",
          "/tarifs",
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
