import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));

import { EXPECTED_SCHEMA_VERSION } from "../../../lib/schema-version";
import { GET } from "./route";

describe("health endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
  });

  it("stays synchronized with the latest numbered database migration", () => {
    const migrationVersions = readdirSync(resolve(process.cwd(), "supabase/migrations"))
      .map((filename) => /^(\d+)_/.exec(filename)?.[1])
      .filter((version): version is string => Boolean(version))
      .map(Number);

    expect(EXPECTED_SCHEMA_VERSION).toBe(Math.max(...migrationVersions));
  });

  it("reports healthy when the database is at the expected schema version", async () => {
    const single = vi.fn().mockResolvedValue({
      data: { version: EXPECTED_SCHEMA_VERSION },
      error: null,
    });
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single,
    };
    mocks.createAdminClient.mockReturnValue({ from: vi.fn(() => query) });

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "ok",
      checks: {
        configuration: "ok",
        database: "ok",
        schema: "ok",
      },
      schemaVersion: EXPECTED_SCHEMA_VERSION,
      expectedSchemaVersion: EXPECTED_SCHEMA_VERSION,
    });
  });

  it("reports degraded when the database schema is behind", async () => {
    const single = vi.fn().mockResolvedValue({
      data: { version: EXPECTED_SCHEMA_VERSION - 1 },
      error: null,
    });
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single,
    };
    mocks.createAdminClient.mockReturnValue({ from: vi.fn(() => query) });

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      status: "degraded",
      checks: { database: "ok", schema: "outdated" },
      schemaVersion: EXPECTED_SCHEMA_VERSION - 1,
      expectedSchemaVersion: EXPECTED_SCHEMA_VERSION,
    });
  });
});
