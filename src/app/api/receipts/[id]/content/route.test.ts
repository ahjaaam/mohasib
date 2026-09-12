import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  authorizePermission: vi.fn(),
  createAdminClient: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/api-permissions", () => ({ authorizePermission: mocks.authorizePermission }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import { GET } from "./route";

describe("receipt content", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorizePermission.mockResolvedValue({ response: null });
  });

  it("streams the receipt from the same-origin route for inline previews", async () => {
    const receipt = {
      id: "receipt-id",
      dossier_id: null,
      storage_path: "owner/invoice.pdf",
      file_name: "invoice.pdf",
      mime_type: "application/pdf",
    };
    const receiptQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: receipt }),
    };
    mocks.createClient.mockResolvedValue({ from: vi.fn(() => receiptQuery) });

    const download = vi.fn().mockResolvedValue({
      data: new Blob(["pdf bytes"], { type: "application/pdf" }),
      error: null,
    });
    mocks.createAdminClient.mockReturnValue({
      storage: { from: vi.fn(() => ({ download })) },
    });

    const response = await GET(
      new NextRequest("https://app.mohasibai.com/api/receipts/receipt-id/content"),
      { params: Promise.resolve({ id: "receipt-id" }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toBe('inline; filename="invoice.pdf"');
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.text()).toBe("pdf bytes");
    expect(download).toHaveBeenCalledWith(receipt.storage_path);
    expect(mocks.authorizePermission).toHaveBeenCalledWith("document", "read", { dossierId: null });
  });
});
