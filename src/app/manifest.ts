import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Mohasib — Comptabilité IA",
    short_name: "Mohasib",
    description:
      "Factures, TVA, paie et comptabilité pour les entreprises marocaines.",
    start_url: "/tableau-de-bord?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#FAFAF6",
    theme_color: "#0D1526",
    lang: "fr-MA",
    categories: ["business", "finance", "productivity"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Tableau de bord",
        short_name: "Accueil",
        url: "/tableau-de-bord?source=pwa-shortcut",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Importer une facture",
        short_name: "Importer",
        url: "/achats?source=pwa-shortcut",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Nouvelle facture",
        short_name: "Facture",
        url: "/factures/nouvelle?source=pwa-shortcut",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
