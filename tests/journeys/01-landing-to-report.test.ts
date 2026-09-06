// tests/journeys/01-landing-to-report.test.ts — BUILD §3, §4.1
//
// Journey: / → /scan/{domain}: a stranger scans and reads a report
// (JN-001 steps 1–8, JN-006).
//
// End to end, at the seams and no further in. Everything the product owns
// is real: the API route, admission, the pipeline, the cost seam and its
// ledger, the measurement, the market chain, the two cards, the verdict,
// the assembly and the store. Four things outside the process are doubled,
// each at the last line of our own code:
//
//   · the customer's own server        → `safeFetch` / `readRobots`
//   · DataForSEO                       → the global `fetch` the vendor
//                                        transport issues
//   · Anthropic                        → the SDK client `llm()` constructs
//   · Postgres                         → a PostgREST-shaped double
//
// So the money is real money: every vendor and model call runs through
// `recordFetch`, every one writes a `fetches` row, and the ledger this
// suite adds up is the one the product would have written. The promise it
// decides is §6.1's — a free scan spends no more than `CAP_FREE`.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, type DbQuery } from "../scan/run/harness";
import { CAPS } from "../../src/lib/config/constants";
import type { FetchOutcome, RobotsPolicy } from "../../src/lib/egress/types";


const DOMAIN = "example.com";

/** One scan id per journey: `stages.ts`'s stream is per-scan and closes on
 *  its one `ending`, so a second pass under the same id would find a
 *  stream that is already done. */
let scanId = "";
let journey = 0;

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

// ── The customer's own server ───────────────────────────────────────────

const HOME_HTML = `<!doctype html><html><head><title>Example</title></head><body>
  <h1>User onboarding software for product teams</h1>
  <h2>What is user onboarding?</h2>
  <p>Onboarding is how a new user reaches their first success. Teams that
     guide the first session see 30% more activation in the first 7 days,
     according to our 2026 benchmark of 1,200 accounts.</p>
  <h2>How do I build a product tour?</h2>
  <p>Point at the element, write one sentence, publish. Most teams ship a
     first tour in about 20 minutes without an engineer.</p>
  <a href="/pricing">Pricing</a>
</body></html>`;

const PRICING_HTML = `<!doctype html><html><body><h1>Pricing</h1>
  <h2>What does it cost?</h2><p>Plans start at 49 euro per month, billed
  monthly, with no seat minimum and a 14 day trial.</p></body></html>`;

const READ_AT = new Date("2026-09-05T10:00:00.000Z");

vi.mock("@/lib/egress/safe-fetch", () => ({
  safeFetch: async (url: string): Promise<FetchOutcome> => {
    const html = url.includes("/pricing") ? PRICING_HTML : HOME_HTML;
    return { ok: true, status: 200, url, html, bytes: html.length, readAt: READ_AT };
  },
}));

vi.mock("@/lib/egress/robots", () => ({
  readRobots: async (origin: string): Promise<RobotsPolicy> => ({
    ok: true,
    origin,
    readAt: READ_AT,
    disallowsAll: false,
    disallowedAgents: { gptbot: true },
    sitemaps: [],
    absent: false,
  }),
}));

// ── Anthropic ───────────────────────────────────────────────────────────

const PROFILE_ANSWER = {
  category: "user onboarding software",
  job: "get new users to their first success",
  offeringType: "saas",
  audienceTerms: ["product teams", "saas"],
  namedRivals: ["appcues"],
  vocabulary: ["onboarding", "product tours", "activation"],
  brandTokens: ["example"],
};

const modelCalls: string[] = [];

vi.mock("@anthropic-ai/sdk", () => {
  class FakeAnthropic {
    messages = {
      create: async (request: { messages: { content: string }[] }) => {
        const input = request.messages[0]?.content ?? "";
        modelCalls.push(input);
        const answer = input.includes('"home"')
          ? PROFILE_ANSWER
          : (JSON.parse(input) as { id: string; keyword: string }[]).map((row) => ({
              id: row.id,
              text: `What's the best ${row.keyword}?`,
            }));
        return {
          content: [{ type: "text", text: JSON.stringify(answer) }],
          usage: { input_tokens: 900, output_tokens: 220 },
        };
      },
    };
  }
  return { default: FakeAnthropic };
});

