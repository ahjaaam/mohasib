import { describe, expect, it } from "vitest";
import { analyzeCustomerPaymentBehavior, buildTreasurySnapshot, detectRecurringExpenses, prioritizeReceivables } from "./treasury";

describe("buildTreasurySnapshot", () => {
  it("combines recorded movements and outstanding commercial flows", () => {
    const result = buildTreasurySnapshot({
      today: "2026-08-18",
      horizonDays: 30,
      transactions: [
        { date: "2026-08-01", type: "income", amount: 10000 },
        { date: "2026-08-02", type: "expense", amount: 2500 },
        { date: "2026-09-30", type: "income", amount: 9999 },
      ],
      invoices: [{ id: "i1", invoice_number: "F-1", issue_date: "2026-08-01", due_date: "2026-08-25", total: 5000, montant_recu: 1000, status: "partiellement_payee", clients: { name: "Atlas" } }],
      suppliers: [{ id: "s1", ocr_data: { due_date: "2026-08-28", amount_ttc: 1800, montant_paye: 300, vendor_name: "Acme" } }],
    });

    expect(result.position).toBe(7500);
    expect(result.expectedInflows).toBe(4000);
    expect(result.expectedOutflows).toBe(1500);
    expect(result.projectedPosition).toBe(10000);
  });

  it("moves overdue flows to today while retaining their alert state", () => {
    const result = buildTreasurySnapshot({
      today: "2026-08-18",
      transactions: [],
      invoices: [{ id: "i1", invoice_number: "F-1", issue_date: "2026-07-01", due_date: "2026-07-31", total: 1000, status: "overdue" }],
      suppliers: [],
    });

    expect(result.flows[0]).toMatchObject({ date: "2026-08-18", overdue: true, amount: 1000 });
    expect(result.overdueCount).toBe(1);
  });

  it("detects stable recurring expenses and repeats them through the forecast", () => {
    const transactions = [
      { date: "2026-05-05", type: "expense", amount: 500, description: "Abonnement logiciel 05", category: "Logiciels" },
      { date: "2026-06-05", type: "expense", amount: 520, description: "Abonnement logiciel 06", category: "Logiciels" },
      { date: "2026-07-05", type: "expense", amount: 510, description: "Abonnement logiciel 07", category: "Logiciels" },
      { date: "2026-08-05", type: "expense", amount: 500, description: "Abonnement logiciel 08", category: "Logiciels" },
    ];
    const recurring = detectRecurringExpenses(transactions, "2026-08-18");
    const result = buildTreasurySnapshot({ today: "2026-08-18", horizonDays: 90, transactions, invoices: [], suppliers: [], recurringExpenses: recurring });

    expect(recurring).toHaveLength(1);
    expect(recurring[0]).toMatchObject({ occurrences: 4, confidence: "high" });
    expect(result.flows.filter((flow) => flow.source === "recurring")).toHaveLength(3);
  });

  it("predicts customer delay and prioritizes risky overdue receivables", () => {
    const invoices = [
      { id: "paid-1", client_id: "c1", invoice_number: "F-1", issue_date: "2026-05-01", due_date: "2026-05-31", total: 1000, status: "paid", paiements: [{ date: "2026-06-25", montant: 1000 }], clients: { name: "Atlas" } },
      { id: "open-1", client_id: "c1", invoice_number: "F-2", issue_date: "2026-06-01", due_date: "2026-06-30", total: 12000, status: "overdue", clients: { name: "Atlas" } },
    ];
    const behavior = analyzeCustomerPaymentBehavior(invoices);
    const recommendations = prioritizeReceivables(invoices, behavior, "2026-08-18");

    expect(behavior[0]).toMatchObject({ averageDelayDays: 25, risk: "high" });
    expect(recommendations[0]).toMatchObject({ invoiceId: "open-1", priority: "critical" });
  });
});
