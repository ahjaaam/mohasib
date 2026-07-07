import type { Metadata } from "next";
import ProductPage from "../ProductPage";
import { seoMetadata } from "@/lib/seo";

export const metadata: Metadata = seoMetadata({
  title: "Logiciel de gestion et comptabilité pour PME marocaines | Mohasib AI",
  description: "Découvrez Mohasib Business : facturation, TVA, OCR, trésorerie, paie, documents et exports comptables pour entrepreneurs, TPE et PME au Maroc.",
  path: "/logiciels/business",
});

export default function BusinessSoftwarePage() {
  return (
    <ProductPage
      eyebrow="Logiciel Business"
      title="Un logiciel simple pour gérer votre activité, vos factures et votre TVA"
      description="Mohasib Business aide les entrepreneurs, TPE et PME marocaines à centraliser leur facturation, suivre leurs paiements, préparer la TVA, classer leurs documents et garder une vision claire de leur activité."
      audience="Pensé pour entrepreneurs, indépendants, TPE et PME"
      ctaHref="/inscription"
      ctaLabel="Essayer gratuitement"
      modules={[
        {
          title: "Facturation, devis et avoirs",
          description: "Créez des documents commerciaux propres, suivez leur statut et partagez-les facilement avec vos clients.",
          features: ["Factures, devis et avoirs clients", "PDF professionnels et partage client", "Suivi des paiements et relances"],
        },
        {
          title: "TVA et obligations fiscales",
          description: "Gardez une vision claire de votre TVA collectée, déductible et à déclarer.",
          features: ["Calcul TVA à partir des factures et achats", "Préparation des déclarations", "Historique et suivi par période"],
        },
        {
          title: "Boîte de réception et OCR",
          description: "Importez vos factures fournisseurs et documents, puis laissez l'IA extraire les informations utiles.",
          features: ["Lecture OCR des factures et reçus", "Classement documentaire", "Archivage sécurisé des justificatifs"],
        },
        {
          title: "Banque, paie et exports",
          description: "Allez plus loin avec l'import bancaire, la paie et les exports utiles pour votre comptable.",
          features: ["Import de relevés bancaires", "Bulletins de paie selon le plan", "Exports PDF et données comptables"],
        },
      ]}
    />
  );
}
