// tests/scan/free/profile-list-trim.test.ts — issue 898
//
// The production smoke of `figma.com` on 2026-09-18, through the real free
// pass: the route, the pipeline, the cost seam and its ledger, the market
// chain and selection are all real; DataForSEO is doubled at the global
// `fetch` its transport issues, and `@anthropic-ai/sdk` is doubled at the
// vendor client.
//
// What happened live: the model answered with **seven** brand tokens
// against a cap of six, and the whole seven-field answer was thrown away
// for it — twice, because the seam re-asked the same question. With no
// profile there is no category, so `readMarket` bought no
// `keyword_suggestions` at all and the report stored no question, no score
// and no band. The pass ended `complete`, and nothing the visitor saw said
// why.
//
// Both halves are asserted here: the over-full answer is now kept and the
// pass buys its market, and an answer that really is unusable still fails —
// with the cause named, rather than an empty report that reads as finished.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, type DbQuery } from "../run/harness";
import { PROFILE_LIST_BOUNDS } from "../../../src/lib/config/constants";
import { toolUseMessage } from "../../llm/fixtures";
import type { FetchOutcome, RobotsPolicy } from "../../../src/lib/egress/types";

const DOMAIN = "figma.com";
/** A cold-start site: the demand ceiling sits at its 300/mo floor and the
 *  difficulty ceiling at 30 + 10 × log10(4) ≈ 36. */
const OWN_RANKED = 3;

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

const HOME_HTML = `<!doctype html><html><head><title>Figma</title>
  <meta name="description" content="Design and prototype in one place."></head><body>
  <h1>Design tools for teams</h1>
  <h2>What is a collaborative design tool?</h2>
  <p>One place to design, prototype and hand off. Teams that design in one
     file cut review rounds, according to our 2026 survey of 900 teams.</p>
  <a href="/pricing">Pricing</a>
</body></html>`;

const PRICING_HTML = `<!doctype html><html><body><h1>Pricing</h1>
  <h2>What does it cost?</h2><p>A free tier, and 12 euro per editor per
  month for teams.</p></body></html>`;

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

/** Figma's own shape: a well-known brand with more names for itself than
 *  the cap allows. Seven `brandTokens` against `PROFILE_LIST_BOUNDS`'s six. */
const OVER_FULL_PROFILE = {
  category: "design software",
  job: "design and prototype interfaces with a team",
  offeringType: "saas",
  audienceTerms: ["designers", "product teams"],
  namedRivals: ["sketch"],
  vocabulary: ["design tool", "prototyping tool", "collaborative design"],
  brandTokens: ["figma", "figjam", "figma slides", "dev mode", "figma make", "figma draw", "figma sites"],
};

/** What the model answers to the `profile` call, per test. */
let profileAnswer: unknown = OVER_FULL_PROFILE;
const profileCalls: unknown[] = [];

