/**
 * find_creators tool tests (TDD)
 * - fixture mode: returns fixtureCreators, never hits network or reads env key
 * - live mode: merges allSettled results from youtubeSearch per competitor
 * - allSettled isolation: a failed search degrades gracefully
 * - charges budget (1 toolCall, 0 cents)
 * - persists raw_document (sourceType=youtube) + records pipeline_run (stage=tool)
 */
import { expect, test, vi } from "vitest";

// ---------------------------------------------------------------------------
// Fixture mode — no network, no env key
// ---------------------------------------------------------------------------

test("find_creators in fixture mode returns fixtureCreators without network", async () => {
  vi.resetModules();

  const FIXTURE_CREATORS = [
    { name: "Habitify Review Channel", url: "https://www.youtube.com/watch?v=fix_1", audienceProxy: 0, coveredCompetitor: "Habitify" },
    { name: "Best Habitify Alternatives", url: "https://www.youtube.com/watch?v=fix_2", audienceProxy: 0, coveredCompetitor: "Habitify" },
  ];

  vi.doMock("@/lib/dev/fixtures", () => ({
    fixturesEnabled: () => true,
    fixtureCreators: () => FIXTURE_CREATORS,
  }));
  vi.doMock("@/lib/scan/adapters/youtube", () => ({
    youtubeSearch: async () => { throw new Error("should not be called"); },
  }));
  vi.doMock("@/lib/db/raw-documents", () => ({
    upsertRawDocument: async () => ({ id: 1, deduped: false }),
  }));
  vi.doMock("@/lib/telemetry/pipeline-runs", () => ({
    recordPipelineRun: async () => {},
  }));

  const { findCreators } = await import("./find-creators");
  const { ScanBudget } = await import("@/lib/tools/registry");
  const budget = new ScanBudget({ maxToolCalls: 60, budgetCents: 150 });

  const out = await findCreators.run(
    { competitors: ["Habitify"], subjectKey: "nudgi" },
    { scanId: "s1", mode: "web", budget },
  );

  expect(out.creators).toHaveLength(2);
  expect(out.creators[0]?.coveredCompetitor).toBe("Habitify");
});

// ---------------------------------------------------------------------------
// Live mode — merges results across competitors
// ---------------------------------------------------------------------------

test("find_creators merges YouTube results for multiple competitors", async () => {
  vi.resetModules();

  vi.doMock("@/lib/dev/fixtures", () => ({
    fixturesEnabled: () => false,
  }));
  vi.doMock("@/lib/scan/adapters/youtube", () => ({
    youtubeSearch: async (_query: string, competitor: string) => ([
      { name: `${competitor} Reviewer`, url: `https://www.youtube.com/watch?v=v_${competitor}`, audienceProxy: 0, coveredCompetitor: competitor },
    ]),
  }));
  vi.doMock("@/lib/db/raw-documents", () => ({
    upsertRawDocument: async () => ({ id: 1, deduped: false }),
  }));
  vi.doMock("@/lib/telemetry/pipeline-runs", () => ({
    recordPipelineRun: async () => {},
  }));

  const { findCreators } = await import("./find-creators");
  const { ScanBudget } = await import("@/lib/tools/registry");
  const budget = new ScanBudget({ maxToolCalls: 60, budgetCents: 150 });

  const out = await findCreators.run(
    { competitors: ["Habitify", "Streaks"], subjectKey: "nudgi" },
    { scanId: "s2", mode: "web", budget },
  );

  expect(out.creators).toHaveLength(2);
  expect(out.creators.map((c) => c.coveredCompetitor)).toContain("Habitify");
  expect(out.creators.map((c) => c.coveredCompetitor)).toContain("Streaks");
});

// ---------------------------------------------------------------------------
// allSettled isolation — a failed search degrades gracefully
// ---------------------------------------------------------------------------

test("find_creators survives when one competitor search throws (allSettled isolation)", async () => {
  vi.resetModules();

  vi.doMock("@/lib/dev/fixtures", () => ({
    fixturesEnabled: () => false,
  }));
  vi.doMock("@/lib/scan/adapters/youtube", () => ({
    youtubeSearch: async (_query: string, competitor: string) => {
      if (competitor === "Streaks") throw new Error("YouTube 429");
      return [{ name: "Habitify Reviewer", url: "https://www.youtube.com/watch?v=h1", audienceProxy: 0, coveredCompetitor: "Habitify" }];
    },
  }));
  vi.doMock("@/lib/db/raw-documents", () => ({
    upsertRawDocument: async () => ({ id: 1, deduped: false }),
  }));
  vi.doMock("@/lib/telemetry/pipeline-runs", () => ({
    recordPipelineRun: async () => {},
  }));

  const { findCreators } = await import("./find-creators");
  const { ScanBudget } = await import("@/lib/tools/registry");
  const budget = new ScanBudget({ maxToolCalls: 60, budgetCents: 150 });

  const out = await findCreators.run(
    { competitors: ["Habitify", "Streaks"], subjectKey: "nudgi" },
    { scanId: "s3", mode: "web", budget },
  );

  // Habitify results survive Streaks failure
  expect(out.creators).toHaveLength(1);
  expect(out.creators[0]?.coveredCompetitor).toBe("Habitify");
});

// ---------------------------------------------------------------------------
// Budget
// ---------------------------------------------------------------------------

