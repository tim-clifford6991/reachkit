/**
 * search_keywords tool tests (TDD)
 * - charges budget once (1 call, 0 cents fixture / 1 cent live)
 * - calls keywordsData and returns keywords
 * - persists raw doc + records pipeline run
 */
import { expect, test, vi } from "vitest";

test("search_keywords charges budget 1 tool call and returns keywords", async () => {
  vi.resetModules();

  const mockKeywords = [
    { keyword: "habit tracker", volume: 1200, cpc: 1.2, competition: 0.4 },
    { keyword: "daily habit", volume: 1100, cpc: 1.1, competition: 0.35 },
  ];

  vi.doMock("@/lib/scan/adapters/keywords", () => ({
    keywordsData: async () => ({ keywords: mockKeywords, raw: { fixture: true } }),
  }));
  vi.doMock("@/lib/dev/fixtures", () => ({
    useFixtures: () => true,
  }));
  vi.doMock("@/lib/db/raw-documents", () => ({
    upsertRawDocument: async () => ({ id: 1, deduped: false }),
  }));
  vi.doMock("@/lib/telemetry/pipeline-runs", () => ({
    recordPipelineRun: async () => {},
  }));

  const { searchKeywords } = await import("./search-keywords");
  const { ScanBudget } = await import("@/lib/tools/registry");
  const budget = new ScanBudget({ maxToolCalls: 60, budgetCents: 150 });

  const out = await searchKeywords.run(
    { seeds: ["habit tracker", "daily habit"], subjectKey: "nudgi" },
    { scanId: "s1", mode: "web", budget },
  );

  expect(out.keywords).toEqual(mockKeywords);
  expect(budget.callsMade).toBe(1);
});

test("search_keywords charges 0 cents in fixture mode", async () => {
  vi.resetModules();

  vi.doMock("@/lib/scan/adapters/keywords", () => ({
    keywordsData: async () => ({ keywords: [], raw: {} }),
  }));
  vi.doMock("@/lib/dev/fixtures", () => ({
    useFixtures: () => true,
  }));
  vi.doMock("@/lib/db/raw-documents", () => ({
    upsertRawDocument: async () => ({ id: 1, deduped: false }),
  }));
  vi.doMock("@/lib/telemetry/pipeline-runs", () => ({
    recordPipelineRun: async () => {},
  }));

  const { searchKeywords } = await import("./search-keywords");
  const { ScanBudget } = await import("@/lib/tools/registry");
  const budget = new ScanBudget({ maxToolCalls: 60, budgetCents: 150 });

  await searchKeywords.run(
    { seeds: ["keyword"], subjectKey: "myapp" },
    { scanId: "s2", mode: "web", budget },
  );

  expect(budget.spentCents).toBe(0);
});

test("search_keywords persists raw doc with sourceType dataforseo_keywords", async () => {
  vi.resetModules();

  const upsertRawDocument = vi.fn(async () => ({ id: 42, deduped: false }));

  vi.doMock("@/lib/scan/adapters/keywords", () => ({
    keywordsData: async () => ({ keywords: [], raw: { fixture: true } }),
  }));
  vi.doMock("@/lib/dev/fixtures", () => ({
    useFixtures: () => true,
  }));
  vi.doMock("@/lib/db/raw-documents", () => ({ upsertRawDocument }));
  vi.doMock("@/lib/telemetry/pipeline-runs", () => ({
    recordPipelineRun: async () => {},
  }));

  const { searchKeywords } = await import("./search-keywords");
  const { ScanBudget } = await import("@/lib/tools/registry");
  const budget = new ScanBudget({ maxToolCalls: 60, budgetCents: 150 });

  await searchKeywords.run(
    { seeds: ["kw1"], subjectKey: "nudgi" },
    { scanId: "s3", mode: "web", budget },
  );

  expect(upsertRawDocument).toHaveBeenCalledOnce();
  const firstCall = upsertRawDocument.mock.calls[0];
  expect(firstCall).toBeDefined();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expect((firstCall as any)[0].sourceType).toBe("dataforseo_keywords");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expect((firstCall as any)[0].subjectKey).toBe("nudgi");
});

test("search_keywords records a pipeline_run row", async () => {
  vi.resetModules();

  const recordPipelineRun = vi.fn(async () => {});

  vi.doMock("@/lib/scan/adapters/keywords", () => ({
    keywordsData: async () => ({ keywords: [], raw: {} }),
  }));
  vi.doMock("@/lib/dev/fixtures", () => ({
    useFixtures: () => true,
  }));
  vi.doMock("@/lib/db/raw-documents", () => ({
    upsertRawDocument: async () => ({ id: 1, deduped: false }),
  }));
  vi.doMock("@/lib/telemetry/pipeline-runs", () => ({ recordPipelineRun }));

  const { searchKeywords } = await import("./search-keywords");
  const { ScanBudget } = await import("@/lib/tools/registry");
  const budget = new ScanBudget({ maxToolCalls: 60, budgetCents: 150 });

  await searchKeywords.run(
    { seeds: ["keyword"], subjectKey: "myapp" },
    { scanId: "s4", mode: "web", budget },
  );

  expect(recordPipelineRun).toHaveBeenCalledOnce();
  const firstCall = recordPipelineRun.mock.calls[0];
  expect(firstCall).toBeDefined();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expect((firstCall as any)[0].stage).toBe("tool");
});
