import { describe, expect, it } from "vitest";
import {
  calculateAgentDueDate,
  calculateAgentInvoiceAmounts,
  matchAgentClient,
} from "./chat-agent";

describe("Mohasib chat agent invoice helpers", () => {
  const clients = [
    { id: "1", name: "Atlas Énergie SARL" },
    { id: "2", name: "Atlas Consulting" },
    { id: "3", name: "Nour & Fils" },
  ];

  it("matches a client without being sensitive to accents or case", () => {
    expect(matchAgentClient("atlas energie sarl", clients)).toEqual({
      status: "matched",
      client: clients[0],
    });
  });

  it("does not guess when several clients match", () => {
    const result = matchAgentClient("Atlas", clients);
    expect(result.status).toBe("ambiguous");
    if (result.status === "ambiguous") expect(result.clients).toHaveLength(2);
  });

  it("calculates an HT invoice", () => {
    expect(calculateAgentInvoiceAmounts(5_000, 20, "HT")).toEqual({
      subtotal: 5_000,
      taxAmount: 1_000,
      total: 6_000,
    });
  });

  it("calculates a TTC invoice", () => {
    expect(calculateAgentInvoiceAmounts(6_000, 20, "TTC")).toEqual({
      subtotal: 5_000,
      taxAmount: 1_000,
      total: 6_000,
    });
  });

  it("uses the configured payment delay", () => {
    expect(calculateAgentDueDate("2026-07-30", "30 jours")).toBe("2026-08-29");
    expect(calculateAgentDueDate("2026-07-30", "Immédiat")).toBe("2026-07-30");
  });
});
