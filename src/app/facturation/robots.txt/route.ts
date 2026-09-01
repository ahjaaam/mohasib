import { INVOICING_URL } from "@/lib/public-urls";

export function GET() {
  const body = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /admin",
    "Disallow: /api/",
    "Disallow: /auth/",
    "Disallow: /facturation/",
    "Disallow: /factures",
    "Disallow: /clients",
    "Disallow: /devis",
    "Disallow: /avoirs",
    "Disallow: /articles",
    "Disallow: /parametres",
    "Disallow: /connexion",
    "Disallow: /inscription",
    "Disallow: /mot-de-passe-oublie",
    "Disallow: /reinitialiser-mot-de-passe",
    "",
    `Sitemap: ${INVOICING_URL}/sitemap.xml`,
    "",
  ].join("\n");

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
