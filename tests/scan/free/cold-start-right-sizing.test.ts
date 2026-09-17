// tests/scan/free/cold-start-right-sizing.test.ts — issue 858
//
// The owner's walk of reachkit.app (2026-09-17), through the real free
// pass: the route, the pipeline, the cost seam, the market chain and
// selection are real; DataForSEO is doubled at the global `fetch` and
// answers `keyword_suggestions` as the vendor documents it — `filters`
// (nested, "and"/"or", `= null`), `order_by`, then `limit`.
//
// The site ranks for three keywords. On main its free report opened on
// "best seo software" (1 000/mo), "seo software tool" (880) and "ai tool for
// seo" (880): the cold-start demand ceiling was 1 000 and volume was the
// only difficulty signal. Their SERPs belong to zapier.com and ahrefs.com.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, type DbQuery } from "../run/harness";
import { CAPS } from "../../../src/lib/config/constants";
import { difficultyCeiling, qualifyingDemand } from "../../../src/lib/opportunities/winnability/bars";
import { toolUseMessage } from "../../llm/fixtures";
import type { FetchOutcome, RobotsPolicy } from "../../../src/lib/egress/types";

const DOMAIN = "reachkit.app";
const OWN_RANKED = 3;
const HEAD_TERMS = ["best seo software", "seo software tool", "ai tool for seo"];

