/**
 * find_communities tool tests (TDD)
 * - fixture mode: returns fixtureCommunities, never hits network
 * - live mode: merges HN + Bluesky results
 * - allSettled isolation: a dead source degrades, doesn't throw
 * - charges budget (1 toolCall, 0 cents)
 * - persists raw_document + records pipeline_run
 */
import { expect, test, vi } from "vitest";

// ---------------------------------------------------------------------------
// Fixture mode — no network
// ---------------------------------------------------------------------------

test("find_communities in fixture mode returns fixtureCommunities without network", async () => {
  vi.resetModules();

  const FIXTURE_COMMUNITIES = [
    { source: "hn", title: "Ask HN: habit apps?", url: "https://news.ycombinator.com/item?id=1", engagement: 200 },
    { source: "bluesky", title: "Great habit tracker discussion", url: "https://bsky.app/profile/alice.bsky.social/post/abc", engagement: 55 },
  ];

  vi.doMock("@/lib/dev/fixtures", () => ({
    fixturesEnabled: () => true,
    fixtureCommunities: () => FIXTURE_COMMUNITIES,
  }));
  vi.doMock("@/lib/scan/adapters/hn-algolia", () => ({
    hnSearch: async () => { throw new Error("should not be called"); },
  }));
  vi.doMock("@/lib/scan/adapters/bluesky", () => ({
    blueskySearch: async () => { throw new Error("should not be called"); },
  }));
  vi.doMock("@/lib/db/raw-documents", () => ({
    upsertRawDocument: async () => ({ id: 1, deduped: false }),
  }));
  vi.doMock("@/lib/telemetry/pipeline-runs", () => ({
    recordPipelineRun: async () => {},
  }));

  const { findCommunities } = await import("./find-communities");
  const { ScanBudget } = await import("@/lib/tools/registry");
  const budget = new ScanBudget({ maxToolCalls: 60, budgetCents: 150 });

  const out = await findCommunities.run(
    { topic: "habit tracker", subjectKey: "nudgi" },
    { scanId: "s1", mode: "web", budget },
  );

  expect(out.communities).toHaveLength(2);
  expect(out.communities[0]?.source).toBe("hn");
  expect(out.communities[1]?.source).toBe("bluesky");
});

// ---------------------------------------------------------------------------
// Live mode — merges both sources
// ---------------------------------------------------------------------------

test("find_communities merges HN + Bluesky results", async () => {
  vi.resetModules();

  vi.doMock("@/lib/dev/fixtures", () => ({
    fixturesEnabled: () => false,
  }));
  vi.doMock("@/lib/scan/adapters/hn-algolia", () => ({
    hnSearch: async () => ([
      { source: "hn", title: "HN post", url: "https://hn.com/1", engagement: 100 },
    ]),
  }));
  vi.doMock("@/lib/scan/adapters/bluesky", () => ({
    blueskySearch: async () => ([
      { source: "bluesky", title: "Bsky post", url: "https://bsky.app/p/1", engagement: 50 },
    ]),
  }));
  vi.doMock("@/lib/db/raw-documents", () => ({
    upsertRawDocument: async () => ({ id: 1, deduped: false }),
  }));
  vi.doMock("@/lib/telemetry/pipeline-runs", () => ({
    recordPipelineRun: async () => {},
  }));

  const { findCommunities } = await import("./find-communities");
  const { ScanBudget } = await import("@/lib/tools/registry");
  const budget = new ScanBudget({ maxToolCalls: 60, budgetCents: 150 });

  const out = await findCommunities.run(
    { topic: "habit tracker", subjectKey: "nudgi" },
    { scanId: "s2", mode: "web", budget },
  );

  expect(out.communities).toHaveLength(2);
  expect(out.communities.map((c) => c.source)).toContain("hn");
  expect(out.communities.map((c) => c.source)).toContain("bluesky");
});

// ---------------------------------------------------------------------------
// allSettled isolation — a dead source degrades gracefully
// ---------------------------------------------------------------------------

