const pendingBankStatements = new Map<string, File>();

export function stagePendingBankStatement(file: File): string {
  const token = crypto.randomUUID();
  pendingBankStatements.set(token, file);
  return token;
}

export function takePendingBankStatement(token: string): File | null {
  const file = pendingBankStatements.get(token) ?? null;
  pendingBankStatements.delete(token);
  return file;
}
