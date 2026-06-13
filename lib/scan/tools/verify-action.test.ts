/**
 * verify_action tool tests (TDD)
 * - fixture mode: { verified: true, reason: "fixture" }, no fetch
 * - live mode (mocked fetch):
 *     200 + body containing `expect`        → verified:true
 *     200 + body NOT containing `expect`     → verified:false (fail-closed)
 *     200 + no `expect` arg                  → verified:true (page live)
 *     404 / throw / empty body               → verified:false (fail-closed)
 * - charges the budget once in live mode
 * - tool metadata: name=verify_action, klass=D
 */
import { beforeEach, expect, test, vi } from "vitest";

// fetchSourceText (reused from check-link) runs the response body through
// node-html-parser and returns the <body> text, so mocked bodies wrap content
// in real HTML and the asserted substring lives in the visible text.
function mockFetch(response: { ok: boolean; body: string } | "throw") {
  const impl =
    response === "throw"
      ? vi.fn().mockRejectedValue(new Error("ECONNREFUSED"))
      : vi.fn().mockResolvedValue({
          ok: response.ok,
          text: async () => response.body,
        });
  vi.stubGlobal("fetch", impl);
  return impl;
}

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Fixture mode — verified:true, no fetch
// ---------------------------------------------------------------------------

test("verify_action in fixture mode returns verified:true without fetch", async () => {
  vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => true }));
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);

  const { verifyAction } = await import("./verify-action");
  const { ScanBudget } = await import("@/lib/tools/registry");
  const budget = new ScanBudget({ maxToolCalls: 60, budgetCents: 150 });

  const out = await verifyAction.run(
    { url: "https://example.com/anything", expect: "whatever" },
    { scanId: "s1", mode: "web", budget },
  );

  expect(out.verified).toBe(true);
  expect(out.reason).toBe("fixture");
  expect(fetchMock).not.toHaveBeenCalled();
});

// ---------------------------------------------------------------------------
// Live mode — 200 with body containing `expect` → verified:true
// ---------------------------------------------------------------------------

test("verify_action live: 200 + body containing expect → verified:true", async () => {
  vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => false }));
  mockFetch({
    ok: true,
    body: "<html><body><h1>HabitKit — Daily Habit Tracker</h1><p>Build lasting habits.</p></body></html>",
  });

  const { verifyAction } = await import("./verify-action");
  const { ScanBudget } = await import("@/lib/tools/registry");
  const budget = new ScanBudget({ maxToolCalls: 60, budgetCents: 150 });

  const out = await verifyAction.run(
    { url: "https://habitkit.com", expect: "Daily Habit Tracker" },
    { scanId: "s2", mode: "web", budget },
  );

  expect(out.verified).toBe(true);
  expect(out.reason).toBe("expected text found");
});

test("verify_action live: expect match is case-insensitive", async () => {
  vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => false }));
  mockFetch({
    ok: true,
    body: "<html><body><p>Build Lasting Habits With HabitKit.</p></body></html>",
  });

  const { verifyAction } = await import("./verify-action");
  const { ScanBudget } = await import("@/lib/tools/registry");
  const budget = new ScanBudget({ maxToolCalls: 60, budgetCents: 150 });

  const out = await verifyAction.run(
    { url: "https://habitkit.com", expect: "BUILD LASTING HABITS" },
    { scanId: "s3", mode: "web", budget },
  );

  expect(out.verified).toBe(true);
});

// ---------------------------------------------------------------------------
// Live mode — 200 without `expect` arg → verified:true (page live)
// ---------------------------------------------------------------------------

test("verify_action live: 200 + no expect arg → verified:true (page live)", async () => {
  vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => false }));
  mockFetch({
    ok: true,
    body: "<html><body><p>Some real, non-trivial page content lives here.</p></body></html>",
  });

  const { verifyAction } = await import("./verify-action");
  const { ScanBudget } = await import("@/lib/tools/registry");
  const budget = new ScanBudget({ maxToolCalls: 60, budgetCents: 150 });

  const out = await verifyAction.run(
    { url: "https://habitkit.com" },
    { scanId: "s4", mode: "web", budget },
  );

  expect(out.verified).toBe(true);
  expect(out.reason).toBe("page live");
});