test("find_communities survives when Bluesky throws (allSettled isolation)", async () => {
  vi.resetModules();

  vi.doMock("@/lib/dev/fixtures", () => ({
    fixturesEnabled: () => false,
  }));
  vi.doMock("@/lib/scan/adapters/hn-algolia", () => ({
    hnSearch: async () => ([
      { source: "hn", title: "HN post", url: "https://hn.com/1", engagement: 200 },
    ]),
  }));
  vi.doMock("@/lib/scan/adapters/bluesky", () => ({
    blueskySearch: async () => { throw new Error("Bluesky 503"); },
  }));
  vi.doMock("@/lib/db/raw-documents", () => ({
    upsertRawDocument: async () => ({ id: 1, deduped: false }),
  }));
  vi.doMock("@/lib/telemetry/pipeline-runs", () => ({
    recordPipelineRun: async () => {},
  }));

  const { findCommunities } = await import("./find-communities");
  const { ScanBudget } = await import("@/lib/tools/registry");
  const budget = new ScanBudget({ maxToolCalls: 60, budgetCents: 150 });

  const out = await findCommunities.run(
    { topic: "habit tracker", subjectKey: "nudgi" },
    { scanId: "s3", mode: "web", budget },
  );

  // HN results survive Bluesky failure
  expect(out.communities).toHaveLength(1);
  expect(out.communities[0]?.source).toBe("hn");
});

test("find_communities survives when HN throws (allSettled isolation)", async () => {
  vi.resetModules();

  vi.doMock("@/lib/dev/fixtures", () => ({
    fixturesEnabled: () => false,
  }));
  vi.doMock("@/lib/scan/adapters/hn-algolia", () => ({
    hnSearch: async () => { throw new Error("HN 500"); },
  }));
  vi.doMock("@/lib/scan/adapters/bluesky", () => ({
    blueskySearch: async () => ([
      { source: "bluesky", title: "Bsky post", url: "https://bsky.app/p/2", engagement: 77 },
    ]),
  }));
  vi.doMock("@/lib/db/raw-documents", () => ({
    upsertRawDocument: async () => ({ id: 1, deduped: false }),
  }));
  vi.doMock("@/lib/telemetry/pipeline-runs", () => ({
    recordPipelineRun: async () => {},
  }));

  const { findCommunities } = await import("./find-communities");
  const { ScanBudget } = await import("@/lib/tools/registry");
  const budget = new ScanBudget({ maxToolCalls: 60, budgetCents: 150 });

  const out = await findCommunities.run(
    { topic: "habit tracker", subjectKey: "nudgi" },
    { scanId: "s4", mode: "web", budget },
  );

  // Bluesky results survive HN failure
  expect(out.communities).toHaveLength(1);
  expect(out.communities[0]?.source).toBe("bluesky");
});

// ---------------------------------------------------------------------------
// Budget
// ---------------------------------------------------------------------------

test("find_communities charges 1 tool call and 0 cents", async () => {
  vi.resetModules();

  vi.doMock("@/lib/dev/fixtures", () => ({
    fixturesEnabled: () => false,
  }));
  vi.doMock("@/lib/scan/adapters/hn-algolia", () => ({
    hnSearch: async () => [],
  }));
  vi.doMock("@/lib/scan/adapters/bluesky", () => ({
    blueskySearch: async () => [],
  }));
  vi.doMock("@/lib/db/raw-documents", () => ({
    upsertRawDocument: async () => ({ id: 1, deduped: false }),
  }));
  vi.doMock("@/lib/telemetry/pipeline-runs", () => ({
    recordPipelineRun: async () => {},
  }));

  const { findCommunities } = await import("./find-communities");
  const { ScanBudget } = await import("@/lib/tools/registry");
  const budget = new ScanBudget({ maxToolCalls: 60, budgetCents: 150 });

  await findCommunities.run(
    { topic: "habit tracker", subjectKey: "nudgi" },
    { scanId: "s5", mode: "web", budget },
  );

  expect(budget.callsMade).toBe(1);
  expect(budget.spentCents).toBe(0);
});

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

