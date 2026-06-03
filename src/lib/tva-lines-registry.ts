export type TVASection = "A" | "B" | "C" | "D" | "E";

export type TVALine = {
  code: number;
  label_fr: string;
  section: TVASection;
  subsection: string;
  taux?: number;
  computed?: boolean;
  always_shown?: boolean;
};

export const TVA_LINES: TVALine[] = [
  { code: 10, label_fr: "CA total réalisé (HT)", section: "A", subsection: "CA Total", always_shown: true },
  { code: 20, label_fr: "Opérations hors champ TVA", section: "A", subsection: "CA Total", always_shown: true },
  { code: 30, label_fr: "Opérations exonérées sans droit à déduction (art. 91)", section: "A", subsection: "CA Total", always_shown: true },
  { code: 40, label_fr: "Opérations exonérées avec droit à déduction (art. 92)", section: "A", subsection: "CA Total", always_shown: true },
  { code: 50, label_fr: "Opérations en suspension TVA (art. 94)", section: "A", subsection: "CA Total", always_shown: true },
  { code: 60, label_fr: "CA imposable (10 - (20+30+40+50))", section: "A", subsection: "CA Total", computed: true, always_shown: true },
  { code: 74, label_fr: "Location de compteurs d'électricité", section: "B", subsection: "Taux 20%", taux: 20 },
  { code: 80, label_fr: "Opérations de production et de distribution", section: "B", subsection: "Taux 20%", taux: 20 },
  { code: 81, label_fr: "Prestations de services", section: "B", subsection: "Taux 20%", taux: 20 },
  { code: 82, label_fr: "Professions libérales (art. 89-I-12°)", section: "B", subsection: "Taux 20%", taux: 20 },
  { code: 83, label_fr: "Opérations de crédit-bail", section: "B", subsection: "Taux 20%", taux: 20 },
  { code: 87, label_fr: "Entreprises de travaux immobiliers", section: "B", subsection: "Taux 20%", taux: 20 },
  { code: 88, label_fr: "Transport voyageurs et marchandises (hors urbain)", section: "B", subsection: "Taux 20%", taux: 20 },
  { code: 90, label_fr: "Énergie électrique", section: "B", subsection: "Taux 20%", taux: 20 },
  { code: 93, label_fr: "Vente de biens meubles d'occasion", section: "B", subsection: "Taux 20%", taux: 20 },
  { code: 94, label_fr: "Livraison à soi-même de constructions", section: "B", subsection: "Taux 20%", taux: 20 },
  { code: 95, label_fr: "Régime de marge (art. 125 bis et 125 quater)", section: "B", subsection: "Taux 20%", taux: 20 },
  { code: 102, label_fr: "Autres opérations (20%)", section: "B", subsection: "Taux 20%", taux: 20 },
  { code: 68, label_fr: "Opérations 2025 (18%)", section: "B", subsection: "Taux transitoires", taux: 18 },
  { code: 72, label_fr: "Opérations 2024 (16%)", section: "B", subsection: "Taux transitoires", taux: 16 },
  { code: 67, label_fr: "Opérations 2025 (15%)", section: "B", subsection: "Taux transitoires", taux: 15 },
  { code: 104, label_fr: "Opérations avant 1er janvier 2024 (14%)", section: "B", subsection: "Taux transitoires", taux: 14 },
  { code: 64, label_fr: "Opérations 2024/2025 (13%)", section: "B", subsection: "Taux transitoires", taux: 13 },
  { code: 71, label_fr: "Opérations 2024 ou 2025 (12%)", section: "B", subsection: "Taux transitoires", taux: 12 },
  { code: 70, label_fr: "Opérations 2024 (11%)", section: "B", subsection: "Taux transitoires", taux: 11 },
  { code: 63, label_fr: "Pâtes alimentaires (formes longues)", section: "B", subsection: "Taux 10%", taux: 10 },
  { code: 65, label_fr: "Transport urbain et routier voyageurs/marchandises", section: "B", subsection: "Taux 10%", taux: 10 },
  { code: 73, label_fr: "Location compteurs d'eau (usage non domestique)", section: "B", subsection: "Taux 10%", taux: 10 },
  { code: 75, label_fr: "Vente énergie électrique renouvelable", section: "B", subsection: "Taux 10%", taux: 10 },
  { code: 76, label_fr: "Panneaux photovoltaïques", section: "B", subsection: "Taux 10%", taux: 10 },
  { code: 77, label_fr: "Chauffe-eaux solaires", section: "B", subsection: "Taux 10%", taux: 10 },
  { code: 78, label_fr: "Aliments bétail et volailles", section: "B", subsection: "Taux 10%", taux: 10 },
  { code: 79, label_fr: "Équipements à usage agricole exclusivement", section: "B", subsection: "Taux 10%", taux: 10 },
  { code: 85, label_fr: "Bois, liège, charbon de bois", section: "B", subsection: "Taux 10%", taux: 10 },
  { code: 86, label_fr: "Engins et filets de pêche maritime", section: "B", subsection: "Taux 10%", taux: 10 },
  { code: 89, label_fr: "Hébergement, restauration, cafés", section: "B", subsection: "Taux 10%", taux: 10 },
  { code: 92, label_fr: "Location immeubles à usage d'hôtels", section: "B", subsection: "Taux 10%", taux: 10 },
  { code: 96, label_fr: "Sel de cuisine", section: "B", subsection: "Taux 10%", taux: 10 },
  { code: 97, label_fr: "Riz usiné", section: "B", subsection: "Taux 10%", taux: 10 },
  { code: 98, label_fr: "Huiles fluides alimentaires (hors palme)", section: "B", subsection: "Taux 10%", taux: 10 },
  { code: 99, label_fr: "Valeurs mobilières", section: "B", subsection: "Taux 10%", taux: 10 },
  { code: 100, label_fr: "Banque, crédit et commissions de change", section: "B", subsection: "Taux 10%", taux: 10 },
  { code: 101, label_fr: "Actions et parts sociales", section: "B", subsection: "Taux 10%", taux: 10 },
  { code: 103, label_fr: "Œuvres et objets d'art", section: "B", subsection: "Taux 10%", taux: 10 },
  { code: 106, label_fr: "Eau non domestique + assainissement", section: "B", subsection: "Taux 10%", taux: 10 },
  { code: 108, label_fr: "Gaz de pétrole et hydrocarbures gazeux", section: "B", subsection: "Taux 10%", taux: 10 },
  { code: 109, label_fr: "Huiles de pétrole ou de schistes", section: "B", subsection: "Taux 10%", taux: 10 },
  { code: 112, label_fr: "Billets musées, cinéma, théâtre", section: "B", subsection: "Taux 10%", taux: 10 },
  { code: 113, label_fr: "Sucre raffiné ou aggloméré", section: "B", subsection: "Taux 10%", taux: 10 },
  { code: 117, label_fr: "Voiture économique + prestations de montage", section: "B", subsection: "Taux 10%", taux: 10 },
  { code: 118, label_fr: "Autres opérations (10%)", section: "B", subsection: "Taux 10%", taux: 10 },
  { code: 91, label_fr: "Commissions agents/courtiers d'assurances (sans déduction)", section: "B", subsection: "Taux 10% sans déduction", taux: 10 },
  { code: 66, label_fr: "Opérations 2025 (9%)", section: "B", subsection: "Taux transitoires", taux: 9 },
  { code: 69, label_fr: "Opérations 2024 (8%)", section: "B", subsection: "Taux transitoires", taux: 8 },
  { code: 119, label_fr: "Opérations avant 1er janvier 2024 (7%)", section: "B", subsection: "Taux transitoires", taux: 7 },
  { code: 129, label_fr: "Opérations avec non-résidents (art. 115)", section: "C", subsection: "Non-résidents" },
  { code: 120, label_fr: "Reversement TVA (cessation, régularisation...)", section: "D", subsection: "Retenues" },
  { code: 121, label_fr: "Retenue à la source - commissions sociétés d'assurance", section: "D", subsection: "Retenues" },
  { code: 122, label_fr: "Retenue à la source - intérêts établissements de crédit", section: "D", subsection: "Retenues" },
  { code: 123, label_fr: "Retenue à la source - produits titrisation", section: "D", subsection: "Retenues" },
  { code: 124, label_fr: "Retenue à la source - non-résidents / clients hors champ", section: "D", subsection: "Retenues" },
  { code: 127, label_fr: "Régime auto-liquidation (art. 125 quinquies)", section: "D", subsection: "Retenues" },
  { code: 128, label_fr: "Redevances et droits de licence (art. 91-XI)", section: "D", subsection: "Retenues" },
  { code: 140, label_fr: "Prestations de services (20%)", section: "E", subsection: "Services - non immobilisés", taux: 20 },
  { code: 141, label_fr: "Transport hors urbain (20%)", section: "E", subsection: "Services - non immobilisés", taux: 20 },
  { code: 142, label_fr: "Opérations de banque (10%)", section: "E", subsection: "Services - non immobilisés", taux: 10 },
  { code: 143, label_fr: "Hôtels/Motels voyageurs, ensemble immobilier touristique (10%)", section: "E", subsection: "Services - non immobilisés", taux: 10 },
  { code: 62, label_fr: "Autres prestations de services (18%)", section: "E", subsection: "Services - non immobilisés", taux: 18 },
  { code: 154, label_fr: "Autres prestations de services (16%)", section: "E", subsection: "Services - non immobilisés", taux: 16 },
  { code: 133, label_fr: "Autres prestations de services (14%)", section: "E", subsection: "Services - non immobilisés", taux: 14 },
  { code: 171, label_fr: "Autres prestations de services (13%)", section: "E", subsection: "Services - non immobilisés", taux: 13 },
  { code: 172, label_fr: "Autres prestations de services (12%)", section: "E", subsection: "Services - non immobilisés", taux: 12 },
  { code: 153, label_fr: "Autres prestations de services (10%)", section: "E", subsection: "Services - non immobilisés", taux: 10 },
  { code: 145, label_fr: "Achats à l'importation (20%)", section: "E", subsection: "Achats - non immobilisés", taux: 20 },
  { code: 146, label_fr: "Achats à l'intérieur (20%)", section: "E", subsection: "Achats - non immobilisés", taux: 20 },
  { code: 149, label_fr: "Achats à l'importation (10%)", section: "E", subsection: "Achats - non immobilisés", taux: 10 },
  { code: 150, label_fr: "Achats à l'intérieur (10%)", section: "E", subsection: "Achats - non immobilisés", taux: 10 },
  { code: 159, label_fr: "Autres achats (18%)", section: "E", subsection: "Achats - non immobilisés", taux: 18 },
  { code: 134, label_fr: "Autres achats (16%)", section: "E", subsection: "Achats - non immobilisés", taux: 16 },
  { code: 161, label_fr: "Autres achats (15%)", section: "E", subsection: "Achats - non immobilisés", taux: 15 },
  { code: 135, label_fr: "Autres achats (14%)", section: "E", subsection: "Achats - non immobilisés", taux: 14 },
  { code: 136, label_fr: "Autres achats (12%)", section: "E", subsection: "Achats - non immobilisés", taux: 12 },
  { code: 137, label_fr: "Autres achats (11%)", section: "E", subsection: "Achats - non immobilisés", taux: 11 },
  { code: 61, label_fr: "Autres achats (9%)", section: "E", subsection: "Achats - non immobilisés", taux: 9 },
  { code: 138, label_fr: "Autres achats (8%)", section: "E", subsection: "Achats - non immobilisés", taux: 8 },
  { code: 139, label_fr: "Autres achats (7%)", section: "E", subsection: "Achats - non immobilisés", taux: 7 },
  { code: 155, label_fr: "Travaux à façon (20%)", section: "E", subsection: "Achats - non immobilisés", taux: 20 },
  { code: 156, label_fr: "Sous-traitance travaux immobiliers (20%)", section: "E", subsection: "Achats - non immobilisés", taux: 20 },
  { code: 158, label_fr: "TVA non apparente (art. 125 ter)", section: "E", subsection: "Achats - non immobilisés" },
  { code: 173, label_fr: "TVA auto-liquidation déduite (art. 125 quinquies)", section: "E", subsection: "Achats - non immobilisés" },
  { code: 162, label_fr: "Immobilisations à l'importation (20%)", section: "E", subsection: "Immobilisations", taux: 20 },
  { code: 163, label_fr: "Immobilisations à l'intérieur (20%)", section: "E", subsection: "Immobilisations", taux: 20 },
  { code: 164, label_fr: "Livraison à soi-même hors constructions (20%)", section: "E", subsection: "Immobilisations", taux: 20 },
  { code: 165, label_fr: "Installation et pose (20%)", section: "E", subsection: "Immobilisations", taux: 20 },
  { code: 166, label_fr: "Constructions (20%)", section: "E", subsection: "Immobilisations", taux: 20 },
  { code: 167, label_fr: "Livraison à soi-même de constructions (20%)", section: "E", subsection: "Immobilisations", taux: 20 },
  { code: 168, label_fr: "Autres immobilisations (14%)", section: "E", subsection: "Immobilisations", taux: 14 },
  { code: 160, label_fr: "Autres immobilisations (10%)", section: "E", subsection: "Immobilisations", taux: 10 },
  { code: 169, label_fr: "Autres immobilisations (7%)", section: "E", subsection: "Immobilisations", taux: 7 },
];

export const DEFAULT_ENABLED_CODES = new Set([10, 20, 30, 40, 50, 60, 81, 82, 140, 146, 153, 150]);

export const TVA_PRESETS = [
  { label: "Prestations de services", codes: [81, 82, 140, 146, 153, 150] },
  { label: "Commerce / Négoce", codes: [80, 102, 145, 146, 149, 150] },
  { label: "BTP / Immobilier", codes: [87, 156, 163, 166, 162] },
];

export function getEnabledLineCodes(globalConfig: number[], periodConfig: number[] | null): Set<number> {
  return new Set(periodConfig ?? globalConfig);
}

export function withAlwaysShown(codes: Iterable<number>): Set<number> {
  const enabled = new Set(codes);
  for (const line of TVA_LINES) {
    if (line.always_shown) enabled.add(line.code);
  }
  return enabled;
}