// ---------------------------------------------------------------------------
// Fail-closed cases
// ---------------------------------------------------------------------------

test("verify_action live (fail-closed): 200 + body NOT containing expect → verified:false", async () => {
  vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => false }));
  mockFetch({
    ok: true,
    body: "<html><body><p>Completely unrelated content about gardening.</p></body></html>",
  });

  const { verifyAction } = await import("./verify-action");
  const { ScanBudget } = await import("@/lib/tools/registry");
  const budget = new ScanBudget({ maxToolCalls: 60, budgetCents: 150 });

  const out = await verifyAction.run(
    { url: "https://habitkit.com", expect: "Daily Habit Tracker" },
    { scanId: "s5", mode: "web", budget },
  );

  expect(out.verified).toBe(false);
  expect(out.reason).toBe("expected text not found");
});

test("verify_action live (fail-closed): non-200 → verified:false", async () => {
  vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => false }));
  mockFetch({ ok: false, body: "<html><body><p>Not found</p></body></html>" });

  const { verifyAction } = await import("./verify-action");
  const { ScanBudget } = await import("@/lib/tools/registry");
  const budget = new ScanBudget({ maxToolCalls: 60, budgetCents: 150 });

  const out = await verifyAction.run(
    { url: "https://habitkit.com/404", expect: "anything" },
    { scanId: "s6", mode: "web", budget },
  );

  expect(out.verified).toBe(false);
  expect(out.reason).toBe("url unreachable/empty");
});

test("verify_action live (fail-closed): fetch throws → verified:false", async () => {
  vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => false }));
  mockFetch("throw");

  const { verifyAction } = await import("./verify-action");
  const { ScanBudget } = await import("@/lib/tools/registry");
  const budget = new ScanBudget({ maxToolCalls: 60, budgetCents: 150 });

  const out = await verifyAction.run(
    { url: "https://unreachable.invalid", expect: "anything" },
    { scanId: "s7", mode: "web", budget },
  );

  // fetchSourceText swallows the throw → "" → unreachable; still fail-closed.
  expect(out.verified).toBe(false);
});

test("verify_action live (fail-closed): empty body → verified:false", async () => {
  vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => false }));
  mockFetch({ ok: true, body: "<html><body></body></html>" });

  const { verifyAction } = await import("./verify-action");
  const { ScanBudget } = await import("@/lib/tools/registry");
  const budget = new ScanBudget({ maxToolCalls: 60, budgetCents: 150 });

  const out = await verifyAction.run(
    { url: "https://habitkit.com/empty" },
    { scanId: "s8", mode: "web", budget },
  );

  expect(out.verified).toBe(false);
  expect(out.reason).toBe("url unreachable/empty");
});

// ---------------------------------------------------------------------------
// Budget — charged once in live mode
// ---------------------------------------------------------------------------

test("verify_action charges 1 tool call and 0 cents in live mode", async () => {
  vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => false }));
  mockFetch({ ok: true, body: "<html><body><p>Live page content.</p></body></html>" });

  const { verifyAction } = await import("./verify-action");
  const { ScanBudget } = await import("@/lib/tools/registry");
  const budget = new ScanBudget({ maxToolCalls: 60, budgetCents: 150 });

  await verifyAction.run(
    { url: "https://habitkit.com" },
    { scanId: "s9", mode: "web", budget },
  );

  expect(budget.callsMade).toBe(1);
  expect(budget.spentCents).toBe(0);
});

// ---------------------------------------------------------------------------
// Tool metadata
// ---------------------------------------------------------------------------

test("verify_action has name=verify_action and klass=D", async () => {
  vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => false }));
  const { verifyAction } = await import("./verify-action");
  expect(verifyAction.name).toBe("verify_action");
  expect(verifyAction.klass).toBe("D");
});