test("find_communities persists raw doc with sourceType=communities", async () => {
  vi.resetModules();

  const upsertRawDocument = vi.fn(async () => ({ id: 42, deduped: false }));

  vi.doMock("@/lib/dev/fixtures", () => ({
    fixturesEnabled: () => false,
  }));
  vi.doMock("@/lib/scan/adapters/hn-algolia", () => ({
    hnSearch: async () => [],
  }));
  vi.doMock("@/lib/scan/adapters/bluesky", () => ({
    blueskySearch: async () => [],
  }));
  vi.doMock("@/lib/db/raw-documents", () => ({ upsertRawDocument }));
  vi.doMock("@/lib/telemetry/pipeline-runs", () => ({
    recordPipelineRun: async () => {},
  }));

  const { findCommunities } = await import("./find-communities");
  const { ScanBudget } = await import("@/lib/tools/registry");
  const budget = new ScanBudget({ maxToolCalls: 60, budgetCents: 150 });

  await findCommunities.run(
    { topic: "habit tracker", subjectKey: "nudgi" },
    { scanId: "s6", mode: "web", budget },
  );

  expect(upsertRawDocument).toHaveBeenCalledOnce();
  const firstCall = upsertRawDocument.mock.calls[0];
  expect(firstCall).toBeDefined();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expect((firstCall as any)[0].sourceType).toBe("communities");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expect((firstCall as any)[0].subjectKey).toBe("nudgi");
});

test("find_communities records a pipeline_run row with stage=tool", async () => {
  vi.resetModules();

  const recordPipelineRun = vi.fn(async () => {});

  vi.doMock("@/lib/dev/fixtures", () => ({
    fixturesEnabled: () => false,
  }));
  vi.doMock("@/lib/scan/adapters/hn-algolia", () => ({
    hnSearch: async () => [],
  }));
  vi.doMock("@/lib/scan/adapters/bluesky", () => ({
    blueskySearch: async () => [],
  }));
  vi.doMock("@/lib/db/raw-documents", () => ({
    upsertRawDocument: async () => ({ id: 1, deduped: false }),
  }));
  vi.doMock("@/lib/telemetry/pipeline-runs", () => ({ recordPipelineRun }));

  const { findCommunities } = await import("./find-communities");
  const { ScanBudget } = await import("@/lib/tools/registry");
  const budget = new ScanBudget({ maxToolCalls: 60, budgetCents: 150 });

  await findCommunities.run(
    { topic: "habit tracker", subjectKey: "nudgi" },
    { scanId: "s7", mode: "web", budget },
  );

  expect(recordPipelineRun).toHaveBeenCalledOnce();
  const firstCall = recordPipelineRun.mock.calls[0];
  expect(firstCall).toBeDefined();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expect((firstCall as any)[0].stage).toBe("tool");
});

// ---------------------------------------------------------------------------
// subjectType wiring — app mode → "app", web mode → "web"
// ---------------------------------------------------------------------------

test("find_communities uses subjectType=app in app mode", async () => {
  vi.resetModules();

  const upsertRawDocument = vi.fn(async () => ({ id: 1, deduped: false }));

  vi.doMock("@/lib/dev/fixtures", () => ({
    fixturesEnabled: () => false,
  }));
  vi.doMock("@/lib/scan/adapters/hn-algolia", () => ({
    hnSearch: async () => [],
  }));
  vi.doMock("@/lib/scan/adapters/bluesky", () => ({
    blueskySearch: async () => [],
  }));
  vi.doMock("@/lib/db/raw-documents", () => ({ upsertRawDocument }));
  vi.doMock("@/lib/telemetry/pipeline-runs", () => ({
    recordPipelineRun: async () => {},
  }));

  const { findCommunities } = await import("./find-communities");
  const { ScanBudget } = await import("@/lib/tools/registry");
  const budget = new ScanBudget({ maxToolCalls: 60, budgetCents: 150 });

  await findCommunities.run(
    { topic: "habit tracker", subjectKey: "com.app.myapp" },
    { scanId: "s8", mode: "ios", budget },
  );

  const firstCall = upsertRawDocument.mock.calls[0];
  expect(firstCall).toBeDefined();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expect((firstCall as any)[0].subjectType).toBe("app");
});
