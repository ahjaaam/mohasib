import type { Metadata } from "next";
import Link from "next/link";
import LegalDocumentPage, { type LegalSection } from "@/components/LegalDocumentPage";

export const metadata: Metadata = {
  title: "Conditions Générales d'Utilisation | Mohasib AI",
  robots: { index: false, follow: true },
};

const UPDATED_AT = "23 juin 2026";

const sections: LegalSection[] = [
  {
    id: "objet",
    title: "Objet",
    content: (
      <>
        <p>
          Mohasib AI est un logiciel SaaS d&apos;aide à la gestion comptable, à la facturation et à la paie, destiné
          aux entrepreneurs, TPE/PME et cabinets comptables au Maroc.
        </p>
        <p>
          Mohasib AI est un <strong>outil logiciel</strong>. Mohasib AI n&apos;est pas un cabinet d&apos;expertise
          comptable, n&apos;est pas un commissaire aux comptes et ne dispense pas de conseil fiscal, juridique ou
          comptable professionnel engageant la responsabilité d&apos;un expert.
        </p>
      </>
    ),
  },
  {
    id: "acceptation",
    title: "Acceptation des conditions",
    content: (
      <p>
        L&apos;utilisation du service implique l&apos;acceptation pleine et entière des présentes Conditions Générales
        d&apos;Utilisation. Si vous n&apos;acceptez pas ces conditions, vous ne devez pas utiliser Mohasib AI.
      </p>
    ),
  },
  {
    id: "description",
    title: "Description du service",
    content: (
      <>
        <p>Mohasib AI propose notamment les fonctionnalités suivantes, à un niveau général :</p>
        <ul>
          <li>facturation, devis et avoirs ;</li>
          <li>OCR et extraction de données depuis des documents ;</li>
          <li>aide au calcul des déclarations TVA ;</li>
          <li>gestion de la paie et préparation de bulletins ;</li>
          <li>import et suivi des transactions bancaires ;</li>
          <li>exports comptables ;</li>
          <li>assistant IA et assistant WhatsApp lorsque ces fonctionnalités sont activées.</li>
        </ul>
        <p>
          Les déclarations et exports générés par Mohasib AI sont des aides à la préparation. L&apos;utilisateur reste
          seul responsable du dépôt final auprès des administrations compétentes, notamment SIMPL-TVA, la DGI, la CNSS
          ou Damancom.
        </p>
        <p>
          Les fonctionnalités d&apos;intelligence artificielle peuvent produire des erreurs ou interprétations
          incomplètes. L&apos;utilisateur doit vérifier toutes les données avant tout dépôt officiel, paiement,
          déclaration ou prise de décision.
        </p>
      </>
    ),
  },
  {
    id: "compte",
    title: "Inscription et compte utilisateur",
    content: (
      <ul>
        <li>L&apos;utilisateur doit avoir au moins 18 ans ou la capacité juridique de contracter pour une entreprise.</li>
        <li>L&apos;utilisateur garantit l&apos;exactitude des informations fournies, notamment ICE, IF, RC et identité de l&apos;entreprise.</li>
        <li>L&apos;utilisateur est responsable de la confidentialité de ses identifiants et de toute activité réalisée depuis son compte.</li>
        <li>Un compte correspond à une entreprise, sauf usage Comptable Pro multi-dossiers prévu par le service.</li>
      </ul>
    ),
  },
  {
    id: "abonnements",
    title: "Abonnements et facturation",
    content: (
      <>
        <ul>
          <li>Période d&apos;essai gratuite : 7 jours, avec limites précisées dans l&apos;application, sans obligation de carte bancaire.</li>
          <li>Plans payants : facturation mensuelle ou annuelle, prix affichés sur <Link href="/tarifs" className="font-semibold text-[#C8924A] hover:underline">/tarifs</Link>, TTC.</li>
          <li>Les mises à niveau prennent effet immédiatement ; les rétrogradations prennent effet à la fin de la période en cours.</li>
          <li>Modes de paiement acceptés : virement bancaire, autres moyens à venir.</li>
          <li>Aucun remboursement au prorata n&apos;est dû, sauf erreur de facturation reconnue.</li>
        </ul>
        <p>
          Mohasib AI se réserve le droit de modifier ses tarifs avec un préavis de 30 jours pour les abonnements en cours.
        </p>
      </>
    ),
  },
  {
    id: "resiliation",
    title: "Résiliation",
    content: (
      <>
        <p>
          L&apos;abonnement peut être résilié à tout moment depuis les paramètres du compte ou par demande écrite à
          a.ahjame@gmail.com.
        </p>
        <p>
          Les données restent accessibles en lecture pendant [TODO: durée d&apos;accès après résiliation, ex. 30 jours]
          après résiliation avant suppression définitive, sauf obligation légale de conservation plus longue.
        </p>
        <p>
          Mohasib AI peut suspendre un compte en cas de manquement grave aux présentes CGU ou de non-paiement prolongé,
          avec préavis raisonnable sauf urgence, notamment fraude, abus ou atteinte à la sécurité du service.
        </p>
      </>
    ),
  },
  {
    id: "responsabilites-utilisateur",
    title: "Responsabilités de l'utilisateur",
    content: (
      <ul>
        <li>L&apos;utilisateur est responsable de l&apos;exactitude des données saisies, importées ou validées.</li>
        <li>L&apos;utilisateur doit vérifier les calculs avant tout dépôt officiel.</li>
        <li>L&apos;utilisateur doit respecter la législation marocaine applicable à son activité.</li>
        <li>L&apos;usage du compte est limité à son entreprise ou cabinet ; la revente du service nécessite un accord écrit préalable.</li>
      </ul>
    ),
  },
  {
    id: "responsabilites-mohasib",
    title: "Responsabilités et limites de Mohasib",
    content: (
      <ul>
        <li>Mohasib AI fournit le service en l&apos;état, avec un objectif de disponibilité sans garantie de disponibilité à 100%.</li>
        <li>Mohasib AI n&apos;est pas responsable des décisions fiscales, comptables, sociales ou de gestion prises sur la base des données du logiciel.</li>
        <li>La responsabilité de Mohasib AI est limitée au montant des sommes versées par l&apos;utilisateur au cours des 12 derniers mois.</li>
        <li>Mohasib AI exclut toute responsabilité pour les dommages indirects, pertes d&apos;exploitation, pertes de données non imputables au service ou préjudices commerciaux indirects.</li>
      </ul>
    ),
  },
  {
    id: "propriete",
    title: "Propriété intellectuelle",
    content: (
      <>
        <p>
          Le logiciel, son code, son design, ses interfaces et sa marque appartiennent à Mohasib AI.
        </p>
        <p>
          Les données saisies par l&apos;utilisateur, notamment factures, clients, écritures, documents et informations
          comptables, lui appartiennent. Mohasib AI n&apos;en revendique aucune propriété et ne les utilise pas à
          d&apos;autres fins que la fourniture, la sécurisation et l&apos;amélioration du service.
        </p>
      </>
    ),
  },
  {
    id: "donnees",
    title: "Protection des données personnelles",
    content: (
      <p>
        Les traitements de données personnelles sont décrits dans la{" "}
        <a href="/confidentialite" className="font-semibold text-[#C8924A] hover:underline">Politique de Confidentialité</a>.
      </p>
    ),
  },
  {
    id: "modification",
    title: "Modification des CGU",
    content: (
      <p>
        Mohasib AI peut modifier les présentes CGU. Les changements substantiels feront l&apos;objet d&apos;une
        notification par email et/ou bannière dans l&apos;application au moins 15 jours avant leur entrée en vigueur.
      </p>
    ),
  },
  {
    id: "droit",
    title: "Droit applicable et juridiction",
    content: (
      <p>
        Les présentes CGU sont soumises au droit marocain. Les tribunaux compétents sont :
        [TODO: jurisdiction — likely "tribunaux de commerce de [ville]"].
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    content: (
      <>
        <p>Mohasib AI</p>
        <p>Responsable : Abdelhamid Ahjame</p>
        <p>Email : a.ahjame@gmail.com</p>
        <p>Téléphone : +212777884056</p>
        <p>Téléphone : +212670101952</p>
      </>
    ),
  },
];

export default function CGUPage() {
  return (
    <LegalDocumentPage
      title="Conditions Générales d'Utilisation"
      updatedAt={UPDATED_AT}
      sections={sections}
      seeAlso={{ label: "Politique de Confidentialité", href: "/confidentialite" }}
    />
  );
}
