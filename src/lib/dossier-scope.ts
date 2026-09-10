export type ParsedDossierScope = {
  valid: boolean;
  value: string[] | null;
};

// null means access to every dossier; a non-empty array is an explicit allowlist.
export function parseDossierScope(value: unknown): ParsedDossierScope {
  if (value == null) return { valid: true, value: null };
  if (!Array.isArray(value) || value.some(id => typeof id !== "string" || !id)) {
    return { valid: false, value: null };
  }
  return { valid: value.length > 0, value: [...new Set(value)] };
}

export function dossierScopeAllows(scope: string[] | null | undefined, dossierId: string) {
  return !scope?.length || scope.includes(dossierId);
}
