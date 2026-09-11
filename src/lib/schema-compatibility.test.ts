import { describe, expect, it } from "vitest";
import { isMissingDatabaseColumn, isUndefinedDatabaseColumn } from "./schema-compatibility";

describe("database schema compatibility", () => {
  it("recognizes PostgREST missing-column errors", () => {
    expect(isMissingDatabaseColumn({
      code: "PGRST204",
      message: "Could not find the 'tva_tax_point' column of 'companies' in the schema cache",
    }, "companies", "tva_tax_point")).toBe(true);
  });

  it("recognizes PostgreSQL undefined-column errors", () => {
    expect(isMissingDatabaseColumn({
      code: "42703",
      message: "column companies.tva_tax_point does not exist",
    }, "companies", "tva_tax_point")).toBe(true);
  });

  it("does not hide unrelated database errors", () => {
    expect(isMissingDatabaseColumn({
      code: "42501",
      message: "permission denied for table companies",
    }, "companies", "tva_tax_point")).toBe(false);
  });

  it("recognizes an unspecified missing column for a known table", () => {
    expect(isUndefinedDatabaseColumn({
      code: "42703",
      message: "column transactions.fournisseur does not exist",
    }, "transactions")).toBe(true);
  });
});
