import { describe, expect, it } from "vitest";
import { DEFAULT_PLAN_LIMITS, featureForPath } from "./plan-features";

describe("plan feature matrix", () => {
  it("keeps Starter limited to the advertised core features", () => {
    const starter = DEFAULT_PLAN_LIMITS.starter;
    expect(starter.has_saisie).toBe(false);
    expect(starter.has_paie).toBe(false);
    expect(starter.has_bank_import).toBe(false);
    expect(starter.has_tva_edi).toBe(false);
    expect(starter.employee_limit).toBe(0);
  });

  it("matches Business and Business Pro advertised differences", () => {
    expect(DEFAULT_PLAN_LIMITS.business.employee_limit).toBe(10);
    expect(DEFAULT_PLAN_LIMITS.business.has_bilan).toBe(false);
    expect(DEFAULT_PLAN_LIMITS.business_pro.employee_limit).toBe(-1);
    expect(DEFAULT_PLAN_LIMITS.business_pro.has_bilan).toBe(true);
    expect(DEFAULT_PLAN_LIMITS.business_pro.users_limit).toBe(3);
  });

  it("maps protected main-account routes to their required feature", () => {
    expect(featureForPath("/saisie")).toBe("saisie");
    expect(featureForPath("/invoices/avoir/new")).toBe("avoirs");
    expect(featureForPath("/transactions/avoirs-fournisseurs/new")).toBe("avoirs");
  });
});
