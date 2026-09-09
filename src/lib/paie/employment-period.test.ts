import { describe, expect, it } from "vitest";
import { getEmployeePayrollEligibility, getPayrollPeriodBounds } from "./employment-period";

describe("payroll employment-period eligibility", () => {
  it("builds exact calendar-month boundaries", () => {
    expect(getPayrollPeriodBounds(2, 2026)).toEqual({ start: "2026-02-01", end: "2026-02-28" });
    expect(getPayrollPeriodBounds(2, 2028)).toEqual({ start: "2028-02-01", end: "2028-02-29" });
  });

  it("excludes an employee hired after the payroll month", () => {
    expect(getEmployeePayrollEligibility({ date_embauche: "2026-09-01", statut: "actif" }, 8, 2026))
      .toEqual({ eligible: false, reason: "hired_after_period" });
  });

  it("includes employment starting or ending during the payroll month", () => {
    expect(getEmployeePayrollEligibility({ date_embauche: "2026-08-31", statut: "actif" }, 8, 2026).eligible).toBe(true);
    expect(getEmployeePayrollEligibility({ date_embauche: "2024-01-01", date_fin_contrat: "2026-08-01", statut: "inactif" }, 8, 2026).eligible).toBe(true);
  });

  it("excludes a contract that ended before the payroll month", () => {
    expect(getEmployeePayrollEligibility({ date_embauche: "2024-01-01", date_fin_contrat: "2026-07-31" }, 8, 2026))
      .toEqual({ eligible: false, reason: "contract_ended_before_period" });
  });

  it("excludes incomplete inactive records", () => {
    expect(getEmployeePayrollEligibility({ date_embauche: "2024-01-01", statut: "inactif" }, 8, 2026))
      .toEqual({ eligible: false, reason: "inactive_without_end_date" });
  });
});
