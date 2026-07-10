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
      title="Le tableau de bord qui remet votre gestion sous contrôle"
      description="Mohasib Business rassemble vos factures, devis, avoirs, achats, paiements, TVA, paie, documents et exports au même endroit. L’objectif n’est pas seulement de gagner du temps : c’est de savoir chaque jour ce qui est encaissé, ce qui reste à payer, ce qui doit être déclaré et ce qui manque dans vos justificatifs."
      audience="Pensé pour entrepreneurs, indépendants, TPE et PME"
      ctaHref="/inscription"
      ctaLabel="Essayer gratuitement"
      heroImage={{
        src: "/images/logiciels/business-dashboard.png",
        alt: "Tableau de bord Mohasib Business avec actions rapides, échéances fiscales, TVA à déclarer, suivi des paiements, factures et transactions",
        caption: "Le tableau de bord Business donne une lecture rapide de l’activité : actions urgentes, échéances fiscales, factures en attente, TVA à déclarer, clients actifs et paiements à suivre.",
      }}
      painTitle="La vraie douleur n’est pas de faire une facture. C’est de ne plus savoir où en est l’entreprise."
      painDescription="Une facture envoyée sur WhatsApp, un reçu fournisseur dans Gmail, un paiement partiel oublié, un relevé bancaire téléchargé trop tard, une TVA calculée à la main… à la fin du mois, vous ne manquez pas d’effort, vous manquez d’un système. Mohasib transforme ces tâches dispersées en un flux simple : chaque document arrive, se classe, alimente vos chiffres et prépare vos obligations."
      highlights={[
        { value: "1", label: "espace unique pour vos ventes, achats, documents et paiements" },
        { value: "TVA", label: "suivi de la TVA collectée, déductible et à déclarer" },
        { value: "EDI", label: "préparation des exports utiles pour vos déclarations et votre comptable" },
      ]}
      workflowTitle="Ce qui change dans votre journée"
      workflowDescription="Au lieu de gérer votre comptabilité par urgence, vous travaillez par réflexe. Vous créez, importez, suivez et exportez sans reconstruire l’histoire à chaque fois."
      workflow={[
        {
          title: "Vous créez la facture au bon format",
          description: "Client, ICE, TVA, devis, avoir, PDF professionnel, envoi par email ou WhatsApp : le document commercial devient propre dès le départ.",
        },
        {
          title: "Les paiements ne disparaissent plus",
          description: "Vous voyez les factures payées, en retard, partiellement réglées et les fournisseurs à payer. Le suivi devient une routine, pas une chasse aux messages.",
        },
        {
          title: "Les justificatifs alimentent la gestion",
          description: "La boîte de réception lit les factures fournisseurs, propose les informations clés, archive le document et prépare la donnée comptable.",
        },
        {
          title: "La fin du mois devient plus calme",
          description: "TVA, exports, relevés bancaires, transactions et documents sont déjà structurés. Vous ne partez plus d’un dossier vide à chaque déclaration.",
        },
      ]}
      screenshots={[
        {
          src: "/images/logiciels/business-invoice-creation.gif",
          alt: "GIF Mohasib montrant la création d'une facture depuis la liste des factures jusqu'au formulaire de nouvelle facture",
          label: "Facturation",
          title: "Créer une facture sans repartir d’un modèle Word",
          description: "Depuis la liste des factures, l’utilisateur lance une nouvelle facture, complète les informations client, les lignes, la TVA et l’échéance, puis peut enregistrer ou envoyer le document. La facturation devient un flux guidé, pas un fichier isolé.",
        },
        {
          src: "/images/logiciels/business-inbox-ocr.png",
          alt: "Boîte de réception Mohasib avec synchronisation email, import de documents, OCR et formulaire de validation d'une facture fournisseur",
          label: "Boîte de réception",
          title: "Les factures fournisseurs deviennent des données vérifiables",
          description: "L’utilisateur peut synchroniser ses emails, importer des documents ou prendre une photo. Mohasib lit la facture, propose le fournisseur, le montant, la date, l’échéance, la catégorie, le compte comptable et la TVA. L’humain garde le contrôle : il vérifie, corrige si besoin, puis confirme.",
        },
        {
          src: "/images/logiciels/business-payment-tracking.png",
          alt: "Suivi des paiements Mohasib avec montants à encaisser, clients en retard, fournisseurs à payer et factures fournisseurs en attente",
          label: "Suivi des paiements",
          title: "Voir ce qui doit entrer et sortir",
          description: "Le suivi des paiements met côte à côte les encaissements clients et les paiements fournisseurs. Vous voyez les montants à encaisser, les retards, les factures payées, les soldes restants et les échéances à surveiller.",
        },
      ]}
      modules={[
        {
          title: "Facturation, devis et avoirs",
          description: "Créez des factures, devis et avoirs avec les informations importantes pour le Maroc : client, ICE, TVA, numérotation, montants HT/TTC et PDF clair.",
          impact: "Impact concret : vous envoyez un document sérieux en quelques minutes et vous gardez la trace de ce qui a été envoyé, accepté, payé ou annulé.",
          features: ["Factures, devis et avoirs illimités selon le plan", "PDF professionnels prêts à partager", "Envoi et suivi client depuis le même espace"],
        },
        {
          title: "Suivi des paiements",
          description: "Une entreprise peut vendre et manquer de cash. Mohasib met en face vos factures clients, vos paiements reçus, vos retards et vos fournisseurs à payer.",
          impact: "Impact concret : vous ne découvrez plus les impayés trop tard. Vous savez quoi relancer, quoi encaisser et quoi prévoir.",
          features: ["Statut payé, en attente, en retard ou partiel", "Suivi clients et fournisseurs", "Vision rapide du cash à encaisser et à sortir"],
        },
        {
          title: "Boîte de réception intelligente",
          description: "Importez une facture fournisseur, prenez une photo ou synchronisez vos emails. L’IA lit le document, extrait les informations utiles et vous aide à créer la transaction.",
          impact: "Impact concret : vos achats ne restent plus bloqués dans une boîte mail ou une pile de papiers. Ils deviennent exploitables pour la TVA, les paiements et les exports.",
          features: ["Lecture des factures et reçus", "Extraction fournisseur, date, montant, TVA et échéance", "Archivage automatique du justificatif"],
        },
        {
          title: "TVA et déclaration",
          description: "Mohasib consolide vos ventes et achats pour donner une vision plus claire de la TVA collectée, de la TVA déductible et du montant à déclarer.",
          impact: "Impact concret : vous arrêtez de refaire les calculs à la main dans l’urgence. Les données viennent directement de votre activité.",
          features: ["TVA collectée et déductible par période", "Déclaration TVA + export EDI XML selon le plan", "Historique pour vérifier ce qui a déjà été traité"],
        },
        {
          title: "Transactions, relevés et rapprochement",
          description: "Importez vos relevés bancaires, classez les mouvements et rapprochez-les avec vos factures et dépenses.",
          impact: "Impact concret : votre banque ne vit plus séparée de votre comptabilité. Les lignes bancaires expliquent ce qui est réellement payé.",
          features: ["Import de relevés bancaires", "Transactions regroupées au même endroit", "Rapprochement bancaire selon le plan"],
        },
        {
          title: "Paie, archive et exports",
          description: "Pour les structures qui grandissent, Mohasib ajoute la paie, l’archivage documentaire et les exports nécessaires pour garder une base comptable propre.",
          impact: "Impact concret : vous ne dépendez plus d’un dossier éparpillé entre Excel, Drive, WhatsApp et email. Votre historique devient consultable.",
          features: ["Bulletins de paie selon le plan", "Archivage documents", "Exports comptables, TVA et CGNC selon le plan"],
        },
      ]}
    />
  );
}
