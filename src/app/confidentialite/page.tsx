import type { Metadata } from "next";
import LegalDocumentPage, { type LegalSection } from "@/components/LegalDocumentPage";

export const metadata: Metadata = {
  title: "Politique de Confidentialité | Mohasib AI",
  robots: { index: false, follow: true },
};

const UPDATED_AT = "16 juin 2026";

const sections: LegalSection[] = [
  {
    id: "responsable",
    title: "Responsable du traitement",
    content: (
      <>
        <p>[TODO: legal company name once SARL is created]</p>
        <p>[TODO: registered address]</p>
        <p>Contact protection des données : [TODO: DPO / privacy contact email]</p>
        <p>Informations légales : [TODO: RC / ICE / IF numbers once available]</p>
      </>
    ),
  },
  {
    id: "donnees",
    title: "Données collectées",
    content: (
      <>
        <p><strong>Données de compte</strong> : nom, prénom, email, téléphone, mot de passe haché, jamais stocké en clair.</p>
        <p><strong>Données d&apos;entreprise</strong> : raison sociale, ICE, IF, RC, adresse, secteur d&apos;activité.</p>
        <p>
          <strong>Données financières et comptables</strong> : factures, devis, transactions, relevés bancaires importés,
          déclarations TVA, données de paie, CNSS, AMO et salaires des employés. Ces données font partie des données
          les plus sensibles traitées par le service et font l&apos;objet de mesures de sécurité renforcées, notamment
          chiffrement, accès restreint et journalisation.
        </p>
        <p>
          <strong>Documents téléversés</strong> : factures scannées, reçus, contrats, bulletins de paie, documents
          d&apos;identité d&apos;employés lorsque l&apos;utilisateur les téléverse.
        </p>
        <p>
          <strong>Données techniques</strong> : adresse IP, type d&apos;appareil, navigateur, logs de connexion,
          informations d&apos;audit et de sécurité.
        </p>
        <p>
          <strong>Communications</strong> : messages échangés via l&apos;assistant WhatsApp ou le chat IA, conservés
          pour assurer la continuité du service.
        </p>
      </>
    ),
  },
  {
    id: "finalites",
    title: "Finalités du traitement",
    content: (
      <>
        <ul>
          <li>fourniture du service : facturation, comptabilité, paie, TVA, archive et exports ;</li>
          <li>authentification et sécurité du compte ;</li>
          <li>support client et assistance ;</li>
          <li>amélioration du produit au moyen de statistiques d&apos;usage anonymisées ;</li>
          <li>conformité légale, notamment conservation comptable obligatoire de 10 ans selon le droit marocain ;</li>
          <li>communications relatives au compte : factures, alertes d&apos;expiration, sécurité et mises à jour importantes.</li>
        </ul>
        <p>
          Mohasib AI n&apos;utilise pas les données financières des utilisateurs à des fins publicitaires et ne revend
          jamais ces données à des tiers.
        </p>
      </>
    ),
  },
  {
    id: "base-legale",
    title: "Base légale du traitement",
    content: (
      <ul>
        <li>exécution du contrat, sur la base des CGU acceptées à l&apos;inscription ;</li>
        <li>obligation légale, notamment conservation comptable ;</li>
        <li>intérêt légitime, notamment sécurité, prévention de la fraude et audit ;</li>
        <li>consentement, le cas échéant, pour les communications marketing optionnelles.</li>
      </ul>
    ),
  },
  {
    id: "destinataires",
    title: "Destinataires des données",
    content: (
      <>
        <p>
          Les données peuvent être accessibles au personnel autorisé de Mohasib AI, uniquement selon le besoin, avec un
          accès limité et journalisé via le système d&apos;audit.
        </p>
        <p>Certains sous-traitants techniques sont nécessaires au fonctionnement du service :</p>
        <ul>
          <li>hébergement et base de données : Supabase ;</li>
          <li>hébergement applicatif : Vercel ;</li>
          <li>génération de documents PDF : service dédié, notamment Railway lorsque configuré ;</li>
          <li>envoi d&apos;emails : Resend ;</li>
          <li>intelligence artificielle, extraction de documents et assistant : Anthropic (Claude) ;</li>
          <li>messagerie : Meta (WhatsApp Business API), si activé par l&apos;utilisateur.</li>
        </ul>
        <p>
          Ces sous-traitants traitent les données uniquement pour le compte de Mohasib AI et selon ses instructions,
          avec des garanties contractuelles de sécurité. Mohasib AI ne vend aucune donnée à des tiers.
        </p>
        <p>
          Une transmission aux autorités marocaines peut intervenir uniquement en cas d&apos;obligation légale,
          réquisition judiciaire ou contrôle fiscal initié par l&apos;utilisateur lui-même.
        </p>
      </>
    ),
  },
  {
    id: "transferts",
    title: "Transferts internationaux",
    content: (
      <p>
        Certains sous-traitants peuvent traiter des données hors du Maroc, notamment aux États-Unis ou dans l&apos;Union
        Européenne. Ces transferts sont encadrés par des garanties contractuelles appropriées, telles que clauses
        contractuelles types ou mécanismes équivalents.
      </p>
    ),
  },
  {
    id: "conservation",
    title: "Durée de conservation",
    content: (
      <ul>
        <li>Données de compte : pendant toute la durée de la relation contractuelle, puis [TODO: X mois] après résiliation.</li>
        <li>Données comptables et financières : 10 ans, conformément à l&apos;obligation légale marocaine de conservation des documents comptables.</li>
        <li>Logs techniques et de sécurité : [TODO: X mois].</li>
        <li>Les données sont supprimées de manière sécurisée à l&apos;expiration des délais, sauf obligation légale de conservation plus longue.</li>
      </ul>
    ),
  },
  {
    id: "securite",
    title: "Sécurité des données",
    content: (
      <ul>
        <li>chiffrement des données en transit via HTTPS/TLS ;</li>
        <li>chiffrement ou protection renforcée des données sensibles au repos, notamment clés API et tokens tiers ;</li>
        <li>accès limité par système de permissions RBAC ;</li>
        <li>chaque utilisateur ne voit que ses propres données ou celles auxquelles il a été explicitement autorisé ;</li>
        <li>journal d&apos;audit complet des accès et modifications ;</li>
        <li>sauvegardes régulières.</li>
      </ul>
    ),
  },
  {
    id: "droits",
    title: "Droits des personnes concernées",
    content: (
      <>
        <p>Conformément à la loi 09-08, vous disposez des droits suivants concernant vos données personnelles :</p>
        <ul>
          <li>droit d&apos;accès à vos données ;</li>
          <li>droit de rectification des données inexactes ;</li>
          <li>droit d&apos;opposition au traitement, sous réserve des obligations légales de conservation ;</li>
          <li>droit de retrait du consentement pour les traitements fondés sur le consentement.</li>
        </ul>
        <p>Pour exercer ces droits : [TODO: DPO / privacy contact email]</p>
        <p>
          Mohasib AI répondra dans un délai raisonnable, conformément à la réglementation applicable. Vous pouvez
          également introduire une réclamation auprès de la Commission Nationale de Contrôle de la Protection des
          Données à Caractère Personnel (CNDP) : cndp.ma.
        </p>
      </>
    ),
  },
  {
    id: "cookies",
    title: "Cookies et technologies similaires",
    content: (
      <>
        <ul>
          <li>Cookies essentiels : authentification et sécurité de session, toujours actifs car nécessaires au fonctionnement.</li>
          <li>Cookies analytiques : mesure d&apos;audience anonymisée, si activée. [TODO: préciser l&apos;outil utilisé si applicable]</li>
          <li>Aucun cookie publicitaire ou tracking tiers n&apos;est utilisé dans la version actuelle.</li>
        </ul>
        <p>
          Les cookies essentiels ne nécessitent pas de consentement spécifique car ils sont techniquement nécessaires.
          Tout cookie non essentiel ajouté ultérieurement nécessitera un bandeau de consentement.
        </p>
      </>
    ),
  },
  {
    id: "mineurs",
    title: "Mineurs",
    content: (
      <p>
        Le service est destiné aux professionnels et aux entreprises. Il n&apos;est pas destiné aux personnes mineures.
      </p>
    ),
  },
  {
    id: "modifications",
    title: "Modifications de la politique",
    content: (
      <p>
        Tout changement substantiel de la présente politique fera l&apos;objet d&apos;une notification par email et/ou
        bannière dans l&apos;application au moins 15 jours avant son entrée en vigueur.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    content: (
      <>
        <p>[TODO: DPO / privacy contact email]</p>
        <p>[TODO: registered address]</p>
        <p>[TODO: CNDP registration number once issued]</p>
      </>
    ),
  },
];

export default function ConfidentialitePage() {
  return (
    <LegalDocumentPage
      title="Politique de Confidentialité"
      updatedAt={UPDATED_AT}
      intro={
        <p>
          Mohasib AI s&apos;engage à protéger les données personnelles de ses utilisateurs conformément à la loi
          marocaine n°09-08 relative à la protection des personnes physiques à l&apos;égard du traitement des données à
          caractère personnel, et conformément à sa déclaration auprès de la CNDP [TODO: CNDP registration number once issued].
        </p>
      }
      sections={sections}
      seeAlso={{ label: "Conditions Générales d'Utilisation", href: "/cgu" }}
    />
  );
}
