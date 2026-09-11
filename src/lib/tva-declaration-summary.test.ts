import { describe, expect, it } from "vitest";
import {
  normalizeVatDeclarationStatus,
  resolveVatDeclarationStatus,
  vatDeclarationPeriod,
  vatDeclarationStatusLabel,
} from "./tva-declaration-summary";

describe("vatDeclarationPeriod", () => {
  it("builds a monthly period and its following-month deadline", () => {
    expect(vatDeclarationPeriod("Mensuel", "2026-09-11")).toEqual({
      periodStart: "2026-09-01",
      periodEnd: "2026-09-30",
      periodLabel: "Septembre 2026",
      deadline: "2026-10-20",
      queryPeriod: "2026-09",
    });
  });

  it("builds a quarterly period and handles the year-end deadline", () => {
    expect(vatDeclarationPeriod("Trimestriel", "2026-12-05")).toEqual({
      periodStart: "2026-10-01",
      periodEnd: "2026-12-31",
      periodLabel: "T4 2026",
      deadline: "2027-01-20",
      queryPeriod: "2026-10",
    });
  });
});

describe("VAT declaration lifecycle", () => {
  it.each([
    ["brouillon", "draft"],
    ["pending", "draft"],
    ["validé", "validated"],
    ["validated", "validated"],
    ["déposé", "filed"],
    ["déclarée", "filed"],
    ["filed", "filed"],
    [null, "not_started"],
  ] as const)("normalizes %s to %s", (value, expected) => {
    expect(normalizeVatDeclarationStatus(value)).toBe(expected);
  });

  it("provides the consumer-facing labels", () => {
    expect(vatDeclarationStatusLabel("not_started")).toBe("À préparer");
    expect(vatDeclarationStatusLabel("draft")).toBe("Brouillon");
    expect(vatDeclarationStatusLabel("validated")).toBe("Validée");
    expect(vatDeclarationStatusLabel("filed")).toBe("Déposée");
  });

  it("prefers the most advanced state when legacy fields disagree", () => {
    expect(resolveVatDeclarationStatus("brouillon", "filed")).toBe("filed");
    expect(resolveVatDeclarationStatus("validé", "pending")).toBe("validated");
    expect(resolveVatDeclarationStatus(null, null)).toBe("not_started");
  });
});
