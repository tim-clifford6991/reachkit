// tests/generate/mend-1507.test.ts — SPEC §7 (issue 1507): a live page whose
// every defect code repairs is mended through the refresh path at 0¢, as a
// new version that keeps its dates (`dateModified`, `lastmod`).
import "./env";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SITE_ID, memoryStore, opportunity, type MemoryStore } from "./fixtures";

const { llmMock, pickMock, queueForDraftMock, publications } = vi.hoisted(() => ({
  llmMock: vi.fn(),
  pickMock: vi.fn(),
  queueForDraftMock: vi.fn(),
  publications: [] as unknown[],
}));
vi.mock("@/lib/llm", () => ({ llm: llmMock }));
vi.mock("@/lib/opportunities", () => ({
  pageForDay: (siteId: string, date: string, now?: Date) => pickMock(siteId, date, now),
  queueForDraft: queueForDraftMock,
  restTopic: async () => undefined,
  updateInstead: async () => null,
  opportunityById: async () => null,
  sitePagesFor: async () => [],
  assessFixPages: async () => ({ done: 0, ready: 0 }),
  assessReadiness: async () => ({ ready: 1, unready: 0 }),
}));
vi.mock("@/lib/costs", () => ({
  withCostContext: async (_: unknown, run: (c: unknown) => Promise<unknown>) =>
    run({ recordFetch: () => { throw new Error("a mend fetches nothing"); }, capHit: () => false, spentCents: () => 0, degraded: () => false }),
}));
vi.mock("@/lib/publish/machine", () => ({ transition: async (_: string, to: string) => ({ ok: true, state: to }) }));
// The hosted store's one read, answered from `publications` as Postgres
// would: newest first.
vi.mock("@/lib/publish/db", () => {
  const chain: Record<string, unknown> = { then: (resolve: (value: unknown) => unknown) => resolve({ data: publications, error: null }) };
  for (const step of ["from", "select", "eq", "not", "is", "order"]) chain[step] = () => chain;
  return { publishDb: () => chain };
});

const STORED = JSON.parse(readFileSync(path.join(__dirname, "live-structure-pages-1507.json"), "utf8")) as {
  pages: { draftId: string; liveUrl: string; description: string; markdown: string }[];
};
const B = STORED.pages.find((page) => page.liveUrl.endsWith("/reachkit-vs-aeo-engine"))!;
const WENT_LIVE = new Date("2026-10-05T07:00:04.910Z");

/** The refresh the hourly re-check plans for B. */
const REFRESH = opportunity({
  id: "44444444-4444-4444-8444-444444444444",
  type: "refresh_page",
  family: "improve",
  targetRef: B.liveUrl,
  evidence: { family: "improve", query: "reachkit vs aeo engine", pageUrl: B.liveUrl, shortfall: { kind: "due", cause: "structure", defects: ["glued_numeral", "link_markup"] } },
} as never);

let store: MemoryStore & { liveVersionAt: NonNullable<MemoryStore["liveVersionAt"]> };

beforeEach(async () => {
  llmMock.mockReset();
  pickMock.mockReset();
  pickMock.mockResolvedValue(REFRESH);
  queueForDraftMock.mockReset();
  const base = memoryStore();
  base.seed({ id: B.draftId, state: "published", title: "ReachKit vs AEO Engine: 7 buyer questions, answered", body_md: B.markdown, meta: { description: B.description, contentType: "listicle" }, attribution: "Tim" });
  store = Object.assign(base, { liveVersionAt: async () => ({ draft: base.rows.get(B.draftId)!, publishedAt: WENT_LIVE }) });
  const { setGenerateStore } = await import("../../src/lib/generate/store");
  setGenerateStore(store);
});

afterEach(async () => {
  const { setGenerateStore } = await import("../../src/lib/generate/store");
  setGenerateStore(null);
});

describe("a live page mended through the refresh path", () => {
  it("is a new version of its own text with the defects repaired, no model asked and the live row untouched", async () => {
    const { generateDayPage } = await import("../../src/lib/generate");
    const outcome = await generateDayPage({ siteId: SITE_ID, publishDate: "2026-11-10" });
    expect(outcome.ok).toBe(true);
    expect(llmMock).not.toHaveBeenCalled();
    const mended = outcome.ok ? store.rows.get(outcome.draftId)! : null;
    expect(mended?.body_md).toContain("For a B2B SaaS");
    expect(mended?.body_md).not.toContain("[One plan.");
    expect(mended?.meta).toMatchObject({ description: B.description, datedAs: WENT_LIVE.toISOString(), mendOf: B.draftId });
    expect(mended?.cost_cents).toBe(0);
    expect(store.rows.get(B.draftId)!.body_md).toBe(B.markdown);
    expect(queueForDraftMock).toHaveBeenCalledWith(REFRESH.id);
  });

  it("keeps the version's published and updated dates, so dateModified and lastmod stay", async () => {
    const row = (id: string, publishedAt: string, meta: Record<string, unknown>) => ({
      id,
      site_id: SITE_ID,
      live_url: B.liveUrl,
      published_at: publishedAt,
      mode: "autopilot",
      sites: { domain: "reachkit.app", category: null, timezone: null },
      drafts: { title: "t", body_md: id, attribution: null, meta, grounded_fact: null, opportunity_id: "o", opportunities: { id: "o", target_query: "q", scans: null } },
    });
    publications.splice(0, publications.length, row("mended", "2026-11-11T07:00:00.000Z", { datedAs: WENT_LIVE.toISOString() }), row("written", WENT_LIVE.toISOString(), {}));
    const { livePagesForSite } = await import("../../src/lib/publish/destinations/hosted/store");
    const [page] = await livePagesForSite(SITE_ID, "content.reachkit.app");
    expect(page?.bodyMd).toBe("mended");
    expect(page?.publishedAt.toISOString()).toBe(WENT_LIVE.toISOString());
    expect(page?.firstPublishedAt.toISOString()).toBe(WENT_LIVE.toISOString());
    // A version the writer changed is dated when it went live, as before.
    publications.splice(0, publications.length, row("refreshed", "2026-11-11T07:00:00.000Z", {}), row("written", WENT_LIVE.toISOString(), {}));
    const [refreshed] = await livePagesForSite(SITE_ID, "content.reachkit.app");
    expect(refreshed?.publishedAt.toISOString()).toBe("2026-11-11T07:00:00.000Z");
  });
});