// ── DataForSEO ──────────────────────────────────────────────────────────

const SUGGESTIONS = [
  "best user onboarding software",
  "user onboarding tools",
  "user onboarding platform",
  "appcues alternatives",
  "top user onboarding apps",
  "how to improve user onboarding",
  "user onboarding software for saas",
  "product tours software",
  "user activation tools",
  "user onboarding checklist software",
  "in app onboarding platform",
  "user onboarding app",
  "what is user onboarding",
  "best product tours tool",
  "product tours platform for saas",
  "user activation software",
  "onboarding software for product teams",
];

function envelope(result: unknown): unknown {
  return { tasks: [{ id: "task-fixture", status_code: 20000, status_message: "Ok.", result: [result] }] };
}

const vendorRequests: { url: string; task: Record<string, unknown> }[] = [];

function vendorAnswer(url: string): unknown {
  if (url.includes("keyword_suggestions")) {
    return envelope({
      items: SUGGESTIONS.map((keyword, i) => ({
        keyword,
        keyword_info: { search_volume: 4000 - i * 120 },
      })),
    });
  }
  if (url.includes("ranked_keywords")) {
    // A cold start: the customer ranks for nothing. A measurement, never
    // an error (§6.6).
    return envelope({ items: [] });
  }
  return envelope({
    items: [
      { type: "organic", rank_group: 1, domain: "appcues.com", url: "https://appcues.com/", title: "Appcues" },
      { type: "organic", rank_group: 2, domain: "userpilot.com", url: "https://userpilot.com/", title: "Userpilot" },
      { type: "organic", rank_group: 3, domain: "reddit.com", url: "https://reddit.com/r/saas", title: "Reddit" },
      {
        type: "ai_overview",
        asynchronous_ai_overview: true,
        references: [{ domain: "appcues.com" }, { domain: "userpilot.com" }],
      },
    ],
  });
}

// ── The database ────────────────────────────────────────────────────────

/** One table serves several different reads; the filters say which. */
function answerQuery(query: DbQuery): unknown[] | null {
  if (query.verb !== "select") return null;
  if (query.table === "domain_blocks") return [];
  if (query.table === "fetches") return []; // every call is a cache miss
  if (query.table !== "scans") return null;

  const columns = new Map(query.filters);
  // The progress stream asking whether this scan exists at all.
  if (columns.has("id")) return [{ id: scanId }];
  // The pipeline adopting the row admission claimed.
  if (columns.get("status") === "running" && columns.get("tier") === "free" && columns.has("domain")) {
    return [{ id: scanId, fromIncompleteRescan: false }];
  }
  // Every admission counter, the cooldown read, and the current-report
  // read: this domain has never been scanned before.
  return [];
}

beforeEach(() => {
  db.reset();
  modelCalls.length = 0;
  vendorRequests.length = 0;
  journey += 1;
  scanId = `5555555${journey}-5555-4555-8555-555555555555`;
  db.answer = answerQuery;
  db.singles.set("scans", { id: scanId });

  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const body = typeof init?.body === "string" ? (JSON.parse(init.body) as unknown[]) : [];
      vendorRequests.push({ url, task: (body[0] ?? {}) as Record<string, unknown> });
      return { ok: true, status: 200, statusText: "OK", json: async () => vendorAnswer(url) };
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** The `fetches` rows the pass wrote — the ledger, as the product would
 *  have stored it. */
function ledger(): { source: string; costCents: number }[] {
  return db.queries
    .filter((q) => q.table === "fetches" && q.verb === "insert")
    .map((q) => ({
      source: String(q.values?.source),
      costCents: Number(q.values?.cost_cents),
    }));
}

/** The whole journey: the landing field's submission, and the report
 *  screen's own progress stream read to the pass's one `ending` — which is
 *  also how this test waits for a pipeline the route deliberately does not
 *  await. */
async function walkTheJourney(value: string): Promise<{ body: { ok: true; location: string; scanId: string }; stages: string[] }> {
  const { POST } = await import("../../src/app/api/scan/route");
  const { progress } = await import("../../src/lib/scan/stages");

  const started = await POST(
    new Request("https://app.example.com/api/scan", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `203.0.113.${journey}` },
      body: JSON.stringify({ value }),
    })
  );
  expect(started.status).toBe(200);
  const body = (await started.json()) as { ok: true; location: string; scanId: string };

  const stages: string[] = [];
  for await (const event of progress(body.scanId)) {
    if ("stage" in event) stages.push(`${event.stage}:${event.done ? "done" : "enter"}`);
    if ("ending" in event) {
      expect(event.ending).toEqual({ kind: "report", complete: true, stoppedReason: "complete" });
      break;
    }
  }
  return { body, stages };
}

