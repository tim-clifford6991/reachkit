// tests/generate/evening-refill.test.ts — issue 1549
//
// The evening run, before the day's page, tops a short site up to two weeks
// of writable days from its latest stored scan — not only Monday's pass. It
// buys nothing and asks no model, and a second evening over the same rows
// writes nothing more.
//
// On main this fails: only `topUp` and `pursueDepth` refill, so a site of
// listicles stays at a handful of writable days all week.
import "./env";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { llmMock, readMeasuredTextMock, withCostContextMock, transitionMock } = vi.hoisted(() => ({
  llmMock: vi.fn(),
  readMeasuredTextMock: vi.fn(),
  withCostContextMock: vi.fn(),
  transitionMock: vi.fn(),
}));
// No test reaches a vendor: the research step's reads and its one search are
// stood in for, and the page is written from the business's own facts.
vi.mock("@/lib/generate/pipeline/research", async (importOriginal) => {
  const { researchStandIn } = await import("./fixtures");
  return researchStandIn(await importOriginal<object>());
});
vi.mock("@/lib/llm", () => ({ llm: llmMock }));

// #927: `writePage` reads the confirmed business profile and the passages
// the customer switched off. This suite is about the day's decision, not
// about that read, so the seam answers "nothing confirmed" — the state a
// site whose crawl has not run is in, and the one that keeps every
// assertion below about what it was about before.
vi.mock("@/lib/generate/voice/confirmed", () => ({
  confirmedForWriting: async () => ({ profile: null, factsOff: [] }),
  refusedPassages: async () => [],
}));
vi.mock("@/lib/measure/text", () => ({ readMeasuredText: readMeasuredTextMock }));
vi.mock("@/lib/generate/pipeline/report-facts", () => ({ readReportPage: async () => null }));
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
  SCAN_ID,
  SITE_ID,
  type MemoryStore,
} from "./fixtures";
import {
  memoryStore as opportunityStore,
  newMemoryState,
  type MemoryState,
} from "../opportunities/memory-store";
import { PROFILE, defaultReport } from "../opportunities/fixtures";
import { SUPPLY_FLOOR_DAYS } from "../../src/lib/config/constants";
import { writableDays } from "../../src/lib/opportunities/rank/open";

/** One open, ready row on a "best X" search — a listicle by its words, so
 *  D52 lets one of these out a week. */
function listicle(n: number): OpportunityRow {
  const query = `best onboarding tool ${n}`;
  return {
    id: `opp-${n}`,
    site_id: SITE_ID,
    scan_id: SCAN_ID,
    type: "answer_page",
    family: "write",
    target_query: query,
    target_ref: query.replace(/[^a-z0-9]+/g, "-"),
    proposed_slug: query.replace(/[^a-z0-9]+/g, "-"),
    title: null,
    volume: 90,
    evidence: {
      family: "write",
      query,
      volume: measured(90, AT),
      rival: { domain: "appcues.com", url: measured("https://appcues.com/a", AT), position: measured(1, AT) },
    },
    acceptance: { form: "top20", query },
    fit_band: "winnable",
    effort: 0.5,
    status: "open",
    cluster_key: null,
    absorbed_queries: [],
    ready: true,
    unready_reason: null,
    created_at: AT.toISOString(),
  } as OpportunityRow;
}

let drafts: MemoryStore;
/** Questions in the fixture business's own words: §6.7's relevance guard
 *  keeps a refill to those (issue 1549). */
const ON_VOCABULARY = [
  "How to get new users to first success?",
  "What is user onboarding software?",
  "What is a product tour?",
  "What is SaaS onboarding?",
  "How to get users to first success with product tours?",
  "What are product tours in SaaS?",
  "How do SaaS teams do user onboarding?",
  "What is onboarding software for product teams?",
  "What does onboarding software do?",
  "What is new user onboarding?",
  "How do product teams do SaaS onboarding?",
];

let state: MemoryState;
let atFirstCost: number[];

beforeEach(() => {
  atFirstCost = [];
  llmMock.mockReset();
  llmMock.mockImplementation(() => {
    throw new Error("no model in this suite");
  });
  readMeasuredTextMock.mockResolvedValue([]);
  withCostContextMock.mockReset();
  // The day's page opens the first cost context. The refill has finished
  // by then, so what it wrote is read here and the page is stopped.
  withCostContextMock.mockImplementation(async () => {
    atFirstCost.push(refilled().length);
    throw new Error("the day's page, not this suite's subject");
  });
  transitionMock.mockResolvedValue({ ok: true, state: "needs_attention" });

  // The site's latest stored scan is the onboarding market its rows and
  // questions are from.
  drafts = generateStore({ storedReport: defaultReport() });
  setGenerateStore(drafts);
  state = newMemoryState({
    profile: PROFILE,
    report: defaultReport(),
    now: AT,
    rows: Array.from({ length: 6 }, (_, n) => listicle(n)),
    asked: [
      {
        term: "best user onboarding software",
        peopleAlsoAsk: ON_VOCABULARY,
        related: [],
        at: AT,
      },
    ],
  });
  setOpportunityStore(opportunityStore(state));
});

afterEach(() => {
  setGenerateStore(null);
  setOpportunityStore(null);
  vi.restoreAllMocks();
});

/** One evening's run; the day's page itself is stopped at its cost context. */
const evening = (publishDate: string) => generateDayPage({ siteId: SITE_ID, publishDate, now: AT }).catch(() => null);

const refilled = () => state.rows.filter((r) => (r.evidence as { askedBeside?: unknown }).askedBeside !== undefined);

describe("the evening run refills a short site from its stored scan (issue 1549)", () => {
  it("leaves at least two weeks of writable days, at 0¢, and a second evening adds none", async () => {
    expect(await writableDays(SITE_ID, AT)).toBeLessThan(SUPPLY_FLOOR_DAYS);

    await evening("2026-09-19");

    expect(await writableDays(SITE_ID, AT)).toBeGreaterThanOrEqual(SUPPLY_FLOOR_DAYS);
    const first = refilled().length;
    expect(first).toBeGreaterThan(0);
    // Written before the day's page opened any cost context, with no model.
    expect(atFirstCost).toEqual([first]);
    expect(llmMock).not.toHaveBeenCalled();

    await evening("2026-09-20");
    expect(refilled().length).toBe(first);
  });

  it("where the stored questions run out first, it writes the ones on the business's words, and once", async () => {
    state.asked = [{ term: "best user onboarding software", peopleAlsoAsk: ["What is a product tour?", "What is SaaS onboarding?", "What is aeo in medical terms?"], related: [], at: AT }];

    await evening("2026-09-19");
    expect(refilled().map((r) => r.target_query).sort()).toEqual(["what is a product tour", "what is saas onboarding"]);

    await evening("2026-09-20");
    expect(refilled()).toHaveLength(2);
  });
});
