import { PDFDocument } from "pdf-lib";

export const BANK_STATEMENT_PDF_CHUNK_PAGES = 4;
export const BANK_STATEMENT_PDF_CONCURRENCY = 3;
export const CLAUDE_SONNET_46_INPUT_USD_PER_MILLION = 3;
export const CLAUDE_SONNET_46_OUTPUT_USD_PER_MILLION = 15;

export type BankStatementPdfChunk = {
  bytes: Uint8Array;
  startPage: number;
  endPage: number;
};

export type BankStatementTokenUsage = {
  inputTokens: number;
  outputTokens: number;
};

export function addTokenUsage(...items: BankStatementTokenUsage[]): BankStatementTokenUsage {
  return items.reduce((total, item) => ({
    inputTokens: total.inputTokens + item.inputTokens,
    outputTokens: total.outputTokens + item.outputTokens,
  }), { inputTokens: 0, outputTokens: 0 });
}

export function estimateSonnet46CostUsd(usage: BankStatementTokenUsage): number {
  return (
    usage.inputTokens * CLAUDE_SONNET_46_INPUT_USD_PER_MILLION
    + usage.outputTokens * CLAUDE_SONNET_46_OUTPUT_USD_PER_MILLION
  ) / 1_000_000;
}

export async function splitBankStatementPdf(
  bytes: ArrayBuffer | Uint8Array,
  pagesPerChunk = BANK_STATEMENT_PDF_CHUNK_PAGES,
  pageOffset = 0,
): Promise<BankStatementPdfChunk[]> {
  if (!Number.isInteger(pagesPerChunk) || pagesPerChunk < 1) {
    throw new Error("pagesPerChunk must be a positive integer");
  }

  const source = await PDFDocument.load(bytes);
  const pageCount = source.getPageCount();
  const chunks: BankStatementPdfChunk[] = [];

  for (let startIndex = 0; startIndex < pageCount; startIndex += pagesPerChunk) {
    const endIndex = Math.min(startIndex + pagesPerChunk, pageCount);
    const chunkDocument = await PDFDocument.create();
    const pageIndexes = Array.from(
      { length: endIndex - startIndex },
      (_, index) => startIndex + index,
    );
    const copiedPages = await chunkDocument.copyPages(source, pageIndexes);
    for (const page of copiedPages) chunkDocument.addPage(page);

    chunks.push({
      bytes: await chunkDocument.save(),
      startPage: pageOffset + startIndex + 1,
      endPage: pageOffset + endIndex,
    });
  }

  return chunks;
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error("concurrency must be a positive integer");
  }

  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
}
