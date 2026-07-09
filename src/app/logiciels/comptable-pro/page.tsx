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
      title="Un espace cabinet pour transformer chaque dossier client en flux de travail clair"
      description="Mohasib Comptable Pro aide les fiduciaires, comptables indépendants et cabinets à centraliser les dossiers clients, recevoir les pièces, produire la comptabilité, suivre les échéances, préparer la TVA, gérer la paie et exporter les données utiles sans perdre le fil entre les clients."
      audience="Pensé pour fiduciaires, comptables indépendants et cabinets"
      ctaHref="/inscription?type=fiduciaire"
      ctaLabel="Créer un compte cabinet"
      painTitle="Le problème d’un cabinet n’est pas seulement le volume. C’est le désordre entre les dossiers."
      painDescription="Un client envoie ses factures par WhatsApp, un autre par email, un troisième dépose tout en retard. Les échéances TVA changent selon le régime, les pièces manquent, les collaborateurs passent d’un dossier à l’autre, et la production comptable se fait souvent dans l’urgence. Comptable Pro donne une structure : chaque client a son espace, son email dédié, ses documents, ses échéances, sa saisie, ses exports et son historique."
      highlights={[
        { value: "1", label: "interface cabinet pour suivre tous les dossiers clients" },
        { value: "@", label: "adresse email dédiée par dossier pour recevoir les factures" },
        { value: "CGNC", label: "exports et production comptable pensés pour le contexte marocain" },
      ]}
      workflowTitle="Ce qui change dans l’organisation du cabinet"
      workflowDescription="Comptable Pro vise à rendre le cabinet plus prévisible. Les dossiers ne sont plus seulement des noms dans une liste : chacun devient un espace de production avec ses pièces, ses tâches et ses obligations."
      workflow={[
        {
          title: "Vous créez un dossier client complet",
          description: "Raison sociale, régime TVA, informations fiscales, collaborateurs autorisés et espace de travail dédié : le cadre du dossier est posé dès le départ.",
        },
        {
          title: "Le client envoie ses pièces au bon endroit",
          description: "Chaque dossier peut avoir son adresse email dédiée. Les factures ne se perdent plus dans la boîte générale du cabinet ou les conversations WhatsApp.",
        },
        {
          title: "Le cabinet traite et contrôle",
          description: "Les documents alimentent la boîte de réception, la saisie, les transactions, la TVA, la paie et les exports. Le collaborateur travaille dans le bon dossier, pas dans un mélange de clients.",
        },
        {
          title: "Les échéances deviennent visibles",
          description: "Le calendrier fiscal et les tableaux de bord donnent une vue claire des déclarations, retards, dossiers actifs et prochaines actions à prioriser.",
        },
      ]}
      modules={[
        {
          title: "Dossiers clients centralisés",
          description: "Chaque client dispose de son propre espace avec tableau de bord, factures, achats, documents, transactions, TVA, paie, archive et exports.",
          impact: "Impact concret : vous ne cherchez plus dans quel dossier, quel Drive ou quelle conversation se trouve l’information. Le travail est rattaché au bon client.",
          features: ["Tableau de bord par dossier", "Régime TVA et informations client", "Documents, factures et transactions séparés par client"],
        },
        {
          title: "Adresse email dédiée par dossier",
          description: "Un dossier peut recevoir ses factures sur une adresse dédiée, par exemple une adresse de type factures-client@mohasibai.com, afin d’éviter les pièces perdues.",
          impact: "Impact concret : le client garde une habitude simple — transférer ses factures — pendant que le cabinet reçoit les pièces directement dans le bon contexte.",
          features: ["Réception des factures par dossier", "Boîte de réception liée au client", "Moins de tri manuel entre plusieurs clients"],
        },
        {
          title: "Boîte de réception, OCR et archive",
          description: "Les pièces importées ou reçues sont lues, structurées et archivées. Le cabinet peut vérifier les informations avant de les utiliser dans la saisie ou la TVA.",
          impact: "Impact concret : moins de ressaisie, moins de pièces oubliées, plus de traçabilité quand un client ou l’administration demande un justificatif.",
          features: ["Lecture des factures fournisseurs", "Extraction des montants, dates, TVA et échéances", "Archivage documents par dossier"],
        },
        {
          title: "Production comptable et exports CGNC",
          description: "Le dossier client peut regrouper saisie comptable, grand livre, balance, transactions, rapprochement et exports exploitables pour la production comptable.",
          impact: "Impact concret : vos données ne restent pas enfermées dans une interface. Vous préparez les éléments nécessaires au cabinet, au contrôle et aux migrations.",
          features: ["Saisie comptable par dossier", "Grand livre, balance et exports", "Export CGNC par dossier selon le plan"],
        },
        {
          title: "TVA, paie et obligations",
          description: "Chaque dossier garde sa logique fiscale : TVA mensuelle ou trimestrielle, paie, bulletins, déclarations et échéances importantes.",
          impact: "Impact concret : vous priorisez les dossiers selon les obligations réelles, pas selon la mémoire du collaborateur qui les suit.",
          features: ["Déclaration TVA + EDI XML selon le plan", "Bulletins de paie et CNSS selon le plan", "Calendrier fiscal intégré"],
        },
        {
          title: "Collaboration et pilotage cabinet",
          description: "Le cabinet peut organiser les collaborateurs, limiter les accès et garder une vue globale sur les dossiers actifs, retards et travaux à produire.",
          impact: "Impact concret : le cabinet devient plus facile à piloter. Vous voyez où le travail bloque avant que le client ou l’échéance ne vous le rappelle.",
          features: ["Collaborateurs cabinet selon le plan", "Accès par rôle et périmètre", "Vue globale des dossiers et échéances"],
        },
      ]}
    />
  );
}
