import type { Metadata } from "next";
import PublicFooter from "@/components/PublicFooter";
import PublicNavbar from "@/components/PublicNavbar";
import { getAllGuides } from "@/lib/guides";
import { seoMetadata } from "@/lib/seo";
import GuidesClient from "../guides/GuidesClient";

export const revalidate = 60;

export const metadata: Metadata = seoMetadata({
  title: "Modèles et documents professionnels au Maroc | Mohasib AI",
  description: "Téléchargez des contrats, tableaux, checklists et modèles prêts à adapter pour votre gestion comptable, fiscale et administrative au Maroc.",
  path: "/ressources/documents",
});

export default async function DocumentsPage() {
  const guides = await getAllGuides();

  return (
    <main className="public-site ressources-page">
      <PublicNavbar />
      <GuidesClient guides={guides} />
      <PublicFooter />
    </main>
  );
}