test("find_creators charges 1 tool call and 0 cents", async () => {
  vi.resetModules();

  vi.doMock("@/lib/dev/fixtures", () => ({
    fixturesEnabled: () => false,
  }));
  vi.doMock("@/lib/scan/adapters/youtube", () => ({
    youtubeSearch: async () => [],
  }));
  vi.doMock("@/lib/db/raw-documents", () => ({
    upsertRawDocument: async () => ({ id: 1, deduped: false }),
  }));
  vi.doMock("@/lib/telemetry/pipeline-runs", () => ({
    recordPipelineRun: async () => {},
  }));

  const { findCreators } = await import("./find-creators");
  const { ScanBudget } = await import("@/lib/tools/registry");
  const budget = new ScanBudget({ maxToolCalls: 60, budgetCents: 150 });

  await findCreators.run(
    { competitors: ["Habitify"], subjectKey: "nudgi" },
    { scanId: "s4", mode: "web", budget },
  );

  expect(budget.callsMade).toBe(1);
  expect(budget.spentCents).toBe(0);
});

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

test("find_creators persists raw doc with sourceType=youtube", async () => {
  vi.resetModules();

  const upsertRawDocument = vi.fn(async () => ({ id: 42, deduped: false }));

  vi.doMock("@/lib/dev/fixtures", () => ({
    fixturesEnabled: () => false,
  }));
  vi.doMock("@/lib/scan/adapters/youtube", () => ({
    youtubeSearch: async () => [],
  }));
  vi.doMock("@/lib/db/raw-documents", () => ({ upsertRawDocument }));
  vi.doMock("@/lib/telemetry/pipeline-runs", () => ({
    recordPipelineRun: async () => {},
  }));

  const { findCreators } = await import("./find-creators");
  const { ScanBudget } = await import("@/lib/tools/registry");
  const budget = new ScanBudget({ maxToolCalls: 60, budgetCents: 150 });

  await findCreators.run(
    { competitors: ["Habitify"], subjectKey: "nudgi" },
    { scanId: "s5", mode: "web", budget },
  );

  expect(upsertRawDocument).toHaveBeenCalledOnce();
  const firstCall = upsertRawDocument.mock.calls[0];
  expect(firstCall).toBeDefined();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expect((firstCall as any)[0].sourceType).toBe("youtube");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expect((firstCall as any)[0].subjectKey).toBe("nudgi");
});

test("find_creators records a pipeline_run row with stage=tool", async () => {
  vi.resetModules();

  const recordPipelineRun = vi.fn(async () => {});

  vi.doMock("@/lib/dev/fixtures", () => ({
    fixturesEnabled: () => false,
  }));
  vi.doMock("@/lib/scan/adapters/youtube", () => ({
    youtubeSearch: async () => [],
  }));
  vi.doMock("@/lib/db/raw-documents", () => ({
    upsertRawDocument: async () => ({ id: 1, deduped: false }),
  }));
  vi.doMock("@/lib/telemetry/pipeline-runs", () => ({ recordPipelineRun }));

  const { findCreators } = await import("./find-creators");
  const { ScanBudget } = await import("@/lib/tools/registry");
  const budget = new ScanBudget({ maxToolCalls: 60, budgetCents: 150 });

  await findCreators.run(
    { competitors: ["Habitify"], subjectKey: "nudgi" },
    { scanId: "s6", mode: "web", budget },
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

test("find_creators uses subjectType=app in app mode", async () => {
  vi.resetModules();

  const upsertRawDocument = vi.fn(async () => ({ id: 1, deduped: false }));

  vi.doMock("@/lib/dev/fixtures", () => ({
    fixturesEnabled: () => false,
  }));
  vi.doMock("@/lib/scan/adapters/youtube", () => ({
    youtubeSearch: async () => [],
  }));
  vi.doMock("@/lib/db/raw-documents", () => ({ upsertRawDocument }));
  vi.doMock("@/lib/telemetry/pipeline-runs", () => ({
    recordPipelineRun: async () => {},
  }));

  const { findCreators } = await import("./find-creators");
  const { ScanBudget } = await import("@/lib/tools/registry");
  const budget = new ScanBudget({ maxToolCalls: 60, budgetCents: 150 });

  await findCreators.run(
    { competitors: ["Habitify"], subjectKey: "com.app.myapp" },
    { scanId: "s7", mode: "ios", budget },
  );

  const firstCall = upsertRawDocument.mock.calls[0];
  expect(firstCall).toBeDefined();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expect((firstCall as any)[0].subjectType).toBe("app");
});

// ---------------------------------------------------------------------------
// Fixture mode budget still charged
// ---------------------------------------------------------------------------

test("find_creators fixture mode also charges 1 tool call", async () => {
  vi.resetModules();

  vi.doMock("@/lib/dev/fixtures", () => ({
    fixturesEnabled: () => true,
    fixtureCreators: () => [],
  }));
  vi.doMock("@/lib/scan/adapters/youtube", () => ({
    youtubeSearch: async () => { throw new Error("should not be called"); },
  }));
  vi.doMock("@/lib/db/raw-documents", () => ({
    upsertRawDocument: async () => ({ id: 1, deduped: false }),
  }));
  vi.doMock("@/lib/telemetry/pipeline-runs", () => ({
    recordPipelineRun: async () => {},
  }));

  const { findCreators } = await import("./find-creators");
  const { ScanBudget } = await import("@/lib/tools/registry");
  const budget = new ScanBudget({ maxToolCalls: 60, budgetCents: 150 });

  await findCreators.run(
    { competitors: ["Habitify"], subjectKey: "nudgi" },
    { scanId: "s8", mode: "web", budget },
  );

  expect(budget.callsMade).toBe(1);
  expect(budget.spentCents).toBe(0);
});
