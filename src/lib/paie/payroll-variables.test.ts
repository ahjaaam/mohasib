import { describe, expect, it } from "vitest";
import {
  aggregatePayrollVariables,
  recalculatePayrollVariableAmounts,
  isAllowanceType,
  payrollBulletinDetailFields,
  monthlyLeaveImpact,
} from "./payroll-variables";

describe("payroll variable aggregation", () => {
  it("does not double deduct an absence represented in hours and leave", () => {
    const result = aggregatePayrollVariables(
      ["e1"],
      [{ employee_id: "e1", montant_absence_deduit: 400 }],
      [],
      [{ employee_id: "e1", date_debut: "2026-09-01", date_fin: "2026-09-02", impact_salaire: 300 }],
      { mois: 9, annee: 2026 },
    );
    expect(result.get("e1")?.montant_absence_deduit).toBe(400);
  });

  it("recalculates overtime from the salary current at generation time", () => {
    const base = aggregatePayrollVariables(["e1"], [{ employee_id: "e1", heures_theoriques: 200, heures_sup_25: 10, montant_heures_sup: 1 }], []);
    expect(recalculatePayrollVariableAmounts(base.get("e1")!, 4000).montant_heures_sup).toBe(250);
  });
  it("classifies allowance labels with or without accents", () => {
    expect(isAllowanceType("indemnité_transport")).toBe(true);
    expect(isAllowanceType("INDEMNITE_REPAS")).toBe(true);
    expect(isAllowanceType("prime_performance")).toBe(false);
  });

  it("combines period hours, absences, premiums, and allowances by employee", () => {
    const result = aggregatePayrollVariables(
      ["employee-1"],
      [{
        employee_id: "employee-1",
        heures_sup_25: 4,
        heures_sup_50: 2,
        heures_sup_100: 1,
        heures_absence: 8,
        montant_heures_sup: 450,
        montant_absence_deduit: 300,
      }],
      [
        { employee_id: "employee-1", prime_type: "prime", montant: 500, is_imposable: true, is_soumis_cnss: true },
        { employee_id: "employee-1", prime_type: "indemnité_transport", montant: 200, is_imposable: false, is_soumis_cnss: false },
      ],
    ).get("employee-1");

    expect(result).toMatchObject({
      heures_sup_25: 4,
      heures_sup_50: 2,
      heures_sup_100: 1,
      heures_absence: 8,
      montant_heures_sup: 450,
      montant_absence_deduit: 300,
      primes: 500,
      indemnites: 200,
      elements_imposables: 500,
      elements_soumis_cnss: 500,
    });
  });

  it("keeps detailed overtime amounts reconciled to the saved total", () => {
    const variables = aggregatePayrollVariables(
      ["employee-1"],
      [{
        employee_id: "employee-1",
        heures_sup_25: 2,
        heures_sup_50: 1,
        montant_heures_sup: 400,
      }],
      [],
    ).get("employee-1")!;
    const fields = payrollBulletinDetailFields(variables, {
      salaire_base: 5000,
      retenue_absence: 0,
      base_cnss: 5400,
      salaire_net_imposable: 4000,
      deduction_charge_famille: 0,
      salaire_net_payer: 5000,
      cout_total_employeur: 6500,
    });

    expect(fields.montant_sup_25 + fields.montant_sup_50 + fields.montant_sup_100).toBe(400);
  });

  it("allocates a multi-month unpaid leave deduction to the selected month", () => {
    const leave = {
      employee_id: "employee-1",
      date_debut: "2026-01-30",
      date_fin: "2026-02-03",
      nombre_jours: 4,
      impact_salaire: 400,
    };

    expect(monthlyLeaveImpact(leave, 1, 2026)).toBe(200);
    expect(monthlyLeaveImpact(leave, 2, 2026)).toBe(200);
  });
});