function storedReport(): Record<string, unknown> {
  const call = db.rpcCalls.find((c) => c.fn === "store_current_report");
  if (!call) throw new Error("the pass stored no report");
  return call.args.p_report as Record<string, unknown>;
}

describe("/ → /scan/{domain}: a stranger scans and reads a report (JN-001, JN-006)", () => {
  const EVERY_STAGE = [
    "reading_your_site:enter",
    "reading_your_site:done",
    "reading_access_rules:enter",
    "reading_access_rules:done",
    "reading_your_market:enter",
    "reading_your_market:done",
    "checking_your_presence:enter",
    "checking_your_presence:done",
    "asking_the_twelve:enter",
    "asking_the_twelve:done",
    "scoring:enter",
    "scoring:done",
  ];

  // A whole free pass: two model calls and twelve live SERPs through the
  // real cost seam. Slower than a unit default, well inside the ninety
  // seconds the pass itself is bounded by.
  const JOURNEY_TIMEOUT_MS = 30_000;

  it("takes a typed domain, claims a scan, runs the six stages and leaves one stored report", async () => {
    // Step 1 — the landing field: one field, one button, any written form
    // of the domain. Steps 2–7 — the report screen opens the progress
    // stream on its first frame and watches the pass the POST started.
    const { body, stages } = await walkTheJourney("HTTPS://WWW.Example.com/pricing");

    expect(body.ok).toBe(true);
    // Every written form arrives at the one address for the domain.
    expect(body.location).toBe(`/scan/${DOMAIN}`);
    expect(body.scanId).toBe(scanId);
    expect(stages).toEqual(EVERY_STAGE);

    // Step 8 — the report the screen reads is in the store, it is the one
    // this pass measured, and it is the domain's current one.
    const report = storedReport();
    expect(report.domain).toBe(DOMAIN);
    expect(report.tier).toBe("free");
    expect(report.complete).toBe(true);
    expect(report.stoppedReason).toBe("complete");
    expect(report.scanId).toBe(scanId);
    expect(db.rpcCalls.filter((c) => c.fn === "store_current_report")).toHaveLength(1);
    expect(db.rpcCalls[0]?.args.p_make_current).toBe(true);
    expect(db.rpcCalls[0]?.args.p_status).toBe("done");
  }, JOURNEY_TIMEOUT_MS);

  it("the report it leaves carries every section §4.1 renders", async () => {
    await walkTheJourney(DOMAIN);

    const report = storedReport();
    const verdict = report.verdict as { scoreAndBand: { kind: string; value?: { score: number; band: string } } };
    const answers = report.aiAnswers as {
      measuredSearches: number;
      answeredSearches: number;
      customerCitations: number;
      rows: { question: { n: number; search: string; namedBrands: string[] } }[];
      rivals: { domain: string; cells: unknown[] }[];
      coverage: string;
    };
    const presence = report.presence as {
      measuredSearches: number;
      you: { top10Count: number };
      rivals: unknown[];
      absentFrom: unknown[];
    };

    // The verdict: a score, its band word, and the factor holding it down.
    expect(verdict.scoreAndBand.kind).not.toBe("unmeasured");
    expect(typeof verdict.scoreAndBand.value?.score).toBe("number");
    expect(typeof verdict.scoreAndBand.value?.band).toBe("string");

    // The AI-answers card, over the twelve the market yielded.
    expect(answers.rows).toHaveLength(12);
    expect(answers.measuredSearches).toBe(12);
    expect(answers.answeredSearches).toBe(12);
    // The customer is cited in none of them — the report's whole point.
    expect(answers.customerCitations).toBe(0);
    expect(answers.coverage).toBe("async_included");
    // One dot-matrix row per rival, one cell per question on each.
    expect(answers.rivals.length).toBeGreaterThan(0);
    for (const rival of answers.rivals) expect(rival.cells).toHaveLength(12);
    // Each question is numbered and carries the search it came from.
    expect(answers.rows.map((row) => row.question.n)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
    expect(answers.rows[0]?.question.search).toBeTypeOf("string");

    // The Google-presence card: a cold start reads 0 as a measurement.
    expect(presence.measuredSearches).toBe(12);
    expect(presence.you.top10Count).toBe(0);
    expect(presence.rivals.length).toBeGreaterThan(0);
    expect(presence.absentFrom.length).toBeGreaterThan(0);

    // Rivals came from the market's own SERPs; the platform hit did not.
    const rivals = report.rivals as { value: { domain: string }[] };
    expect(rivals.value.map((r) => r.domain)).toEqual(expect.arrayContaining(["appcues.com", "userpilot.com"]));
    expect(rivals.value.map((r) => r.domain)).not.toContain("reddit.com");
    expect(report.sources).toEqual(["reddit.com"]);

    // No section is omitted, and each says what it is.
    // The screen's own sections, and the record beside them.
    expect(report.blockedAgents).toBeDefined();
    expect(report.category).toBe("user onboarding software");
    for (const section of ["market", "questions", "serps", "onPage", "robots", "coherence", "correctionState"]) {
      expect(report[section]).toBeDefined();
    }
    expect((report.market as { kind: string }).kind).not.toBe("unmeasured");
    expect((report.serps as unknown[])).toHaveLength(12);
    expect(report.correctionState).toBe("none");
  }, JOURNEY_TIMEOUT_MS);

  it("spends no more than the free cap, and every cent of it is ledgered", async () => {
    await walkTheJourney(DOMAIN);

    const rows = ledger();
    const spent = rows.reduce((total, row) => total + row.costCents, 0);

    // §6.1: `CAP_FREE` is 12¢, and §6.3 budgets the free scan at
    // about 6.3¢ before ADR-094's AI-Overview surcharge.
    expect(spent).toBeGreaterThan(0);
    expect(spent).toBeLessThanOrEqual(CAPS.FREE_C);
    expect(Number(db.rpcCalls[0]?.args.p_cost_cents)).toBeLessThanOrEqual(CAPS.FREE_C);

    // The closed list, and nothing outside it (§6.3). The free path makes
    // zero AI Optimization API calls and buys no `competitors_domain`.
    const sources = new Set(rows.map((row) => row.source));
    expect(sources).toContain("dataforseo_labs/google/keyword_suggestions");
    expect(sources).toContain("dataforseo_labs/google/ranked_keywords");
    expect(sources).toContain("serp/google/organic");
    expect([...sources].some((source) => source.includes("ai_mode") || source.includes("llm_responses"))).toBe(false);
    expect([...sources].some((source) => source.includes("competitors_domain"))).toBe(false);

    // Twelve SERPs, live, each carrying the one admitted never-list flag
    // and none of the flags the never-list forbids.
    const serpTasks = vendorRequests.filter((r) => r.url.includes("/serp/google/organic"));
    expect(serpTasks).toHaveLength(12);
    for (const request of serpTasks) {
      expect(request.url).toContain("/live/advanced");
      expect(request.task.load_async_ai_overview).toBe(true);
      expect(request.task.depth).toBe(10);
      expect(request.task.location_name).toBe("United States");
    }

    // Two model calls — the profile and the wording — both nano, both
    // ledgered through the same seam as the vendor rows.
    expect(modelCalls).toHaveLength(2);
    expect(rows.filter((row) => row.source === "profile" || row.source === "question-phrasing")).toHaveLength(2);
    expect(rows.filter((row) => row.source === "serp/google/organic")).toHaveLength(12);
  }, JOURNEY_TIMEOUT_MS);
});
