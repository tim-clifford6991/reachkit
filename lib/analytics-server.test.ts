import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Server observability must be fail-safe: when PostHog is unconfigured (no
 * POSTHOG_KEY) every function is a silent no-op that NEVER throws — otherwise a
 * reporting failure would mask or replace the very error it's reporting.
 */
describe("analytics-server (P4)", () => {
  beforeEach(() => {
    vi.resetModules();
    // Ensure PostHog is treated as unconfigured for the no-op path.
    vi.stubEnv("POSTHOG_KEY", "");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("captureServerException is a no-op that never throws when unconfigured", async () => {
    const { captureServerException, __resetServerAnalytics } = await import("./analytics-server");
    __resetServerAnalytics();
    await expect(
      captureServerException(new Error("boom"), { source: "test", extra: { a: 1 } }),
    ).resolves.toBeUndefined();
    await expect(captureServerException("string error")).resolves.toBeUndefined();
  });

  it("captureServerEvent is a no-op that never throws when unconfigured", async () => {
    const { captureServerEvent, __resetServerAnalytics } = await import("./analytics-server");
    __resetServerAnalytics();
    await expect(
      captureServerEvent("subscription_activated", "user_1", { source: "test" }),
    ).resolves.toBeUndefined();
  });
});
