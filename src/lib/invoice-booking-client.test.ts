import { afterEach, describe, expect, it, vi } from "vitest";
import { finalizeDraftCreditNote } from "./invoice-booking-client";

describe("finalizeDraftCreditNote", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("requests atomic draft finalization", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", fetchMock);

    await finalizeDraftCreditNote("credit-1", "dossier-1");

    expect(fetchMock).toHaveBeenCalledWith("/api/accounting/book", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        type: "avoir",
        invoiceId: "credit-1",
        dossierId: "dossier-1",
        finalizeDraft: true,
      }),
    }));
  });

  it("surfaces booking failures instead of claiming success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ message: "La période comptable est verrouillée" }),
    }));

    await expect(finalizeDraftCreditNote("credit-1")).rejects.toThrow("La période comptable est verrouillée");
  });
});
