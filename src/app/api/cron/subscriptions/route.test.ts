import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  flush: vi.fn(),
  withMonitor: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@sentry/nextjs", () => ({
  flush: mocks.flush,
  withMonitor: mocks.withMonitor,
}));

import { GET } from "./route";

describe("subscription lifecycle cron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "test-secret");
    mocks.withMonitor.mockImplementation(async (_slug, callback) => callback());
    mocks.flush.mockResolvedValue(true);
  });

  it("rejects requests without the cron secret", async () => {
    const response = await GET(new NextRequest("https://app.mohasibai.com/api/cron/subscriptions"));

    expect(response.status).toBe(401);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("runs the lifecycle atomically and returns its counts", async () => {
    const result = {
      scheduledApplied: 2,
      trialsExpired: 3,
      subscriptionsMovedToGrace: 1,
      subscriptionsExpired: 4,
      subscriptionRowsExpired: 4,
      limitOverridesDeleted: 1,
    };
    const abortSignal = vi.fn().mockResolvedValue({ data: result, error: null });
    const rpc = vi.fn().mockReturnValue({ abortSignal });
    mocks.createAdminClient.mockReturnValue({ rpc });

    const response = await GET(new NextRequest("https://app.mohasibai.com/api/cron/subscriptions", {
      headers: { authorization: "Bearer test-secret" },
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, ...result });
    expect(rpc).toHaveBeenCalledWith("run_subscription_lifecycle", {
      p_today: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
    expect(abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
    expect(mocks.flush).toHaveBeenCalledWith(2_000);
  });

  it("reports database failures and still flushes the failed check-in", async () => {
    const abortSignal = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "database unavailable" },
    });
    mocks.createAdminClient.mockReturnValue({
      rpc: vi.fn().mockReturnValue({ abortSignal }),
    });

    const invocation = GET(new NextRequest("https://app.mohasibai.com/api/cron/subscriptions", {
      headers: { authorization: "Bearer test-secret" },
    }));

    await expect(invocation).rejects.toThrow("Run subscription lifecycle: database unavailable");
    expect(mocks.flush).toHaveBeenCalledWith(2_000);
  });
});
