type Payload = Record<string, unknown>;
type SaveError = { code?: string; message: string };

// Older installations store these values only in the canonical payroll columns.
const legacyDefaults: Payload = {
  date_fin_contrat: null,
  mode_paiement: "virement",
  heures_travail_semaine: 44,
  jours_travail_semaine: 6,
  notes: null,
};
const aliases: Record<string, string> = {
  cnss_number: "numero_cnss",
  salaire_base: "salaire_brut",
  is_active: "statut",
};

export async function saveEmployeeWithSchemaCompatibility(
  payload: Payload,
  save: (value: Payload) => PromiseLike<{ error: SaveError | null }>,
): Promise<{ error: SaveError | null }> {
  const value = { ...payload };
  for (;;) {
    const result = await save({ ...value });
    if (!result.error || result.error.code !== "PGRST204") return result;
    const column = result.error.message.match(/Could not find the '([^']+)' column of 'employees'/)?.[1];
    if (!column || !Object.hasOwn(value, column)) return result;
    const alias = aliases[column];
    const safelyDuplicated = alias && Object.hasOwn(value, alias) && (
      column === "is_active" ? value[column] === (value[alias] === "actif") : value[column] === value[alias]
    );
    if (!safelyDuplicated && !(Object.hasOwn(legacyDefaults, column) && value[column] === legacyDefaults[column])) {
      return { error: { code: "PAYROLL_SCHEMA_REQUIRED", message: "La base de données doit être mise à jour pour enregistrer les champs de paie supplémentaires. Contactez votre administrateur (migration 027)." } };
    }
    delete value[column];
  }
}
