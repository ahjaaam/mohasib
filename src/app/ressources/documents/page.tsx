import type { Metadata } from "next";
import PublicFooter from "@/components/PublicFooter";
import PublicNavbar from "@/components/PublicNavbar";
import { getAllGuides } from "@/lib/guides";
import { seoMetadata } from "@/lib/seo";
import GuidesClient from "../guides/GuidesClient";

export const revalidate = 60;

export const metadata: Metadata = seoMetadata({
  title: "Documents téléchargeables Maroc — Modèles Word, Excel et PDF gratuits",
  description: "Téléchargez des modèles, templates et documents utiles au Maroc : contrats, tableaux Excel, checklists, documents comptables, fiscaux et administratifs.",
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
