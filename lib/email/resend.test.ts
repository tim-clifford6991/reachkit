import { beforeEach, expect, test, vi } from "vitest";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const FROM = "ReachKit <reports@reachkit.app>";

const OPTS = {
  to: "user@example.com",
  scanId: "scan-123",
  appName: "MyApp",
  reportUrl: "http://localhost:3000/scan/scan-123/results",
};

// ---------------------------------------------------------------------------
// Non-fixture mode: sends via Resend
// ---------------------------------------------------------------------------

test("non-fixture: emails.send is called with correct from/to/subject/body", async () => {
  vi.resetModules();

  const sendMock = vi.fn().mockResolvedValue({ data: { id: "msg_1" }, error: null });

  vi.doMock("resend", () => {
    class MockResend {
      emails = { send: sendMock };
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      constructor(_key: string) {}
    }
    return { Resend: MockResend };
  });
  vi.doMock("@/lib/dev/fixtures", () => ({
    fixturesEnabled: () => false,
  }));
  vi.doMock("@/lib/config/env", () => ({
    env: { resendApiKey: "test-resend-key", appUrl: "http://localhost:3000" },
  }));

  const { sendScanReadyEmail } = await import("./resend");
  await sendScanReadyEmail(OPTS);

  expect(sendMock).toHaveBeenCalledOnce();
  const callArgs = sendMock.mock.calls[0] as [Record<string, string>] | undefined;
  expect(callArgs).toBeDefined();
  const payload = callArgs?.[0];
  expect(payload?.["from"]).toBe(FROM);
  expect(payload?.["to"]).toBe(OPTS.to);
  expect(payload?.["subject"]).toContain(OPTS.appName);
  expect(payload?.["text"]).toContain(OPTS.reportUrl);
  expect(payload?.["html"]).toContain(OPTS.reportUrl);
});

// ---------------------------------------------------------------------------
// Non-fixture mode: returned error → rejects
// ---------------------------------------------------------------------------

test("non-fixture: rejects when resend returns an error object", async () => {
  vi.resetModules();

  const sendMock = vi.fn().mockResolvedValue({
    data: null,
    error: { message: "Invalid API key", name: "missing_api_key" },
  });

  vi.doMock("resend", () => {
    class MockResend {
      emails = { send: sendMock };
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      constructor(_key: string) {}
    }
    return { Resend: MockResend };
  });
  vi.doMock("@/lib/dev/fixtures", () => ({
    fixturesEnabled: () => false,
  }));
  vi.doMock("@/lib/config/env", () => ({
    env: { resendApiKey: "bad-key", appUrl: "http://localhost:3000" },
  }));

  const { sendScanReadyEmail } = await import("./resend");
  await expect(sendScanReadyEmail(OPTS)).rejects.toThrow(/Invalid API key/);
});

// ---------------------------------------------------------------------------
// Fixture mode: logs, does NOT call emails.send
// ---------------------------------------------------------------------------

test("fixture mode: emails.send is not called; console.log is called", async () => {
  vi.resetModules();

  const sendMock = vi.fn();

  vi.doMock("resend", () => {
    class MockResend {
      emails = { send: sendMock };
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      constructor(_key: string) {}
    }
    return { Resend: MockResend };
  });
  vi.doMock("@/lib/dev/fixtures", () => ({
    fixturesEnabled: () => true,
  }));
  vi.doMock("@/lib/config/env", () => ({
    env: { resendApiKey: "", appUrl: "http://localhost:3000" },
  }));

  const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

  const { sendScanReadyEmail } = await import("./resend");
  await sendScanReadyEmail(OPTS);

  expect(sendMock).not.toHaveBeenCalled();
  expect(logSpy).toHaveBeenCalledWith(
    "[email:fixture] scan-ready →",
    expect.objectContaining({ to: OPTS.to, scanId: OPTS.scanId }),
  );

  logSpy.mockRestore();
});

// Keep beforeEach isolated (resetModules is per-test above)
beforeEach(() => {});
