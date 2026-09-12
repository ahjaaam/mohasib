import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  authorizePermission: vi.fn(),
  createAdminClient: vi.fn(),
  driveClientForConnection: vi.fn(),
  resolveAccountOwnerId: vi.fn(),
  uploadDriveFile: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/api-permissions", () => ({ authorizePermission: mocks.authorizePermission }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/account-owner", () => ({ resolveAccountOwnerId: mocks.resolveAccountOwnerId }));
vi.mock("@/lib/google-drive", () => ({
  driveClientForConnection: mocks.driveClientForConnection,
  uploadDriveFile: mocks.uploadDriveFile,
}));

import { POST } from "./route";

describe("archive document upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorizePermission.mockResolvedValue({ response: null, user: { id: "user-id" } });
    mocks.resolveAccountOwnerId.mockResolvedValue("owner-id");
  });

  it("automatically uploads to the connected Google Drive folder", async () => {
    const connection = {
      id: "connection-id",
      token_encrypted: "encrypted-token",
      root_folder_id: "mohasib-folder-id",
    };
    const connectionQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: connection }),
    };
    const insertedDocument = {
      id: "document-id",
      name: "Contrat — contract.pdf",
      document_category: "Contrat",
      file_name: "contract.pdf",
      mime_type: "application/pdf",
      expiration_date: null,
      notes: null,
      created_at: "2026-09-12T00:00:00.000Z",
      archive_id: null,
      storage_provider: "google_drive",
    };
    const documentQuery = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: insertedDocument, error: null }),
    };
    const storageUpload = vi.fn();
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn((table: string) => table === "google_drive_connections" ? connectionQuery : documentQuery),
      storage: { from: vi.fn(() => ({ upload: storageUpload })) },
    });
    const drive = { files: { delete: vi.fn() } };
    mocks.driveClientForConnection.mockResolvedValue(drive);
    mocks.uploadDriveFile.mockResolvedValue({
      id: "drive-file-id",
      webViewLink: "https://drive.google.com/file/drive-file-id/view",
    });

    const form = new FormData();
    form.set("file", new File(["pdf bytes"], "contract.pdf", { type: "application/pdf" }));
    form.set("category", "Contrat");
    const response = await POST(new NextRequest("https://app.mohasibai.com/api/archive/documents", {
      method: "POST",
      body: form,
    }));

    expect(response.status).toBe(201);
    expect(mocks.uploadDriveFile).toHaveBeenCalledWith(drive, "mohasib-folder-id", expect.any(File));
    expect(storageUpload).not.toHaveBeenCalled();
    expect(documentQuery.insert).toHaveBeenCalledWith(expect.objectContaining({
      archive_id: null,
      storage_provider: "google_drive",
      external_file_id: "drive-file-id",
      storage_path: null,
    }));
    await expect(response.json()).resolves.toMatchObject({
      document: {
        id: "document-id",
        storage_provider: "google_drive",
        content_url: "/api/archive/documents/document-id/content",
      },
    });
  });
});
