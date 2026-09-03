import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import {
  addTokenUsage,
  estimateSonnet46CostUsd,
  mapWithConcurrency,
  splitBankStatementPdf,
} from "./bank-statement-chunks";

async function pdfWithPages(pageCount: number) {
  const document = await PDFDocument.create();
  for (let index = 0; index < pageCount; index++) {
    document.addPage([200 + index, 300 + index]);
  }
  return document.save();
}

describe("bank statement PDF chunks", () => {
  it("calculates Sonnet 4.6 usage cost from separate input and output totals", () => {
    const usage = addTokenUsage(
      { inputTokens: 300_000, outputTokens: 20_000 },
      { inputTokens: 150_000, outputTokens: 30_000 },
    );
    expect(usage).toEqual({ inputTokens: 450_000, outputTokens: 50_000 });
    expect(estimateSonnet46CostUsd(usage)).toBeCloseTo(2.1, 6);
  });

  it("splits a nine-page statement into stable four-page chunks", async () => {
    const chunks = await splitBankStatementPdf(await pdfWithPages(9), 4);

    expect(chunks.map(({ startPage, endPage }) => [startPage, endPage])).toEqual([
      [1, 4],
      [5, 8],
      [9, 9],
    ]);

    const pageCounts = await Promise.all(chunks.map(async chunk => (
      await PDFDocument.load(chunk.bytes)
    ).getPageCount()));
    expect(pageCounts).toEqual([4, 4, 1]);
  });

  it("preserves the absolute page offset when recursively splitting a chunk", async () => {
    const chunks = await splitBankStatementPdf(await pdfWithPages(4), 2, 4);
    expect(chunks.map(({ startPage, endPage }) => [startPage, endPage])).toEqual([
      [5, 6],
      [7, 8],
    ]);
  });

  it("keeps result order while limiting concurrent work", async () => {
    let active = 0;
    let peak = 0;
    const results = await mapWithConcurrency([30, 5, 15, 1], 2, async (delay, index) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise(resolve => setTimeout(resolve, delay));
      active--;
      return index;
    });

    expect(results).toEqual([0, 1, 2, 3]);
    expect(peak).toBe(2);
  });
});
