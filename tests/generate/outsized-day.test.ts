// tests/generate/outsized-day.test.ts — SPEC §6, §7 (issue 881)
//
// The daily job, end to end on the engine's side, for the site the owner's
// dogfood caught: every target outsized, nothing right-sized on file.
// `generateDayPage` is the whole of what `draft/generate` calls, and here it
// runs against the **real** `@/lib/opportunities` — readiness, the ranked
// list and `nextForDay` — over the in-memory opportunity store.
//
// What must be true: no draft is written, and **no model call is made**.
// The dogfood run cost 2.58¢ and a publishing day for a page the
// right-sizing law bars, so "spends nothing on the model" is the assertion
// that would have caught it.
//
// On main this test fails: the six outsized rows rank, `nextForDay` hands
// back "best seo software", and the model is asked for a page.
import "./env";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { llmMock, readMeasuredTextMock, withCostContextMock, transitionMock } = vi.hoisted(() => ({
  llmMock: vi.fn(),
  readMeasuredTextMock: vi.fn(),
  withCostContextMock: vi.fn(),
  transitionMock: vi.fn(),
}));
vi.mock("@/lib/llm", () => ({ llm: llmMock }));
vi.mock("@/lib/measure/text", () => ({ readMeasuredText: readMeasuredTextMock }));
vi.mock("@/lib/costs", () => ({ withCostContext: withCostContextMock }));
vi.mock("@/lib/publish/machine", () => ({ transition: transitionMock }));
vi.mock("@/lib/site-profile/crawl", () => ({ crawlSite: vi.fn() }));

import { measured } from "../../src/lib/measure/measured";
import { setOpportunityStore, type OpportunityRow } from "../../src/lib/opportunities/store";
import { setGenerateStore } from "../../src/lib/generate/store";
import { generateDayPage } from "../../src/lib/generate";
import {
  memoryStore as generateStore,
  AT,
  GROUNDED,
  SCAN_ID,
  SITE_ID,
  SOURCE_TEXT,
  type MemoryStore,
} from "./fixtures";
import {
  memoryStore as opportunityStore,
  newMemoryState,
  type MemoryState,
} from "../opportunities/memory-store";
import { PROFILE, defaultReport } from "../opportunities/fixtures";

const PUBLISH_DATE = "2026-09-19";

/** One open, ready Write row as the dogfood site held its six.
 *
 *  `answer_page`, which is what they were: §6's keyword gate already
 *  refuses a `keyword_page` whose band is not `winnable`, so that type was
 *  never the hole. An answer page carries no such gate — the competition
 *  bar gates `keyword_page` alone (§6, 2026-09-15) — and the only thing
 *  standing between an outsized answer page and a publishing day was the
 *  score's zero weight. */
function row(id: string, query: string, volume: number, fitBand: string): OpportunityRow {
  return {
    id,
    site_id: SITE_ID,
    scan_id: SCAN_ID,
    type: "answer_page",
    family: "write",
    target_query: query,
    target_ref: query.replace(/[^a-z0-9]+/g, "-"),
    proposed_slug: query.replace(/[^a-z0-9]+/g, "-"),
    title: null,
    volume,
    evidence: {
      family: "write",
      query,
      volume: measured(volume, AT),
      rival: {
        domain: "zapier.com",
        url: measured("https://zapier.com/blog/seo", AT),
        position: measured(1, AT),
      },
    },
    acceptance: { form: "named_on", question: `What is the best ${query}?` },
    fit_band: fitBand,
    effort: 0.5,
    status: "open",
    cluster_key: null,
    absorbed_queries: [],
    ready: true,
    unready_reason: null,
    created_at: AT.toISOString(),
  } as OpportunityRow;
}

/** The dogfood site's own six, in its own order. */
const OUTSIZED_SIX: readonly OpportunityRow[] = [
  row("opp-1", "best seo software", 1000, "not-yet"),
  row("opp-2", "seo software tool", 880, "not-yet"),
  row("opp-3", "ai tool for seo", 880, "not-yet"),
  row("opp-4", "best seo tools", 720, "not-yet"),
  row("opp-5", "seo platform", 590, "not-yet"),
  row("opp-6", "seo software for startups", 260, "not-yet"),
];

let drafts: MemoryStore;
let state: MemoryState;

beforeEach(() => {
  llmMock.mockReset();
  llmMock.mockImplementation(() => {
    throw new Error("the model was asked for a page the right-sizing law bars");
  });
  readMeasuredTextMock.mockResolvedValue([]);
  withCostContextMock.mockReset();
  withCostContextMock.mockImplementation(async (_ctx: unknown, run: (c: unknown) => Promise<unknown>) =>
    run({
      cap: "DRAFT",
      recordFetch: () => {
        throw new Error("the generation engine must reach a model through llm()");
      },
      capHit: () => false,
      spentCents: () => 0,
      degraded: () => false,
    })
  );

  drafts = generateStore();
  setGenerateStore(drafts);
  state = newMemoryState({ profile: PROFILE, report: defaultReport(), rows: [...OUTSIZED_SIX] });
  setOpportunityStore(opportunityStore(state));
});

afterEach(() => {
  setGenerateStore(null);
  setOpportunityStore(null);
  vi.restoreAllMocks();
});

describe("the daily job on a site whose every target is outsized (issue 881)", () => {
  it("writes no draft and spends nothing on the model", async () => {
    const outcome = await generateDayPage({ siteId: SITE_ID, publishDate: PUBLISH_DATE });

    expect(outcome).toEqual({ ok: false, because: "no_opportunity" });
    expect(llmMock).not.toHaveBeenCalled();
    expect([...drafts.rows.values()]).toEqual([]);
    // And the day was not spent: no cost context was even opened.
    expect(withCostContextMock).not.toHaveBeenCalled();
  });

  it("the six stay on file — outsized is not dismissed, it is simply not the day's work", async () => {
    await generateDayPage({ siteId: SITE_ID, publishDate: PUBLISH_DATE });

    expect(state.rows.filter((r) => r.status === "open")).toHaveLength(OUTSIZED_SIX.length);
  });

  it("one right-sized target among them, and that is the page the day takes", async () => {
    state.rows = [...OUTSIZED_SIX, row("opp-fit", "best seo brief software for startups", 40, "winnable")];
    // The site's own measured page, so the run reaches the writing steps at
    // all; the first model call then stops it. This case only has to prove
    // **which** target the day took.
    readMeasuredTextMock.mockResolvedValue([
      { url: GROUNDED.url, text: SOURCE_TEXT, measuredAt: GROUNDED.readAt },
    ]);
    llmMock.mockReset();
    llmMock.mockRejectedValue(new Error("stop once the target is chosen"));

    // The first model call is refused, and that refusal is this case's
    // stop sign: what matters is which target had been chosen by then.
    await generateDayPage({ siteId: SITE_ID, publishDate: PUBLISH_DATE }).catch(() => undefined);

    expect(llmMock).toHaveBeenCalled();
    const asked = JSON.stringify(llmMock.mock.calls);
    expect(asked).toContain("best seo brief software for startups");
    for (const outsized of OUTSIZED_SIX) expect(asked).not.toContain(outsized.target_query);
  });
});
