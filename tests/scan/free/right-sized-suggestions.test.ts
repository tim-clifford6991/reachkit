// tests/scan/free/right-sized-suggestions.test.ts — issue 846
//
// An established category, through the real free pass: the route, the
// pipeline, the cost seam and its ledger, the market chain and selection
// are all real. DataForSEO is doubled at the global `fetch` its transport
// issues, and the double answers `keyword_suggestions` the way the vendor
// documents it: it applies the request's `filters` and `order_by`, then its
// `limit`. Without a filter it returns the seed's top rows by volume — the
// production scan of 2026-09-17 (848 ranked keywords, a category whose top
// suggestions are 165 000/mo) that bought fifty outsized rows and stored no
// question at all.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, type DbQuery } from "../run/harness";
import { CAPS } from "../../../src/lib/config/constants";
import { toolUseMessage } from "../../llm/fixtures";
import type { FetchOutcome, RobotsPolicy } from "../../../src/lib/egress/types";

const DOMAIN = "acme.com";
const OWN_RANKED = 848;
const CEILING = 8480; // max(1000, 10 × 848)

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

const HOME_HTML = `<!doctype html><html><head><title>Acme</title></head><body>
  <h1>Project management software for teams</h1>
  <h2>What is project management software?</h2>
  <p>One place for projects, tasks and client work. Teams that plan in one
     place ship 20% more on time, according to our 2026 survey of 900 teams.</p>
  <a href="/pricing">Pricing</a>
</body></html>`;

const PRICING_HTML = `<!doctype html><html><body><h1>Pricing</h1>
  <h2>What does it cost?</h2><p>One flat price of 99 euro per month, with
  unlimited users and a 30 day trial.</p></body></html>`;

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
  category: "project management software",
  job: "run projects and client work in one place",
  offeringType: "saas",
  audienceTerms: ["teams", "agencies"],
  namedRivals: ["asana"],
  vocabulary: ["project management", "task management", "team collaboration"],
  brandTokens: ["acme"],
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

/** The seed's whole suggestion universe at the vendor: a head of outsized
 *  construction variants (the incident's rows), then a right-sized long
 *  tail the top-50 read never reached. */
const UNIVERSE: { keyword: string; volume: number }[] = [
  ...Array.from({ length: 28 }, (_, i) => ({ keyword: `construction project management software ${i + 1}`, volume: 165_000 })),
  { keyword: "construction project management software free", volume: 27_100 },
  { keyword: "project management software for construction", volume: 18_100 },
  { keyword: "construction project management software reviews", volume: 14_800 },
  { keyword: "construction project management software list", volume: 8_100 },
  ...Array.from({ length: 30 }, (_, i) => ({ keyword: `project management software ${i + 30_000}`, volume: 100_000 - i * 100 })),
  { keyword: "best project management software for agencies", volume: 2_400 },
  { keyword: "project management software pricing", volume: 1_900 },
  { keyword: "asana alternatives for project management", volume: 1_600 },
  { keyword: "project management software for small teams", volume: 1_300 },
  { keyword: "project management software comparison", volume: 1_000 },
  { keyword: "project management software for client work", volume: 880 },
  { keyword: "simple project management software", volume: 720 },
  { keyword: "project management software with time tracking", volume: 590 },
  { keyword: "project management software for marketing teams", volume: 480 },
  { keyword: "top project management software for startups", volume: 390 },
  { keyword: "project management software with client portal", volume: 320 },
  { keyword: "flat price project management software", volume: 260 },
  { keyword: "project management software for remote teams", volume: 210 },
  { keyword: "project management software unlimited users", volume: 170 },
];

type Condition = [string, string, number];

/** The vendor's documented behaviour for one flat `[cond, "and", cond]`
 *  filter and a `field,desc` order: filter, order, then `limit`. */
function answerSuggestions(task: Record<string, unknown>): unknown[] {
  const conditions = ((task.filters as unknown[] | undefined) ?? []).filter((f): f is Condition => Array.isArray(f));
  const kept = UNIVERSE.filter((row) =>
    conditions.every(([field, op, value]) => {
      expect(field).toBe("keyword_info.search_volume");
      return op === ">=" ? row.volume >= value : op === "<=" ? row.volume <= value : false;
    })
  );
  kept.sort((a, b) => b.volume - a.volume);
  return kept.slice(0, Number(task.limit)).map((row) => ({ keyword: row.keyword, keyword_info: { search_volume: row.volume } }));
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
          keyword_data: { keyword: "acme app", keyword_info: { search_volume: 40 } },
          ranked_serp_element: { serp_item: { rank_group: 1, url: `https://${DOMAIN}/` } },
        },
      ],
    });
  }
  return envelope({
    items: [
      { type: "organic", rank_group: 1, domain: "asana.com", url: "https://asana.com/", title: "Asana" },
      { type: "organic", rank_group: 2, domain: "monday.com", url: "https://monday.com/", title: "Monday" },
      { type: "ai_overview", asynchronous_ai_overview: true, references: [{ domain: "asana.com" }] },
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
  scanId = `8468468${run}-8468-4846-8846-846846846846`;
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

describe("an established category buys its right-sized market, not its head (issue 846)", () => {
  it("the fixture is the incident: the seed's top 50 by volume hold no row under the ceiling", () => {
    const top = answerSuggestions({ limit: 50 });
    expect(top).toHaveLength(50);
    expect(top.every((row) => (row as { keyword_info: { search_volume: number } }).keyword_info.search_volume > CEILING)).toBe(true);
  });

  it("the free pass asks for 10–8480/mo, stores questions, is not market_too_small, and spends inside the free cap", async () => {
    const stored = await scan();

    const suggestions = vendorRequests.filter((r) => r.url.includes("keyword_suggestions"));
    expect(suggestions.length).toBeGreaterThan(0);
    for (const request of suggestions) {
      expect(request.task.filters).toEqual([
        ["keyword_info.search_volume", ">=", 10],
        "and",
        ["keyword_info.search_volume", "<=", CEILING],
      ]);
      expect(request.task.order_by).toEqual(["keyword_info.search_volume,desc"]);
    }

    const report = stored.p_report as { questions: { kind: string; value?: unknown[] } };
    expect(report.questions.kind).not.toBe("unmeasured");
    expect(report.questions.value?.length ?? 0).toBeGreaterThan(0);

    const passes = logLines.filter((line) => line.includes('"event":"scan_pass"'));
    expect(passes).toHaveLength(1);
    expect(passes[0]).not.toContain("market_too_small");

    const spent = db.queries
      .filter((q) => q.table === "fetches" && q.verb === "insert")
      .reduce((total, q) => total + Number(q.values?.cost_cents), 0);
    expect(spent).toBeLessThanOrEqual(CAPS.FREE_C);
    expect(Number(stored.p_cost_cents)).toBeLessThanOrEqual(CAPS.FREE_C);
  }, 30_000);
});
