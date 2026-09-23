import { afterEach, describe, expect, it, vi } from "vitest";
import { finalizeSupplierCreditNote } from "./supplier-credit-note-booking-client";

describe("finalizeSupplierCreditNote", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("requests the dedicated atomic booking path", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", fetchMock);

    await finalizeSupplierCreditNote("supplier-credit-1", "dossier-1");

    expect(fetchMock).toHaveBeenCalledWith("/api/accounting/book", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        type: "supplier_credit_note",
        creditNoteId: "supplier-credit-1",
        dossierId: "dossier-1",
      }),
    }));
  });

  it("surfaces booking failures so callers cannot mark the source document processed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ message: "La période comptable est verrouillée" }),
    }));

    await expect(finalizeSupplierCreditNote("supplier-credit-1")).rejects.toThrow("La période comptable est verrouillée");
  });
});
