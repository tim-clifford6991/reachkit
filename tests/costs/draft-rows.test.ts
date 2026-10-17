// tests/costs/draft-rows.test.ts — issue 1478: a draft's calls say they are
// a draft's, and once the draft has a row they name it.
//
// A day's page is written under one context keyed to its grounding scan,
// and its row exists only after the write call. So the context names the
// calls it has made when the row is written (`forDraft`), names every call
// after it, and starts afresh for a second topic (`forDraft(null)`).
import "../generate/env";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { readCacheMock, writeFetchRowMock, nameDraftOnRowsMock } = vi.hoisted(() => ({
  readCacheMock: vi.fn(),
  writeFetchRowMock: vi.fn(),
  nameDraftOnRowsMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  dbAdmin: () => ({
    rpc: async () => ({ data: 0, error: null }),
    from: () => ({
      select: () => ({ eq: () => ({ limit: async () => ({ data: [{ cost_cents: 0, site_id: null }], error: null }) }) }),
      update: () => ({ eq: async () => ({ error: null }) }),
    }),
  }),
}));
vi.mock("../../src/lib/costs/cache", () => ({ readCache: readCacheMock }));
vi.mock("../../src/lib/costs/ledger", () => ({ writeFetchRow: writeFetchRowMock, nameDraftOnRows: nameDraftOnRowsMock }));

const { withCostContext } = await import("../../src/lib/costs/index");

beforeEach(() => {
  readCacheMock.mockReset().mockResolvedValue(null);
  writeFetchRowMock.mockReset().mockResolvedValue(undefined);
  nameDraftOnRowsMock.mockReset().mockResolvedValue(undefined);
});

const spend = (source: string) => ({ source, cacheKey: source, freshnessDays: 0, costCents: 1, run: async () => ({}) });
const written = () => writeFetchRowMock.mock.calls.map(([row]) => row as { id: string; source: string; activity?: string; draftId?: string });

describe("a draft's context", () => {
  it("writes its calls as a draft's, names the earlier ones when the row exists, and every later one after", async () => {
    await withCostContext({ scanId: "scan-1", cap: "DRAFT", policyVersion: 1, rollUp: "none" }, async (cost) => {
      await cost.recordFetch(spend("generate.write"));
      await cost.forDraft?.("draft-1");
      await cost.recordFetch(spend("generate.fit_check"));
    });
    const [write, check] = written();
    expect(write).toMatchObject({ activity: "draft" });
    expect(write?.draftId).toBeUndefined();
    expect(nameDraftOnRowsMock).toHaveBeenCalledWith([write?.id], "draft-1");
    expect(check).toMatchObject({ activity: "draft", draftId: "draft-1" });
  });

  it("a second topic's calls are not the first page's", async () => {
    await withCostContext({ scanId: "scan-1", cap: "DRAFT", policyVersion: 1, rollUp: "none" }, async (cost) => {
      await cost.recordFetch(spend("generate.write"));
      await cost.forDraft?.("draft-1");
      await cost.forDraft?.(null);
      await cost.recordFetch(spend("generate.write"));
      await cost.forDraft?.("draft-2");
    });
    const [, second] = written();
    expect(second?.draftId).toBeUndefined();
    expect(nameDraftOnRowsMock).toHaveBeenLastCalledWith([second?.id], "draft-2");
  });

  it("an edit's context names its draft from the first call", async () => {
    await withCostContext({ scanId: "scan-1", cap: "DRAFT", policyVersion: 1, rollUp: "none", draftId: "draft-9" }, async (cost) => {
      await cost.recordFetch(spend("generate.fit_check"));
    });
    expect(written()[0]).toMatchObject({ activity: "draft", draftId: "draft-9" });
  });
});

describe("a pass's context", () => {
  it("leaves the activity to the database, which reads it off the scan", async () => {
    await withCostContext({ scanId: "scan-1", cap: "FREE", policyVersion: 1 }, async (cost) => {
      expect(cost.forDraft).toBeUndefined();
      await cost.recordFetch(spend("serp/google/organic"));
    });
    expect(written()[0]?.activity).toBeUndefined();
  });
});
