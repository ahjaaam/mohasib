import type { Metadata } from "next";
import ProductPage from "../ProductPage";
import { seoMetadata } from "@/lib/seo";

export const metadata: Metadata = seoMetadata({
  title: "Logiciel cabinet comptable et fiduciaire au Maroc | Mohasib AI",
  description: "Découvrez Mohasib Comptable Pro : dossiers clients, facturation par dossier, TVA, paie, saisie comptable, calendrier fiscal et exports CGNC pour cabinets comptables.",
  path: "/logiciels/comptable-pro",
});

export default function ComptableProSoftwarePage() {
  return (
    <ProductPage
      eyebrow="Logiciel cabinet comptable"
      title="Un espace cabinet pour gérer vos dossiers clients plus vite"
      description="Comptable Pro donne aux fiduciaires et cabinets comptables un espace centralisé pour suivre les dossiers clients, traiter les documents, produire les déclarations et exporter les données comptables."
      audience="Pensé pour fiduciaires, comptables indépendants et cabinets"
      ctaHref="/inscription?type=fiduciaire"
      ctaLabel="Créer un compte cabinet"
      modules={[
        {
          title: "Dossiers clients centralisés",
          description: "Organisez chaque client dans un espace dédié avec ses factures, documents, transactions et déclarations.",
          features: ["Tableau de bord par dossier", "Documents et archives par client", "Adresse email dédiée par dossier"],
        },
        {
          title: "Production comptable",
          description: "Accélérez les tâches répétitives autour de la saisie, des journaux, du lettrage et des exports.",
          features: ["Saisie comptable par dossier", "Grand livre et balance", "Exports CGNC et packages de données"],
        },
        {
          title: "TVA, paie et calendrier fiscal",
          description: "Suivez les obligations de vos clients et réduisez les oublis de deadlines.",
          features: ["Déclaration TVA par dossier", "Bulletins de paie et CNSS selon le plan", "Calendrier comptable intégré"],
        },
        {
          title: "Collaboration cabinet",
          description: "Structurez le travail de l'équipe et limitez les accès selon les rôles et dossiers.",
          features: ["Collaborateurs cabinet selon le plan", "Accès par rôle et dossier", "Suivi des demandes et actions importantes"],
        },
      ]}
    />
  );
}
