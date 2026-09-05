import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  authorizePermission: vi.fn(),
  createAdminClient: vi.fn(),
  createClient: vi.fn(),
  driveClientForConnection: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/api-permissions", () => ({ authorizePermission: mocks.authorizePermission }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/google-drive", () => ({ driveClientForConnection: mocks.driveClientForConnection }));

import { GET } from "./route";

describe("archive document content", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorizePermission.mockResolvedValue({ response: null });
  });

  it("streams Supabase files from the same-origin route instead of redirecting to a signed URL", async () => {
    const document = {
      id: "document-id",
      dossier_id: null,
      storage_path: "owner/main/document.pdf",
      storage_provider: "supabase",
      external_file_id: null,
      file_name: "invoice.pdf",
      mime_type: "application/pdf",
      archive_id: null,
    };
    const documentQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: document }),
    };
    mocks.createClient.mockResolvedValue({ from: vi.fn(() => documentQuery) });

    const download = vi.fn().mockResolvedValue({
      data: new Blob(["pdf bytes"], { type: "application/pdf" }),
      error: null,
    });
    mocks.createAdminClient.mockReturnValue({
      storage: { from: vi.fn(() => ({ download })) },
    });

    const response = await GET(
      new NextRequest("https://app.mohasibai.com/api/archive/documents/document-id/content"),
      { params: Promise.resolve({ id: "document-id" }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toBe('inline; filename="invoice.pdf"');
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.text()).toBe("pdf bytes");
    expect(download).toHaveBeenCalledWith(document.storage_path);
  });
});
