import { describe, expect, it } from "vitest";
import { parseGlobalPeriod, periodForPreset } from "./global-period";

describe("periodForPreset", () => {
  const now = new Date(2026, 7, 10);

  it("builds the current year range", () => {
    expect(periodForPreset("this_year", now)).toEqual({ preset: "this_year", start: "2026-01-01", end: "2026-12-31" });
  });

  it("handles a previous month in the prior year", () => {
    expect(periodForPreset("previous_month", new Date(2026, 0, 5))).toEqual({ preset: "previous_month", start: "2025-12-01", end: "2025-12-31" });
  });

  it("builds the current quarter range", () => {
    expect(periodForPreset("this_quarter", now)).toEqual({ preset: "this_quarter", start: "2026-07-01", end: "2026-09-30" });
  });

  it("reads the encoded period stored in the session cookie", () => {
    const value = encodeURIComponent(JSON.stringify({ preset: "this_year", start: "2026-01-01", end: "2026-12-31" }));
    expect(parseGlobalPeriod(value)).toEqual({ preset: "this_year", start: "2026-01-01", end: "2026-12-31" });
  });
});
