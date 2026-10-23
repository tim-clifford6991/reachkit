// A day whose research DataForSEO refuses for lack of credit writes no page
// and keeps the vendor's cause as the day's reason, which the missing-page
// mail then carries. Through the engine's `generateDraft`, the real research
// step and the real cost seam; DataForSEO answers every call with the
// vendor's documented refusal, and every public page read is refused.
import "./env";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb } from "../scan/run/harness";
import { stubVendorFetch } from "../vendors/harness";

const db = fakeDb();
const { llmMock, transitionMock } = vi.hoisted(() => ({ llmMock: vi.fn(), transitionMock: vi.fn() }));
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));
vi.mock("@/lib/costs/daily", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/lib/costs/daily")>()),
  openDayLedger: async () => ({ spentCents: () => 0, refresh: async () => {}, ceilingReached: () => false, add: () => {} }),
}));
vi.mock("@/lib/llm", () => ({ llm: llmMock }));
vi.mock("@/lib/egress/safe-fetch", () => ({
  safeFetch: async (url: string) => ({ ok: false, reason: "refused", url, status: null }),
}));
vi.mock("@/lib/generate/voice/confirmed", () => ({ confirmedForWriting: async () => ({ profile: null, factsOff: [] }), refusedPassages: async () => [] }));
vi.mock("@/lib/measure/text", () => ({ readMeasuredText: async () => [] }));
vi.mock("@/lib/generate/pipeline/report-facts", () => ({ readReportPage: async () => null }));
vi.mock("@/lib/publish/machine", () => ({ transition: transitionMock }));

import { measured } from "../../src/lib/measure/measured";
import type { OpportunityRow } from "../../src/lib/opportunities/store";
import { setOpportunityStore } from "../../src/lib/opportunities/store";
import { setGenerateStore } from "../../src/lib/generate/store";
import { setDraftDayStore, type DraftDayStore } from "../../src/lib/publish/daily";
import { generateDraft } from "../../src/jobs/engine";
import { memoryStore as generateStore, AT, SCAN_ID, SITE_ID } from "./fixtures";
import { memoryStore as opportunityStore, newMemoryState } from "../opportunities/memory-store";
import { PROFILE, defaultReport } from "../opportunities/fixtures";

const SEARCH = "seo brief software for startups";
const REFUSED = JSON.parse(readFileSync(new URL("../vendors/fixtures/funds-refused-top-level.json", import.meta.url), "utf8")) as unknown;

/** A Q&A row: its research buys the search's SERP and its questions' volume. */
function qaRow(): OpportunityRow {
  const volume = measured(40, AT);
  return {
    id: "opp-qa",
    site_id: SITE_ID,
    scan_id: SCAN_ID,
    type: "answer_page",
    family: "write",
    target_query: SEARCH,
    target_ref: "seo-brief-software-for-startups",
    proposed_slug: "seo-brief-software-for-startups",
    title: null,
    volume: 40,
    evidence: { family: "write", query: SEARCH, volume, rival: { domain: "zapier.com", url: measured("https://zapier.com/plans", AT), position: measured(1, AT) } },
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

let drafts: ReturnType<typeof generateStore>;
let warned: string[];

beforeEach(() => {
  db.reset();
  llmMock.mockReset();
  drafts = generateStore();
  setGenerateStore(drafts);
  setOpportunityStore(opportunityStore(newMemoryState({ profile: PROFILE, report: defaultReport(), rows: [qaRow()] })));
  setDraftDayStore({ draftedBefore: async () => false } as unknown as DraftDayStore);
  warned = [];
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation((line: unknown) => void warned.push(String(line)));
});

afterEach(() => {
  setGenerateStore(null);
  setOpportunityStore(null);
  setDraftDayStore(null);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("a draft day DataForSEO refuses for credit", () => {
  it("writes no page, names the vendor cause as the day's reason, and ledgers the refusal at 0¢", async () => {
    const vendor = stubVendorFetch(() => REFUSED);

    const day = await generateDraft({ siteId: SITE_ID, publishDate: "2026-10-21", now: AT });

    // The research asked the vendor, and the vendor refused.
    expect(vendor.requests.length).toBeGreaterThan(0);
    const rows = db.queries.filter((q) => q.table === "fetches" && q.verb === "insert" && String(q.values?.source).includes("/"));
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row.values).toMatchObject({ cost_cents: 0, payload: { funds: true, billed: false } });
    expect(warned.filter((line) => line.includes('"vendor_funds_refused"'))).toHaveLength(1);

    // The reason `draft/generate` keeps in `draft_days` for the date.
    expect(day).toEqual({ degraded: "generate:vendor_funds" });
    // Nothing was written from unmeasured inputs, so nothing can go out.
    expect(drafts.rows.size).toBe(0);
    expect(transitionMock).not.toHaveBeenCalled();
  });
});
