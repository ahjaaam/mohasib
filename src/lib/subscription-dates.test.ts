import { describe, expect, it } from "vitest";
import { nextSubscriptionEnd } from "./subscription-dates";

describe("nextSubscriptionEnd", () => {
  it("keeps the calendar day for ordinary monthly renewals", () => {
    expect(nextSubscriptionEnd("monthly", new Date("2026-09-15T18:30:00Z"))).toBe("2026-10-15");
  });

  it("clamps monthly renewals at the target month end", () => {
    expect(nextSubscriptionEnd("monthly", new Date("2027-01-31T18:30:00Z"))).toBe("2027-02-28");
    expect(nextSubscriptionEnd("monthly", new Date("2028-01-31T18:30:00Z"))).toBe("2028-02-29");
  });

  it("preserves the UTC date for annual renewals", () => {
    expect(nextSubscriptionEnd("annual", new Date("2026-09-01T23:30:00Z"))).toBe("2027-09-01");
  });
});