vi.mock("@anthropic-ai/sdk", () => {
  class FakeAnthropic {
    messages = {
      create: async (request: { messages: { content: string }[] }) => {
        const input = request.messages[0]?.content ?? "";
        if (input.includes('"home"')) {
          profileCalls.push(input);
          return {
            content: [{ type: "text", text: JSON.stringify(profileAnswer) }],
            usage: { input_tokens: 900, output_tokens: 220 },
          };
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

/** A right-sized universe for a cold-start site: every row is inside the
 *  300/mo floor, so what the pass stores is decided by whether it had a
 *  category to buy suggestions for at all. */
const UNIVERSE = [
  { keyword: "collaborative design tool for teams", volume: 260 },
  { keyword: "design tool with prototyping", volume: 240 },
  { keyword: "best design tool for small teams", volume: 210 },
  { keyword: "design handoff tool for developers", volume: 190 },
  { keyword: "free collaborative design software", volume: 170 },
  { keyword: "design tool for remote teams", volume: 150 },
  { keyword: "design tool with dev handoff", volume: 130 },
  { keyword: "online design tool for product teams", volume: 120 },
  { keyword: "design tool for wireframes", volume: 110 },
  { keyword: "design tool with comments", volume: 100 },
  { keyword: "design tool for design systems", volume: 90 },
  { keyword: "design tool for ux teams", volume: 80 },
  { keyword: "cheap design tool for startups", volume: 70 },
  { keyword: "design tool with version history", volume: 60 },
];

function envelope(result: unknown): unknown {
  return { tasks: [{ id: "task-fixture", status_code: 20000, status_message: "Ok.", result: [result] }] };
}

const vendorRequests: { url: string; task: Record<string, unknown> }[] = [];

function vendorAnswer(url: string, task: Record<string, unknown>): unknown {
  if (url.includes("keyword_suggestions")) {
    return envelope({
      items: UNIVERSE.slice(0, Number(task.limit)).map((row) => ({
        keyword: row.keyword,
        keyword_info: { search_volume: row.volume },
      })),
    });
  }
  if (url.includes("ranked_keywords")) {
    return envelope({
      total_count: OWN_RANKED,
      items: [
        {
          keyword_data: { keyword: "figma", keyword_info: { search_volume: 40 } },
          ranked_serp_element: { serp_item: { rank_group: 1, url: `https://${DOMAIN}/` } },
        },
      ],
    });
  }
  return envelope({
    items: [
      { type: "organic", rank_group: 1, domain: "sketch.com", url: "https://sketch.com/", title: "Sketch" },
      { type: "organic", rank_group: 2, domain: "canva.com", url: "https://canva.com/", title: "Canva" },
      { type: "ai_overview", asynchronous_ai_overview: true, references: [{ domain: "sketch.com" }] },
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
  profileCalls.length = 0;
  profileAnswer = OVER_FULL_PROFILE;
  run += 1;
  scanId = `8988988${run}-8988-4898-8898-898898898898`;
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
      headers: { "content-type": "application/json", "x-forwarded-for": `203.0.113.${run}` },
      body: JSON.stringify({ value: DOMAIN }),
    })
  );
  expect(started.status).toBe(200);
  const { scanId: startedId } = (await started.json()) as { scanId: string };
  for await (const event of progress(startedId)) if ("ending" in event) break;
  const store = db.rpcCalls.find((c) => c.fn === "store_current_report");
  if (!store) throw new Error("the pass stored no report");
  return store.args;
}

function passLine(): Record<string, unknown> {
  const lines = logLines.filter((line) => line.includes('"event":"scan_pass"'));
  expect(lines).toHaveLength(1);
  return JSON.parse(lines[0]!) as Record<string, unknown>;
}

describe("figma's own answer: an over-full list no longer empties the report (issue 898)", () => {
  it("the fixture is the incident: seven brand tokens against a cap of six", () => {
    expect(OVER_FULL_PROFILE.brandTokens.length).toBe(PROFILE_LIST_BOUNDS.brandTokens.max + 1);
  });

  it("the profile is kept and trimmed, the market is bought, and the report has questions, a score and a band", async () => {
    const stored = await scan();

    // The market read happened at all, which is what the empty report hung
    // on: with no profile there is no category and no suggestion is bought.
    expect(vendorRequests.filter((r) => r.url.includes("keyword_suggestions")).length).toBeGreaterThan(0);

    const report = stored.p_report as {
      questions: { kind: string; value?: unknown[] };
      market: { kind: string; value?: { profile: { brandTokens: string[] } } };
      verdict: { scoreAndBand: { kind: string; value?: { score: number; band: string } } };
    };
    expect(report.questions.kind).not.toBe("unmeasured");
    expect(report.questions.value?.length ?? 0).toBeGreaterThan(0);
    expect(stored.p_score).not.toBeNull();
    expect(report.verdict.scoreAndBand.kind).not.toBe("unmeasured");
    expect(report.verdict.scoreAndBand.value?.band).toBeTruthy();

    // Trimmed to the cap, in the model's own order.
    expect(report.market.value?.profile.brandTokens).toEqual(
      OVER_FULL_PROFILE.brandTokens.slice(0, PROFILE_LIST_BOUNDS.brandTokens.max)
    );
  }, 30_000);

  it("it is asked once — the second identical call the incident paid for is not made", async () => {
    await scan();
    expect(profileCalls).toHaveLength(1);
  }, 30_000);

  it("the pass does not report an unread market", async () => {
    await scan();
    expect(passLine().because).toBe("pass_ended");
  }, 30_000);
});

describe("an answer that really is unusable still fails, and the pass says so (issue 898)", () => {
  beforeEach(() => {
    // A missing required field: nothing can be trimmed into existence, and
    // a second ask really might get it right — so this one is still asked
    // twice and still ends unmeasured.
    profileAnswer = { ...OVER_FULL_PROFILE, category: undefined };
  });

  it("the market is unmeasured, and the pass names the step rather than reading as a pass that simply ended", async () => {
    const stored = await scan();

    expect(profileCalls).toHaveLength(2);
    const report = stored.p_report as {
      market: { kind: string };
      questions: { kind: string };
    };
    // The report's own state carries it: an unmeasured market is what the
    // address reads to tell the visitor the report could not be built
    // (`_address/resolve.ts`, `notice.market-unread`), instead of showing
    // an empty one and naming a driver the empty market took down with it.
    expect(report.market.kind).toBe("unmeasured");
    expect(report.questions.kind).toBe("unmeasured");

    const pass = passLine();
    expect(pass.because).toBe("business_profile_unmeasured");
    // It is not the market's own answer: nobody read the market, so it is
    // never *too small* (SPEC §6, issue 855).
    expect(pass.because).not.toBe("market_too_small");
  }, 30_000);

  it("no suggestion is bought on a pass with no category — the money is not spent on a market nobody can name", async () => {
    await scan();
    expect(vendorRequests.filter((r) => r.url.includes("keyword_suggestions"))).toHaveLength(0);
  }, 30_000);
});
