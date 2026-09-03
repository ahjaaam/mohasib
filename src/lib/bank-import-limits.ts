export const BANK_STATEMENT_PDF_MAX_PAGES = 50;

export function countBankStatementPdfPages(bytes: ArrayBuffer | Uint8Array): number {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const text = new TextDecoder("latin1").decode(data);
  const countMatches = [...text.matchAll(/\/Count\s+(\d+)/g)];

  if (countMatches.length > 0) {
    return Math.max(...countMatches.map((match) => Number.parseInt(match[1], 10)));
  }

  return text.match(/\/Type\s*\/Page[^s]/g)?.length ?? 1;
}
