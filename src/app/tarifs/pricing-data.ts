export type PricingSlug = "entreprise" | "cabinet";

export type PricingPackage = {
  slug: PricingSlug;
  name: string;
  detailName: string;
  shortDescription: string;
  description: string;
  cardPrice: string;
  cardPriceNote: string;
  price: number;
  priceSuffix: string;
  minimumNote?: string;
  sliderLabel: string;
  sliderHint: string;
  sliderUnit: string;
  min: number;
  max: number;
  features: string[];
  addons: Array<{ name: string; description: string; price: string }>;
};

export const PRICING_PACKAGES: PricingPackage[] = [
  {
    slug: "entreprise",
    name: "Entreprise",
    detailName: "Entreprise",
    shortDescription: "Pour une entreprise qui gère ses opérations financières et comptables. La capacité évolue avec les utilisateurs.",
    description: "Une formule pour une entreprise. Ajoutez des utilisateurs pour augmenter toutes les limites incluses.",
    cardPrice: "299 DH",
    cardPriceNote: "prix mensuel de départ",
    price: 299,
    priceSuffix: "/ mois",
    sliderLabel: "Utilisateurs",
    sliderHint: "Faites glisser pour augmenter toutes les limites",
    sliderUnit: "utilisateur",
    min: 1,
    max: 20,
    features: [
      "Factures, devis, avoirs et relances",
      "Capture de documents et OCR",
      "Import bancaire et suivi des transactions",
      "Écritures automatiques, CGNC et TVA",
      "Tableau de bord, trésorerie, bilan et CPC",
      "Accès comptable et exports",
    ],
    addons: [
      { name: "Mohasib AI Agent", description: "Répond aux questions, explique les chiffres et prépare les actions comptables.", price: "99 DH / espace / mois" },
      { name: "Paie", description: "Paie, bulletins, CNSS, validation et archive salarié.", price: "49 DH / mois + 12 DH / salarié" },
      { name: "Extraction supplémentaire", description: "OCR au-delà de la limite incluse.", price: "Selon l’usage" },
      { name: "Stockage supplémentaire", description: "Espace sécurisé additionnel.", price: "10 DH par 5 Go / mois" },
    ],
  },
  {
    slug: "cabinet",
    name: "Cabinet comptable",
    detailName: "Cabinet",
    shortDescription: "Pour un cabinet qui gère les dossiers de ses clients en interne. La capacité évolue avec les dossiers actifs.",
    description: "Une formule pour les dossiers clients gérés en interne par le cabinet.",
    cardPrice: "49 DH",
    cardPriceNote: "par client actif / mois",
    price: 49,
    priceSuffix: "/ client actif / mois",
    minimumNote: "10 clients minimum · 490 DH / mois",
    sliderLabel: "Dossiers clients actifs",
    sliderHint: "Faites glisser pour augmenter la capacité du cabinet",
    sliderUnit: "client",
    min: 10,
    max: 150,
    features: [
      "Collecte multicanale des documents",
      "OCR et règles fournisseurs",
      "Transactions bancaires et écritures suggérées",
      "Suivi des pièces manquantes",
      "Contrôles TVA et exports comptables",
      "Tableau de bord du portefeuille",
    ],
    addons: [
      { name: "Mohasib AI Agent", description: "Analyse le dossier, détecte les exceptions et prépare le travail comptable.", price: "99 DH / dossier activé / mois" },
      { name: "Paie client", description: "Active la paie sur les dossiers sélectionnés.", price: "12 DH / salarié actif / mois" },
      { name: "Volume supplémentaire", description: "Capacité d’extraction additionnelle.", price: "Selon l’usage" },
      { name: "Collaborateur supplémentaire", description: "Accès supplémentaire pour l’équipe du cabinet.", price: "99 DH / collaborateur / mois" },
    ],
  },
];

export function getPricingPackage(slug: string) {
  return PRICING_PACKAGES.find((item) => item.slug === slug);
}
