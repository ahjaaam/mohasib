const PENDING_BANK_STATEMENTS_KEY = "__mohasibPendingBankStatements";

type PendingBankStatementGlobal = typeof globalThis & {
  [PENDING_BANK_STATEMENTS_KEY]?: Map<string, File>;
};

/**
 * Keep the handoff on the browser global instead of in module scope. Next can
 * load the top bar and the destination page from different route chunks; each
 * chunk may evaluate this module independently even though both run in the
 * same window.
 */
function getPendingBankStatements() {
  const scope = globalThis as PendingBankStatementGlobal;
  scope[PENDING_BANK_STATEMENTS_KEY] ??= new Map<string, File>();
  return scope[PENDING_BANK_STATEMENTS_KEY];
}

export function stagePendingBankStatement(file: File): string {
  const token = crypto.randomUUID();
  getPendingBankStatements().set(token, file);
  return token;
}

export function peekPendingBankStatement(token: string): File | null {
  return getPendingBankStatements().get(token) ?? null;
}

export function takePendingBankStatement(token: string): File | null {
  const pendingBankStatements = getPendingBankStatements();
  const file = pendingBankStatements.get(token) ?? null;
  pendingBankStatements.delete(token);
  return file;
}