let scanId = "";
let run = 0;

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));
vi.mock("next/server", () => ({
  after: (task: () => Promise<void>) => {
    void task();
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

// ── The customer's own server ───────────────────────────────────────────

const HOME_HTML = `<!doctype html><html><head><title>ReachKit</title></head><body>
  <h1>SEO content for startups, written every day</h1>
  <h2>What is an SEO content brief?</h2>
  <p>ReachKit writes one right-sized page a day from your market's searches,
     and every page is reviewed before it goes live on your site.</p>
  <a href="/pricing">Pricing</a>
</body></html>`;

const PRICING_HTML = `<!doctype html><html><body><h1>Pricing</h1>
  <h2>What does it cost?</h2><p>One flat price of 49 euro per month for one
  site.</p></body></html>`;

const READ_AT = new Date(Date.now() - 60 * 60 * 1000);

vi.mock("@/lib/egress/safe-fetch", () => ({
  safeFetch: async (url: string): Promise<FetchOutcome> => {
    const html = url.includes("/pricing") ? PRICING_HTML : HOME_HTML;
    return { ok: true, status: 200, url, html, bytes: html.length, readAt: READ_AT, headers: {} };
  },
}));

vi.mock("@/lib/egress/robots", () => ({
  readRobots: async (origin: string): Promise<RobotsPolicy> => ({
    ok: true,
    origin,
    readAt: READ_AT,
    disallowsAll: false,
    disallowedAgents: {},
    sitemaps: [],
    absent: false,
  }),
}));

// ── Anthropic ───────────────────────────────────────────────────────────

const PROFILE_ANSWER = {
  category: "seo software",
  job: "write seo content for startups",
  offeringType: "saas",
  audienceTerms: ["startups", "founders"],
  namedRivals: [],
  vocabulary: ["seo content", "content brief", "ai seo"],
  brandTokens: ["reachkit"],
};

vi.mock("@anthropic-ai/sdk", () => {
  class FakeAnthropic {
    messages = {
      create: async (request: { messages: { content: string }[] }) => {
        const input = request.messages[0]?.content ?? "";
        if (input.includes('"home"')) {
          return { content: [{ type: "text", text: JSON.stringify(PROFILE_ANSWER) }], usage: { input_tokens: 900, output_tokens: 220 } };
        }
        const answer = {
          questions: (JSON.parse(input) as { keywords: { id: string; keyword: string }[] }).keywords.map((row) => ({
            id: row.id,
            text: `What's the best ${row.keyword}?`,
          })),
        };
        return toolUseMessage(answer, 900, 220, "question-phrasing");
      },
    };
  }
  return { default: FakeAnthropic };
});

// ── DataForSEO ──────────────────────────────────────────────────────────

/** Every seed's suggestion universe at the vendor, with the vendor's own
 *  keyword difficulty: the incident's head terms, then specific long-tail
 *  searches a new site can win (one with no difficulty at all). */
const UNIVERSE: { keyword: string; volume: number; difficulty?: number }[] = [
  { keyword: "best seo software", volume: 1000, difficulty: 78 },
  { keyword: "seo software tool", volume: 880, difficulty: 70 },
  { keyword: "ai tool for seo", volume: 880, difficulty: 64 },
  { keyword: "seo software for startups", volume: 260, difficulty: 52 },
  { keyword: "best ai seo content software", volume: 90, difficulty: 22 },
  { keyword: "seo content brief template for startups", volume: 40, difficulty: 8 },
  { keyword: "ai seo content writer for startups", volume: 70, difficulty: 18 },
  { keyword: "seo content brief software", volume: 50, difficulty: 26 },
  { keyword: "how to write an seo content brief", volume: 60, difficulty: 14 },
  { keyword: "seo content for startup founders", volume: 30 },
];

type Condition = [string, string, number | null];
type Filter = Condition | (Filter | "and" | "or")[];

/** One `filters` expression, as the vendor documents it: a condition
 *  `[field, op, value]`, or conditions joined by "and" / "or", nested. */
function holds(row: { volume: number; difficulty?: number }, filter: Filter): boolean {
  if (typeof filter[0] === "string") {
    const [field, op, value] = filter as Condition;
    const actual = field === "keyword_info.search_volume" ? row.volume : field === "keyword_properties.keyword_difficulty" ? (row.difficulty ?? null) : undefined;
    expect(actual).not.toBe(undefined);
    if (op === "=") return actual === value;
    if (actual === null || value === null) return false;
    return op === ">=" ? actual! >= value : op === "<=" ? actual! <= value : false;
  }
  let result = holds(row, filter[0] as Filter);
  for (let i = 1; i < filter.length; i += 2) {
    const next = holds(row, filter[i + 1] as Filter);
    result = filter[i] === "or" ? result || next : result && next;
  }
  return result;
}

/** The vendor's documented behaviour for `filters` and a `field,desc`
 *  order: filter, order, then `limit`. */
function answerSuggestions(task: Record<string, unknown>): unknown[] {
  const filters = task.filters as Filter | undefined;
  const kept = UNIVERSE.filter((row) => filters === undefined || holds(row, filters));
  kept.sort((a, b) => b.volume - a.volume);
  return kept.slice(0, Number(task.limit)).map((row) => ({
    keyword: row.keyword,
    keyword_info: { search_volume: row.volume },
    keyword_properties: { keyword_difficulty: row.difficulty ?? null },
  }));
}

function envelope(result: unknown): unknown {
  return { tasks: [{ id: "task-fixture", status_code: 20000, status_message: "Ok.", result: [result] }] };
}

const vendorRequests: { url: string; task: Record<string, unknown> }[] = [];

function vendorAnswer(url: string, task: Record<string, unknown>): unknown {
  if (url.includes("keyword_suggestions")) return envelope({ items: answerSuggestions(task) });
  if (url.includes("ranked_keywords")) {
    // The site's own footprint: a few rows bought, the vendor's total beside them.
    return envelope({
      total_count: OWN_RANKED,
      items: [
        {
          keyword_data: { keyword: "reachkit", keyword_info: { search_volume: 40 } },
          ranked_serp_element: { serp_item: { rank_group: 1, url: `https://${DOMAIN}/` } },
        },
      ],
    });
  }
  // Every SERP: the giants on top, the small domains of a long-tail search below.
  return envelope({
    items: [
      { type: "organic", rank_group: 1, domain: "zapier.com", url: "https://zapier.com/blog/seo", title: "Zapier" },
      { type: "organic", rank_group: 2, domain: "ahrefs.com", url: "https://ahrefs.com/blog/seo", title: "Ahrefs" },
      { type: "organic", rank_group: 3, domain: "briefkit.io", url: "https://briefkit.io/templates", title: "BriefKit" },
      { type: "ai_overview", asynchronous_ai_overview: true, references: [{ domain: "zapier.com" }] },
    ],
  });
}

// ── The database ────────────────────────────────────────────────────────

function recordedLog(): unknown[] {
  const log: unknown[] = [];
  for (const call of db.rpcCalls) {
    if (call.fn !== "append_scan_stage_event" || call.args.p_scan_id !== scanId) continue;
    if (log.some((event) => typeof event === "object" && event !== null && "ending" in event)) break;
    log.push(call.args.p_event);
  }
  return log;
}

function answerQuery(query: DbQuery): unknown[] | null {
  if (query.verb !== "select") return null;
  if (query.table === "domain_blocks") return [];
  if (query.table === "fetches") return [];
  if (query.table !== "scans") return null;
  const columns = new Map(query.filters);
  if (columns.has("id")) return [{ id: scanId, status: "running", stopped_reason: null, stage_events: recordedLog() }];
  if (columns.get("status") === "running" && columns.get("tier") === "free" && columns.has("domain")) {
    return [{ id: scanId, fromIncompleteRescan: false }];
  }
  return [];
}

const logLines: string[] = [];

beforeEach(() => {
  db.reset();
  vendorRequests.length = 0;
  logLines.length = 0;
  run += 1;
  scanId = `8588588${run}-8588-4858-8858-858858858858`;
  db.answer = answerQuery;
  db.singles.set("scans", { id: scanId });
  vi.spyOn(console, "log").mockImplementation((line: unknown) => {
    logLines.push(String(line));
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const body = typeof init?.body === "string" ? (JSON.parse(init.body) as unknown[]) : [];
      const task = (body[0] ?? {}) as Record<string, unknown>;
      vendorRequests.push({ url, task });
      return { ok: true, status: 200, statusText: "OK", json: async () => vendorAnswer(url, task) };
    })
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function scan(): Promise<Record<string, unknown>> {
  const { POST } = await import("../../../src/app/api/scan/route");
  const { progress } = await import("../../../src/lib/scan/stages");
  const started = await POST(
    new Request("https://app.example.com/api/scan", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `198.51.100.${run}` },
      body: JSON.stringify({ value: DOMAIN }),
    })
  );
  expect(started.status).toBe(200);
  const { scanId: started_id } = (await started.json()) as { scanId: string };
  for await (const event of progress(started_id)) if ("ending" in event) break;
  const store = db.rpcCalls.find((c) => c.fn === "store_current_report");
  if (!store) throw new Error("the pass stored no report");
  return store.args;
}

describe("a cold-start site's free report asks right-sized questions (issue 858)", () => {
  it("the fixture is the incident: without the difficulty filter the window of main admits the head terms", () => {
    const main = answerSuggestions({
      limit: 50,
      filters: [["keyword_info.search_volume", ">=", 10], "and", ["keyword_info.search_volume", "<=", 1000]],
    }) as { keyword: string }[];
    expect(main.map((row) => row.keyword)).toEqual(expect.arrayContaining(HEAD_TERMS));
  });

  it("buys inside the cold-start window, stores only long-tail questions under the ceilings, and spends inside the free cap", async () => {
    const stored = await scan();

    const suggestions = vendorRequests.filter((r) => r.url.includes("keyword_suggestions"));
    expect(suggestions.length).toBeGreaterThan(0);
    for (const request of suggestions) {
      expect(request.task.filters).toEqual([
        ["keyword_info.search_volume", ">=", 10],
        "and",
        ["keyword_info.search_volume", "<=", qualifyingDemand(OWN_RANKED)],
        "and",
        [
          ["keyword_properties.keyword_difficulty", "<=", difficultyCeiling(OWN_RANKED)],
          "or",
          ["keyword_properties.keyword_difficulty", "=", null],
        ],
      ]);
    }

    const report = stored.p_report as {
      questions: { kind: string; value?: { search: { keyword: string; volume: number; difficulty?: number } }[] };
    };
    expect(report.questions.kind).toBe("measured");
    const searches = (report.questions.value ?? []).map((q) => q.search);
    expect(searches.length).toBeGreaterThan(0);
    for (const head of HEAD_TERMS) expect(searches.map((s) => s.keyword)).not.toContain(head);
    for (const search of searches) {
      expect(search.volume).toBeLessThanOrEqual(qualifyingDemand(OWN_RANKED));
      if (search.difficulty !== undefined) expect(search.difficulty).toBeLessThanOrEqual(difficultyCeiling(OWN_RANKED));
    }
    // Long-tail leads: the first question is a specific search of 3+ words.
    expect(searches[0]!.keyword.split(" ").length).toBeGreaterThanOrEqual(3);
    // The difficulty rides with the question, for derivation to band by.
    expect(searches.find((s) => s.keyword === "seo content brief template for startups")?.difficulty).toBe(8);
    // No SERP is bought for a head term.
    const serps = vendorRequests.filter((r) => r.url.includes("serp/google/organic"));
    for (const head of HEAD_TERMS) expect(serps.filter((r) => r.task.keyword === head)).toEqual([]);

    expect(Number(stored.p_cost_cents)).toBeLessThanOrEqual(CAPS.FREE_C);
  }, 30_000);
});
