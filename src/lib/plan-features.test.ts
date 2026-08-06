import { describe, expect, it } from "vitest";
import { DEFAULT_PLAN_LIMITS, featureForPath, isRouteAvailableForPlan } from "./plan-features";

describe("plan feature matrix", () => {
  it("keeps Starter limited to the advertised core features", () => {
    const starter = DEFAULT_PLAN_LIMITS.starter;
    expect(starter.has_saisie).toBe(false);
    expect(starter.has_paie).toBe(false);
    expect(starter.has_bank_import).toBe(false);
    expect(starter.has_tva_edi).toBe(false);
    expect(starter.employee_limit).toBe(0);
  });

  it("keeps the permanent free plan focused on invoicing and clients", () => {
    const free = DEFAULT_PLAN_LIMITS.free;
    expect(free.ocr_limit).toBe(0);
    expect(free.has_bank_import).toBe(false);
    expect(free.has_paie).toBe(false);
    expect(free.has_avoirs).toBe(true);

    expect(isRouteAvailableForPlan("free", "/invoices/new")).toBe(true);
    expect(isRouteAvailableForPlan("free", "/clients")).toBe(true);
    expect(isRouteAvailableForPlan("free", "/suivi-paiements")).toBe(false);
    expect(isRouteAvailableForPlan("free", "/settings")).toBe(true);
    expect(isRouteAvailableForPlan("free", "/transactions")).toBe(false);
    expect(isRouteAvailableForPlan("free", "/archive")).toBe(false);
    expect(isRouteAvailableForPlan("business", "/transactions")).toBe(true);
  });

  it("matches Business and Business Pro advertised differences", () => {
    expect(DEFAULT_PLAN_LIMITS.business.employee_limit).toBe(10);
    expect(DEFAULT_PLAN_LIMITS.business.has_bilan).toBe(false);
    expect(DEFAULT_PLAN_LIMITS.business_pro.employee_limit).toBe(-1);
    expect(DEFAULT_PLAN_LIMITS.business_pro.has_bilan).toBe(true);
    expect(DEFAULT_PLAN_LIMITS.business_pro.users_limit).toBe(3);
  });

  it("gives newly activated custom accounts full access by default", () => {
    const custom = DEFAULT_PLAN_LIMITS.custom;
    expect(custom.has_paie).toBe(true);
    expect(custom.has_saisie).toBe(true);
    expect(custom.has_bank_import).toBe(true);
    expect(custom.has_export_fiduciaire).toBe(true);
    expect(custom.has_bilan).toBe(true);
    expect(custom.employee_limit).toBe(-1);
  });

  it("maps protected main-account routes to their required feature", () => {
    expect(featureForPath("/saisie")).toBe("saisie");
    expect(featureForPath("/invoices/avoir/new")).toBe("avoirs");
    expect(featureForPath("/transactions/avoirs-fournisseurs/new")).toBe("avoirs");
  });
});
