export const CATALOG_IMPORT_HEADERS = [
  "Nom *",
  "Description",
  "Catégorie",
  "Prix unitaire HT",
  "Unité",
  "TVA (%)",
] as const;

export const CATALOG_TVA_RATES = [0, 7, 10, 14, 20] as const;
export const CATALOG_UNITS = ["unité", "mois", "heure", "jour", "pièce", "service"] as const;
export const MAX_CATALOG_IMPORT_ROWS = 1_000;

export type CatalogImportItem = {
  name: string;
  description: string | null;
  category: string | null;
  unit: string;
  unit_price: number;
  tva_rate: number;
};

export type CatalogImportPreviewRow = CatalogImportItem & {
  sourceRow: number;
  errors: string[];
};

const HEADER_ALIASES: Record<string, keyof CatalogImportItem> = {
  nom: "name",
  article: "name",
  designation: "name",
  description: "description",
  categorie: "category",
  category: "category",
  prix: "unit_price",
  prixunitaire: "unit_price",
  prixunitaireht: "unit_price",
  prixht: "unit_price",
  unite: "unit",
  tva: "tva_rate",
  tauxdetva: "tva_rate",
};

function normalizedText(value: unknown) {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr");
}

function normalizedHeader(value: unknown) {
  return normalizedText(value).replace(/[^a-z0-9]/g, "");
}

function optionalText(value: unknown, maxLength: number) {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, maxLength) : null;
}

function parseNumber(value: unknown, fallback: number) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return { value: fallback, valid: true };
  }
  if (typeof value === "number") {
    return { value, valid: Number.isFinite(value) };
  }
  let cleaned = String(value)
    .trim()
    .replace(/\s|\u00a0|\u202f/g, "")
    .replace(/%$/, "");
  if (cleaned.includes(",")) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  }
  const parsed = Number(cleaned);
  return { value: parsed, valid: Number.isFinite(parsed) };
}

export function parseCatalogImportRows(
  rows: unknown[][],
  existingNames: Iterable<string> = [],
): CatalogImportPreviewRow[] {
  if (!rows.length) return [];

  const headerIndexes = new Map<keyof CatalogImportItem, number>();
  rows[0].forEach((header, index) => {
    const key = HEADER_ALIASES[normalizedHeader(header)];
    if (key && !headerIndexes.has(key)) headerIndexes.set(key, index);
  });

  if (!headerIndexes.has("name")) {
    throw new Error('La colonne obligatoire "Nom *" est introuvable.');
  }

  const dataRows = rows.slice(1).filter((row) =>
    row.some((cell) => String(cell ?? "").trim() !== ""),
  );
  if (dataRows.length > MAX_CATALOG_IMPORT_ROWS) {
    throw new Error(`Le fichier dépasse la limite de ${MAX_CATALOG_IMPORT_ROWS} lignes.`);
  }

  const existing = new Set(Array.from(existingNames, normalizedText));
  const namesInFile = new Set<string>();

  return dataRows.map((row, index) => {
    const read = (key: keyof CatalogImportItem) => {
      const column = headerIndexes.get(key);
      return column === undefined ? "" : row[column];
    };
    const name = String(read("name") ?? "").trim().slice(0, 200);
    const normalizedName = normalizedText(name);
    const price = parseNumber(read("unit_price"), 0);
    const tva = parseNumber(read("tva_rate"), 20);
    const rawUnit = normalizedText(read("unit")) || "unite";
    const unit = CATALOG_UNITS.find((candidate) => normalizedText(candidate) === rawUnit);
    const errors: string[] = [];

    if (!name) errors.push("Nom requis");
    if (normalizedName && existing.has(normalizedName)) errors.push("Déjà présent dans le catalogue");
    if (normalizedName && namesInFile.has(normalizedName)) errors.push("Doublon dans le fichier");
    if (!price.valid || price.value < 0) errors.push("Prix HT invalide");
    if (!tva.valid || !CATALOG_TVA_RATES.includes(tva.value as (typeof CATALOG_TVA_RATES)[number])) {
      errors.push("TVA autorisée : 0, 7, 10, 14 ou 20");
    }
    if (!unit) errors.push(`Unité invalide`);

    if (normalizedName) namesInFile.add(normalizedName);

    return {
      sourceRow: index + 2,
      name,
      description: optionalText(read("description"), 1_000),
      category: optionalText(read("category"), 200),
      unit: unit ?? String(read("unit") || "unité").trim(),
      unit_price: price.valid ? price.value : 0,
      tva_rate: tva.valid ? tva.value : 20,
      errors,
    };
  });
}
