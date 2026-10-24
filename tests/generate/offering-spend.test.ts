// SPEC §7 (SEO shape ruling on issue 1618, 2026-10-20) — an offering page is
// written from the business's own facts: it buys no research. Its questions
// are the "People also ask" its search's stored SERP already holds, so it
// costs no more than the type it replaces. Through `generateDayPage` over
// the in-memory stores; no vendor or model is reached.
import "./env";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { llmMock, readMeasuredTextMock, withCostContextMock, transitionMock, researchMock, packed } = vi.hoisted(() => ({
  llmMock: vi.fn(),
  readMeasuredTextMock: vi.fn(),
  withCostContextMock: vi.fn(),
  transitionMock: vi.fn(),
  researchMock: vi.fn(),
  packed: [] as unknown[],
}));
vi.mock("@/lib/generate/pipeline/research", async (importOriginal) => ({ ...(await importOriginal<object>()), researchMarket: researchMock }));
vi.mock("@/lib/generate/pipeline/pack", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/lib/generate/pipeline/pack")>();
  return { ...actual, buildPack: (a: Parameters<typeof actual.buildPack>[0]) => (packed.push(a.research), actual.buildPack(a)) };
});
vi.mock("@/lib/llm", () => ({ llm: llmMock }));
vi.mock("@/lib/generate/voice/confirmed", () => ({ confirmedForWriting: async () => ({ profile: null, factsOff: [] }), refusedPassages: async () => [] }));
vi.mock("@/lib/measure/text", () => ({ readMeasuredText: readMeasuredTextMock }));
vi.mock("@/lib/generate/pipeline/report-facts", () => ({ readReportPage: async () => null }));
vi.mock("@/lib/costs", () => ({ withCostContext: withCostContextMock }));
vi.mock("@/lib/publish/machine", () => ({ transition: transitionMock }));
vi.mock("@/lib/site-profile/crawl", () => ({ crawlSite: vi.fn() }));

import { measured } from "../../src/lib/measure/measured";
import type { StoredReport } from "../../src/lib/scan/report";
import { setOpportunityStore, type OpportunityRow } from "../../src/lib/opportunities/store";
import { setGenerateStore } from "../../src/lib/generate/store";
import { generateDayPage } from "../../src/lib/generate";
import { memoryStore as generateStore, report, AT, GROUNDED, SCAN_ID, SITE_ID, SOURCE_TEXT } from "./fixtures";
import { memoryStore as opportunityStore, newMemoryState } from "../opportunities/memory-store";
import { PROFILE, defaultReport } from "../opportunities/fixtures";

const SEARCH = "seo brief software for startups";
const ASKED = "Is there a free plan for a small team?";

function offeringRow(shape: boolean): OpportunityRow {
  const volume = measured(40, AT);
  return {
    id: "opp-offer",
    site_id: SITE_ID,
    scan_id: SCAN_ID,
    type: "answer_page",
    family: "write",
    target_query: SEARCH,
    target_ref: "seo-brief-software-for-startups",
    proposed_slug: "seo-brief-software-for-startups",
    title: null,
    volume: 40,
    evidence: { family: "write", query: SEARCH, volume, rival: { domain: "zapier.com", url: measured("https://zapier.com/plans", AT), position: measured(1, AT) }, ...(shape ? { shape: "offering" } : {}) },
    acceptance: { form: "named_on", question: `What does ${SEARCH} cost?` },
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

let reads: string[];

function standUp(shape: boolean): void {
  reads = [];
  const drafts = generateStore();
  // The report's own SERP for the search, bought by the scan, with what buyers ask beside it.
  drafts.storedReport = {
    ...report(),
    questions: measured([{ text: `What does a ${SEARCH} cost?`, search: { keyword: SEARCH } }], AT),
    serps: [measured({ organic: [], peopleAlsoAsk: [ASKED] }, AT)],
  } as unknown as StoredReport;
  setGenerateStore(drafts);
  setOpportunityStore(opportunityStore(newMemoryState({ profile: PROFILE, report: defaultReport(), rows: [offeringRow(shape)] })));
}

beforeEach(() => {
  packed.length = 0;
  llmMock.mockReset();
  researchMock.mockReset();
  researchMock.mockResolvedValue({ facts: [], products: [] });
  readMeasuredTextMock.mockResolvedValue([{ url: GROUNDED.url, text: SOURCE_TEXT, measuredAt: GROUNDED.readAt }]);
  transitionMock.mockResolvedValue({ ok: true, state: "needs_attention" });
  withCostContextMock.mockImplementation(async (_ctx: unknown, run: (c: unknown) => Promise<unknown>) =>
    run({
      cap: "DRAFT",
      recordFetch: async (call: { cacheKey: string }) => {
        reads.push(call.cacheKey);
        throw new Error("a paid read");
      },
      capHit: () => false,
      spentCents: () => 0,
      degraded: () => false,
    })
  );
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  setGenerateStore(null);
  setOpportunityStore(null);
  vi.restoreAllMocks();
});

describe("an offering page buys no research", () => {
  it("runs no research step and no paid read, and takes its questions from the stored People also ask", async () => {
    standUp(true);
    await generateDayPage({ siteId: SITE_ID, publishDate: "2026-10-21" });

    expect(researchMock).not.toHaveBeenCalled();
    expect(reads).toEqual([]);
    expect(packed).toEqual([{ facts: [], products: [], asked: { peopleAlsoAsk: [ASKED], related: [] } }]);
  });

  it("the same row as the Q&A it would otherwise be does run the research step", async () => {
    standUp(false);
    await generateDayPage({ siteId: SITE_ID, publishDate: "2026-10-21" });

    expect(researchMock).toHaveBeenCalledTimes(1);
  });
});
