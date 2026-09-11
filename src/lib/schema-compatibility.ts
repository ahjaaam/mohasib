type DatabaseError = { code?: string | null; message?: string | null } | null | undefined;

/** Keep deployment compatibility fallbacks narrow so unrelated errors remain visible. */
export function isUndefinedDatabaseColumn(error: DatabaseError, table: string) {
  if (!error || !["PGRST204", "42703"].includes(String(error.code ?? ""))) return false;
  const message = String(error.message ?? "").toLowerCase();
  return message.includes(table.toLowerCase()) && (
    message.includes("schema cache")
    || message.includes("does not exist")
    || message.includes("could not find")
  );
}

export function isMissingDatabaseColumn(error: DatabaseError, table: string, column: string) {
  const message = String(error.message ?? "").toLowerCase();
  return isUndefinedDatabaseColumn(error, table) && message.includes(column.toLowerCase());
}
