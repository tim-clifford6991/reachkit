import { describe, expect, test, vi, beforeEach } from "vitest";
import { factSheetTtlMs } from "./fact-sheets";
import { RELEVANCE_JUDGE_VERSION } from "./fact-sheet-kind";

const DAY_MS = 24 * 3600 * 1000;

describe("factSheetTtlMs", () => {
  test("keyword_data TTL is 30 days", () => {
    expect(factSheetTtlMs("keyword_data")).toBe(30 * DAY_MS);
  });

  test("positioning TTL is 14 days", () => {
    expect(factSheetTtlMs("positioning")).toBe(14 * DAY_MS);
  });

  test("competitor_gap TTL is 14 days", () => {
    expect(factSheetTtlMs("competitor_gap")).toBe(14 * DAY_MS);
  });
});

// Task 2b: whenever a policy-gated kind's semantics tighten, a fact sheet cached
// under the OLD policy must stop being served — otherwise a re-scan keeps
// re-serving pre-fix data even after the generation-layer fix lands, because the
// cache read-back never re-checks it. (`review_themes` was the original example
// of this mechanism — retired M3b, 2026-07-23, O-7. `relevance_verdicts`, the
// LLM relevance judge's cache, is the general POLICY_SUFFIX_BY_KIND mechanism's
// one remaining live member; ported here so the mechanism itself stays guarded.)
// serverDb mock: .from("fact_sheets").select().eq().eq().eq().maybeSingle() + .upsert()
function makeDb(row: { body: unknown; expires_at: string; model_version: string } | null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });
  const eq3 = vi.fn().mockReturnValue({ maybeSingle });
  const eq2 = vi.fn().mockReturnValue({ eq: eq3 });
  const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
  const select = vi.fn().mockReturnValue({ eq: eq1 });
  const upsertSingle = vi.fn().mockResolvedValue({ data: { id: 1 }, error: null });
  const upsertSelect = vi.fn().mockReturnValue({ single: upsertSingle });
  const upsert = vi.fn().mockReturnValue({ select: upsertSelect });
  const from = vi.fn().mockReturnValue({ select, upsert });
  return { serverDb: vi.fn().mockReturnValue({ from }), spies: { upsert, select } };
}

beforeEach(() => vi.resetModules());

describe("getFreshFactSheet — policy version (relevance_verdicts)", () => {
  test("a relevance_verdicts sheet stamped with the CURRENT policy version is returned", async () => {
    const db = makeDb({
      body: { verdict: "category" },
      expires_at: new Date(Date.now() + DAY_MS).toISOString(),
      model_version: `claude-haiku-test+rjv${RELEVANCE_JUDGE_VERSION}`,
    });
    vi.doMock("@/lib/db/client", () => ({ serverDb: db.serverDb }));
    const { getFreshFactSheet } = await import("./fact-sheets");
    const out = await getFreshFactSheet("web", "acme.com", "relevance_verdicts");
    expect(out).toEqual({ body: { verdict: "category" } });
  });

  test("a relevance_verdicts sheet stamped with an OLD/missing policy version is treated as a MISS", async () => {
    const db = makeDb({
      body: { verdict: "stale-verdict" },
      expires_at: new Date(Date.now() + DAY_MS).toISOString(),
      model_version: "claude-haiku-test",
    });
    vi.doMock("@/lib/db/client", () => ({ serverDb: db.serverDb }));
    const { getFreshFactSheet } = await import("./fact-sheets");
    const out = await getFreshFactSheet("web", "acme.com", "relevance_verdicts");
    expect(out).toBeNull();
  });

  test("a relevance_verdicts sheet stamped with a STALE policy version (rjv0) is treated as a MISS", async () => {
    const db = makeDb({
      body: { verdict: "stale-verdict" },
      expires_at: new Date(Date.now() + DAY_MS).toISOString(),
      model_version: "claude-haiku-test+rjv0",
    });
    vi.doMock("@/lib/db/client", () => ({ serverDb: db.serverDb }));
    const { getFreshFactSheet } = await import("./fact-sheets");
    const out = await getFreshFactSheet("web", "acme.com", "relevance_verdicts");
    expect(out).toBeNull();
  });

  test("policy versioning does NOT apply to other sheet kinds (e.g. positioning) — unstamped is still a hit", async () => {
    const db = makeDb({
      body: { actualAudience: "SMB SaaS teams" },
      expires_at: new Date(Date.now() + DAY_MS).toISOString(),
      model_version: "claude-haiku-test",
    });
    vi.doMock("@/lib/db/client", () => ({ serverDb: db.serverDb }));
    const { getFreshFactSheet } = await import("./fact-sheets");
    const out = await getFreshFactSheet("web", "acme.com", "positioning");
    expect(out).toEqual({ body: { actualAudience: "SMB SaaS teams" } });
  });
});

describe("upsertFactSheet — policy stamping", () => {
  test("stamps the CURRENT policy version onto relevance_verdicts writes", async () => {
    const db = makeDb(null);
    vi.doMock("@/lib/db/client", () => ({ serverDb: db.serverDb }));
    const { upsertFactSheet } = await import("./fact-sheets");
    await upsertFactSheet({
      subjectType: "web",
      subjectKey: "acme.com",
      kind: "relevance_verdicts",
      body: { verdict: "category" },
      modelVersion: "claude-haiku-test",
    });
    const upsertCall = db.spies.upsert.mock.calls[0]![0] as { model_version: string };
    expect(upsertCall.model_version).toBe(`claude-haiku-test+rjv${RELEVANCE_JUDGE_VERSION}`);
  });

  test("does NOT stamp a policy suffix on other sheet kinds (e.g. positioning) — no behavior change", async () => {
    const db = makeDb(null);
    vi.doMock("@/lib/db/client", () => ({ serverDb: db.serverDb }));
    const { upsertFactSheet } = await import("./fact-sheets");
    await upsertFactSheet({
      subjectType: "web",
      subjectKey: "acme.com",
      kind: "positioning",
      body: { actualAudience: "" },
      modelVersion: "claude-haiku-test",
    });
    const upsertCall = db.spies.upsert.mock.calls[0]![0] as { model_version: string };
    expect(upsertCall.model_version).toBe("claude-haiku-test");
  });
});
