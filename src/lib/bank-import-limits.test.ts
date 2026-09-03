import { describe, expect, it } from "vitest";
import { BANK_STATEMENT_PDF_MAX_PAGES, countBankStatementPdfPages } from "./bank-import-limits";

const bytes = (value: string) => new TextEncoder().encode(value);

describe("bank statement PDF limits", () => {
  it("allows up to 50 pages", () => {
    expect(BANK_STATEMENT_PDF_MAX_PAGES).toBe(50);
  });

  it("uses the highest PDF page-tree count", () => {
    expect(countBankStatementPdfPages(bytes("/Count 12 /Count 50"))).toBe(50);
  });

  it("falls back to counting page objects", () => {
    expect(countBankStatementPdfPages(bytes("/Type /Page\n/Type /Page\n/Type /Pages"))).toBe(2);
  });
});
