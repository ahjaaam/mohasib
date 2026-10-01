import { afterEach, describe, expect, it, vi } from "vitest";

const STORE_KEY = "__mohasibPendingBankStatements";

afterEach(() => {
  delete (globalThis as typeof globalThis & Record<string, unknown>)[STORE_KEY];
  vi.resetModules();
});

describe("pending bank statement handoff", () => {
  it("survives independent module evaluation during route navigation", async () => {
    const sourceModule = await import("./pending-bank-statement");
    const file = new File(["statement"], "statement.pdf", { type: "application/pdf" });
    const token = sourceModule.stagePendingBankStatement(file);

    vi.resetModules();
    const destinationModule = await import("./pending-bank-statement");

    expect(destinationModule.peekPendingBankStatement(token)).toBe(file);
    expect(destinationModule.peekPendingBankStatement(token)).toBe(file);
    expect(destinationModule.takePendingBankStatement(token)).toBe(file);
    expect(destinationModule.takePendingBankStatement(token)).toBeNull();
  });
});
