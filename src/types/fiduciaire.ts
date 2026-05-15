export interface Cabinet {
  id: string;
  user_id: string;
  nom_cabinet: string | null;
  ice: string | null;
  rc: string | null;
  if_fiscal: string | null;
  adresse: string | null;
  ville: string | null;
  telephone: string | null;
  email: string | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Dossier {
  id: string;
  fiduciaire_user_id: string;
  raison_sociale: string;
  forme_juridique: string;
  ice: string | null;
  if_fiscal: string | null;
  rc: string | null;
  cnss: string | null;
  regime_tva: "mensuel" | "trimestriel" | "exonere";
  taux_tva_defaut: number;
  date_debut_exercice: string | null;
  capital_social: number;
  contact_nom: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  solde_banque_initial: number;
  solde_caisse_initial: number;
  creances_clients_initiales: number;
  dettes_fournisseurs_initiales: number;
  statut: "actif" | "inactif";
  color: string | null;
  derniere_ecriture: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DossierEcriture {
  id: string;
  dossier_id: string;
  fiduciaire_user_id: string;
  periode: string;
  journal: JournalCode;
  date: string;
  numero_piece: string | null;
  compte_cgnc: string | null;
  libelle: string | null;
  debit: number;
  credit: number;
  created_at: string;
}

export interface DossierTva {
  id: string;
  dossier_id: string;
  periode: string;
  tva_collectee: number;
  tva_deductible: number;
  net_du: number;
  statut: "a_deposer" | "deposee";
  date_depot: string | null;
  created_at: string;
}

export type JournalCode = "VT" | "AC" | "BQ" | "CA" | "OD";

export const JOURNAL_LABELS: Record<JournalCode, string> = {
  VT: "Ventes",
  AC: "Achats",
  BQ: "Banque",
  CA: "Caisse",
  OD: "Opérations Diverses",
};

export const CGNC_ACCOUNTS: { code: string; label: string }[] = [
  { code: "1121", label: "Capital social" },
  { code: "1411", label: "Associés - compte courant" },
  { code: "2111", label: "Terrains" },
  { code: "2121", label: "Constructions" },
  { code: "2132", label: "Installations techniques" },
  { code: "2141", label: "Matériel et outillage" },
  { code: "2161", label: "Matériel de transport" },
  { code: "2181", label: "Matériel de bureau et mobilier" },
  { code: "2811", label: "Amort. terrains" },
  { code: "2821", label: "Amort. constructions" },
  { code: "2841", label: "Amort. matériel et outillage" },
  { code: "2861", label: "Amort. matériel de transport" },
  { code: "2881", label: "Amort. matériel de bureau" },
  { code: "3111", label: "Marchandises" },
  { code: "3121", label: "Matières premières" },
  { code: "3211", label: "Produits finis" },
  { code: "3421", label: "Clients" },
  { code: "3431", label: "Clients - retenues de garantie" },
  { code: "3441", label: "Personnel - débiteur" },
  { code: "3451", label: "État - créances fiscales" },
  { code: "3453", label: "État - TVA récupérable" },
  { code: "3461", label: "Associés - dividendes à recevoir" },
  { code: "3491", label: "Créances douteuses" },
  { code: "4411", label: "Fournisseurs" },
  { code: "4421", label: "Fournisseurs d'immobilisations" },
  { code: "4431", label: "Personnel - rémunérations dues" },
  { code: "4432", label: "Personnel - charges sociales" },
  { code: "4441", label: "État - IS à payer" },
  { code: "4443", label: "État - IR à payer" },
  { code: "4455", label: "État - TVA facturée" },
  { code: "4456", label: "État - TVA récupérable sur charges" },
  { code: "4458", label: "État - TVA à décaisser" },
  { code: "4461", label: "Associés - comptes courants" },
  { code: "5141", label: "Banques" },
  { code: "5161", label: "Caisse" },
  { code: "6111", label: "Achats de marchandises" },
  { code: "6121", label: "Achats de matières premières" },
  { code: "6131", label: "Autres achats" },
  { code: "6141", label: "Locations" },
  { code: "6142", label: "Charges locatives" },
  { code: "6143", label: "Entretien et réparations" },
  { code: "6144", label: "Primes d'assurances" },
  { code: "6145", label: "Redevances crédit-bail" },
  { code: "6146", label: "Études et recherches" },
  { code: "6147", label: "Transport" },
  { code: "6148", label: "Déplacements et missions" },
  { code: "6149", label: "Autres services extérieurs" },
  { code: "6151", label: "Personnel extérieur" },
  { code: "6155", label: "Honoraires" },
  { code: "6156", label: "Publicité et communication" },
  { code: "6157", label: "Frais bancaires" },
  { code: "6161", label: "Impôts et taxes" },
  { code: "6171", label: "Rémunérations du personnel" },
  { code: "6174", label: "Charges sociales - CNSS" },
  { code: "6175", label: "Charges sociales - AMO" },
  { code: "6176", label: "Charges sociales - CIMR" },
  { code: "6181", label: "Dot. amort. immob. corporelles" },
  { code: "6182", label: "Dot. amort. immob. incorporelles" },
  { code: "6191", label: "Dotations aux provisions" },
  { code: "7111", label: "Ventes de marchandises" },
  { code: "7121", label: "Ventes de biens produits" },
  { code: "7131", label: "Ventes de services rendus" },
  { code: "7141", label: "Produits accessoires" },
  { code: "7151", label: "Produits de cessions" },
  { code: "7181", label: "Produits financiers" },
  { code: "7321", label: "Reprises sur amortissements" },
  { code: "7411", label: "Subventions d'exploitation" },
];
