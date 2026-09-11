import { describe, expect, it } from "vitest";
import {
  calculateAnnualFamilyDeduction,
  calculateAnnualIncomeTax,
  calculateSalary,
  getPayrollRules,
  UnsupportedPayrollYearError,
} from "./payroll";

describe("calculateAnnualIncomeTax", () => {
  it.each([
    [0, 0],
    [40000, 0],
    [60000, 2000],
    [80000, 6000],
    [100000, 12000],
    [180000, 39200],
    [200000, 46600],
  ])("calculates the current IR schedule for %s MAD", (income, expected) => {
    expect(calculateAnnualIncomeTax(income)).toBe(expected);
  });
});

describe("calculateAnnualFamilyDeduction", () => {
  it("uses the effective-dated family reduction", () => {
    expect(calculateAnnualFamilyDeduction("Célibataire", 2, 2025)).toBe(1000);
    expect(calculateAnnualFamilyDeduction("Célibataire", 2, 2026)).toBe(1200);
  });

  it("counts a spouse while capping all dependants at six", () => {
    expect(calculateAnnualFamilyDeduction("Marié(e)", 2, 2026)).toBe(1800);
    expect(calculateAnnualFamilyDeduction("Marié(e)", 6, 2026)).toBe(3600);
  });
});

describe("calculateSalary", () => {
  it("applies the current brackets and family deduction to a payslip", () => {
    const result = calculateSalary({
      salaire_brut: 10000,
      situation_familiale: "Marié(e)",
      nombre_enfants: 2,
    });

    expect(result.cnss_salarie).toBe(268.8);
    expect(result.amo_salarie).toBe(226);
    expect(result.deduction_charge_famille).toBe(150);
    expect(result.amo_patronal).toBe(411);
    expect(result.cnss_patronal).toBe(1178.8);
  });

  it("includes overtime, premiums, allowances, and absence deductions", () => {
    const result = calculateSalary({
      salaire_brut: 5000,
      situation_familiale: "Célibataire",
      nombre_enfants: 0,
      heures_sup: 500,
      primes: 300,
      indemnites: 200,
      retenue_absence: 400,
      elements_imposables: 300,
      elements_soumis_cnss: 100,
    });

    expect(result.salaire_base).toBe(5000);
    expect(result.salaire_brut).toBe(5600);
    expect(result.base_cnss).toBe(5200);
    expect(result.salaire_net_imposable).toBe(3159.52);
    expect(result.salaire_net_payer).toBeGreaterThan(5000);
  });

  it("applies employee and employer benefit contributions", () => {
    const result = calculateSalary({
      salaire_brut: 10000,
      situation_familiale: "Célibataire",
      nombre_enfants: 0,
      has_mutuelle: true,
      mutuelle_taux_salarie: 2,
      mutuelle_taux_patronal: 3,
      has_cimr: true,
      cimr_taux_salarie: 3,
      cimr_taux_patronal: 4,
    });
    expect(result.mutuelle_salarie).toBe(200);
    expect(result.cimr_salarie).toBe(300);
    expect(result.mutuelle_patronal).toBe(300);
    expect(result.cimr_patronal).toBe(400);
  });

  it("matches the 2026 capped and uncapped social-contribution branches", () => {
    const result = calculateSalary({ salaire_brut: 15000, situation_familiale: "Célibataire", nombre_enfants: 0, mois: 9, annee: 2026 });
    expect(result.cnss_salarie).toBe(268.8);
    expect(result.amo_salarie).toBe(339);
    expect(result.cnss_patronal).toBe(1498.8);
    expect(result.amo_patronal).toBe(616.5);
    expect(result.taxe_formation_pro).toBe(240);
  });

  it("reconciles gross salary and employer charges to payroll liabilities", () => {
    const result = calculateSalary({ salaire_brut: 12000, situation_familiale: "Marié(e)", nombre_enfants: 2, has_cimr: true, cimr_taux_salarie: 3, cimr_taux_patronal: 3.9 });
    const debit = result.salaire_brut + result.cnss_patronal + result.amo_patronal + result.taxe_formation_pro + result.mutuelle_patronal + result.cimr_patronal;
    const credit = result.salaire_net_payer + result.ir_net + result.cnss_salarie + result.amo_salarie + result.mutuelle_salarie + result.cimr_salarie + result.cnss_patronal + result.amo_patronal + result.taxe_formation_pro + result.mutuelle_patronal + result.cimr_patronal;
    expect(Math.round((debit - credit) * 100)).toBe(0);
  });

  it("prorates a partial employment month", () => {
    const full = calculateSalary({ salaire_brut: 10000, situation_familiale: "Célibataire", nombre_enfants: 0, mois: 9, annee: 2026, date_embauche: "2020-01-01" });
    const partial = calculateSalary({ salaire_brut: 10000, situation_familiale: "Célibataire", nombre_enfants: 0, mois: 9, annee: 2026, date_embauche: "2026-09-30" });
    expect(full.salaire_base).toBe(10000);
    expect(partial.salaire_base).toBeGreaterThan(0);
    expect(partial.salaire_base).toBeLessThan(10000);
  });

  it("pays a non-taxable, non-contributory allowance in full", () => {
    const base = calculateSalary({
      salaire_brut: 5000,
      situation_familiale: "Célibataire",
      nombre_enfants: 0,
    });
    const withAllowance = calculateSalary({
      salaire_brut: 5000,
      situation_familiale: "Célibataire",
      nombre_enfants: 0,
      indemnites: 250,
      elements_imposables: 0,
      elements_soumis_cnss: 0,
    });

    expect(withAllowance.salaire_net_payer - base.salaire_net_payer).toBe(250);
  });

  it("applies the statutory AMO solidarity-only regime", () => {
    const result = calculateSalary({
      salaire_brut: 10_000,
      situation_familiale: "Célibataire",
      nombre_enfants: 0,
      mois: 9,
      annee: 2026,
      amo_regime: "solidarity_only",
    });
    expect(result.amo_salarie).toBe(0);
    expect(result.amo_patronal).toBe(185);
  });

  it("does not assess vocational-training tax for an exempt employer", () => {
    const result = calculateSalary({
      salaire_brut: 10_000,
      situation_familiale: "Célibataire",
      nombre_enfants: 0,
      mois: 9,
      annee: 2026,
      tfp_exempt: true,
    });
    expect(result.taxe_formation_pro).toBe(0);
  });
});

describe("effective-dated payroll rules", () => {
  it("selects an explicit rule set for every supported year", () => {
    expect(getPayrollRules(2025).familyDeductionPerDependant).toBe(500);
    expect(getPayrollRules(2026).familyDeductionPerDependant).toBe(600);
  });

  it("refuses periods for which statutory rules have not been encoded", () => {
    expect(() => getPayrollRules(2024)).toThrow(UnsupportedPayrollYearError);
    expect(() => calculateSalary({ salaire_brut: 5_000, situation_familiale: "Célibataire", nombre_enfants: 0, annee: 2027 })).toThrow(/indisponibles/);
  });
});
