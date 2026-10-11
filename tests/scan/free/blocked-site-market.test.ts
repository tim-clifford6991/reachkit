// tests/scan/free/blocked-site-market.test.ts — SPEC §2 (owner, 2026-10-10,
// issue 1387): a site whose bot protection kept the reader off its own pages
// has its market read from how it appears in search, and the twelve
// questions and the AI answers run from that market.
//
// The whole free pass runs, as in `tests/journeys/01-landing-to-report`: the
// route, admission, the pipeline, the cost seam, the measurement, the market
// chain and the store are the product's own. What is outside the process is
// answered at the last line of our code:
//
//   · the site's own server → the page its protection really served the
//     reader (`tests/measure/domain/fixtures/challenge/`)
//   · DataForSEO Labs and the model → what each really answered, recorded
//     once (`./blocked/<domain>.json`, see `./blocked/recorded.ts`)
//   · the twelve Google reads and the vendor's rendered read → doubles: a
//     top ten the site is not in, and a read that met the protection too
//   · Postgres → the PostgREST-shaped double
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, type DbQuery } from "../run/harness";
import { BATTERY, CAPS } from "../../../src/lib/config/constants";
import { toolUseMessage } from "../../llm/fixtures";
import { asQueue, pollTheQueueAtOnce, type SeenRequest } from "../../vendors/harness";
import type { FetchOutcome, RobotsPolicy } from "../../../src/lib/egress/types";
import type { StoredReport } from "../../../src/lib/scan/report";
import { labsAnswer, loadRecording, modelAnswer, RECORDING, type Recording } from "./blocked/recorded";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));
vi.mock("next/server", () => ({
  after: (task: () => Promise<void>) => {
    void task();
  },
}));

// ── The site's own server ───────────────────────────────────────────────

const READ_AT = new Date(Date.now() - 60 * 60 * 1000);
const challenge = (name: string): string =>
  readFileSync(path.join(__dirname, "../../measure/domain/fixtures/challenge", name), "utf8");

interface Served {
  status: number;
  headers: Record<string, string>;
  html: string;
}
/** What each site's protection answered the `reachkit-measure` reader on
 *  2026-10-10. Every address of the site is answered the same way. */
const PROTECTED: Readonly<Record<string, Served>> = {
  "sage.com": { status: 403, headers: { server: "cloudflare" }, html: challenge("cloudflare-block.sage.com.html") },
  "personio.de": { status: 429, headers: { server: "Vercel", "x-vercel-mitigated": "challenge" }, html: challenge("vercel-checkpoint.personio.de.html") },
  "zillow.com": { status: 403, headers: {}, html: challenge("perimeterx.zillow.com.html") },
};
const READABLE: Served = {
  status: 200,
  headers: {},
  html: `<!doctype html><html lang="en"><head><title>Acme</title></head><body>
    <h1>User onboarding software for product teams</h1>
    <h2>What is user onboarding?</h2>
    <p>Onboarding is how a new user reaches their first success. Teams that guide the first
       session see 30% more activation in the first 7 days.</p></body></html>`,
};

let served: Served = READABLE;
vi.mock("@/lib/egress/safe-fetch", () => ({
  safeFetch: async (url: string): Promise<FetchOutcome> => ({
    ok: true,
    status: served.status,
    url,
    html: served.html,
    bytes: served.html.length,
    readAt: READ_AT,
    headers: served.headers,
  }),
}));
vi.mock("@/lib/egress/robots", () => ({
  readRobots: async (origin: string): Promise<RobotsPolicy> => ({
    ok: true,
    origin,
    readAt: READ_AT,
    disallowsAll: false,
    disallowedAgents: {},
    sitemaps: [],
    absent: true,
  }),
}));

// ── The model ───────────────────────────────────────────────────────────

type ModelRequest = { messages: { content: string }[] };
const modelCalls: string[] = [];
/** A test's own answer to a model call, ahead of the recording. */
let scripted: ((input: string) => unknown | undefined) | null = null;
let recording: Recording | null = null;

vi.mock("@anthropic-ai/sdk", () => {
  class RecordedAnthropic {
    messages = {
      create: async (request: ModelRequest) => {
        const input = request.messages[0]?.content ?? "";
        modelCalls.push(input);
        const answer = scripted?.(input);
        if (answer !== undefined) return toolUseMessage(answer, 900, 220, input.includes('"keywords"') ? "question-phrasing" : "profile");
        if (recording === null) throw new Error("blocked-site-market: a model call with no recording and no scripted answer");
        return modelAnswer(recording, request);
      },
    };
  }
  return { default: RecordedAnthropic };
});

/** The phrasing as a double, for the cases that are not about the wording. */
function echoPhrasing(input: string): unknown | undefined {
  if (!input.includes('"keywords"')) return undefined;
  const asked = JSON.parse(input) as { keywords: { id: string; keyword: string }[] };
  return { questions: asked.keywords.map((row) => ({ id: row.id, text: `What is the best ${row.keyword}?` })) };
}

// ── DataForSEO ──────────────────────────────────────────────────────────

const envelope = (result: unknown): unknown => ({ tasks: [{ id: "task-double", status_code: 20000, status_message: "Ok.", result: [result] }] });
const labsRequests: { url: string; task: Record<string, unknown> }[] = [];
/** A test's own answer to a Labs request, ahead of the recording. */
let labsDouble: ((url: string, task: Record<string, unknown>) => unknown | undefined) | null = null;

function vendor(request: SeenRequest): unknown {
  const task = request.task ?? {};
  // The vendor's browser met the protection too: no page came back.
  if (request.url.includes("/on_page/")) return { tasks: [{ id: "task-double", status_code: 50000, status_message: "Internal Error.", result: null }] };
  if (request.url.includes("/dataforseo_labs/")) {
    labsRequests.push({ url: request.url, task });
    const doubled = labsDouble?.(request.url, task);
    if (doubled !== undefined) return doubled;
    if (recording === null) throw new Error(`blocked-site-market: a Labs request with no recording: ${request.url}`);
    return labsAnswer(recording, request.url, task);
  }
  // A question's top ten, and an AI Overview over it: the site is in neither.
  return envelope({
    items: [
      { type: "organic", rank_group: 1, domain: "rival-one.example", url: "https://rival-one.example/", title: "Rival One" },
      { type: "organic", rank_group: 2, domain: "rival-two.example", url: "https://rival-two.example/", title: "Rival Two" },
      { type: "ai_overview", asynchronous_ai_overview: true, references: [{ domain: "rival-one.example" }] },
    ],
  });
}

// ── The database ────────────────────────────────────────────────────────

let scanId = "";
let pass = 0;
/** The domain's current report, where a case starts from a stored one. */
let current: { report: StoredReport } | null = null;

function answerQuery(query: DbQuery): unknown[] | null {
  if (query.verb !== "select") return null;
  if (query.table === "domain_blocks" || query.table === "fetches") return [];
  if (query.table !== "scans") return null;
  const columns = new Map(query.filters);
  if (columns.has("id")) return [{ id: scanId, status: "running", stopped_reason: null, stage_events: [] }];
  if (columns.get("status") === "running" && columns.get("tier") === "free" && columns.has("domain")) {
    return [{ id: scanId, fromIncompleteRescan: false }];
  }
  if (current !== null && columns.get("is_current") === true) return [{ id: scanId, report: current.report }];
  return [];
}

beforeEach(() => {
  db.reset();
  modelCalls.length = 0;
  labsRequests.length = 0;
  scripted = null;
  labsDouble = null;
  recording = null;
  current = null;
  served = READABLE;
  pass += 1;
  scanId = `1387138${pass % 10}-1387-4387-8387-13871387138${Math.floor(pass / 10)}`;
  db.answer = answerQuery;
  db.singles.set("scans", { id: scanId });
  pollTheQueueAtOnce(2000);
  const answer = asQueue(vendor);
  let index = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const body = typeof init?.body === "string" ? (JSON.parse(init.body) as unknown[]) : [];
      const task = typeof body[0] === "object" && body[0] !== null ? (body[0] as Record<string, unknown>) : undefined;
      return { ok: true, status: 200, statusText: "OK", json: async () => answer({ url, method: init?.method ?? "GET", task }, index++) };
    })
  );
  if (RECORDING) {
    // The vendors answer in their own time while recording; the pass's
    // clock is held so no stage budget ends on it.
    const started = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(started);
    const real = globalThis.setTimeout;
    vi.stubGlobal("setTimeout", ((fn: () => void, ms?: number) => real(fn, ms === 2000 ? 0 : (ms ?? 0) >= 1000 ? 600_000 : ms)) as unknown as typeof setTimeout);
  }
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const PASS_TIMEOUT_MS = RECORDING ? 240_000 : 30_000;

interface Scanned {
  report: StoredReport;
  /** Whether a pass measured, or the stored report was the answer. */
  measured: boolean;
  spentCents: number;
  ledger: { source: string; cacheKey: string; costCents: number }[];
}

/** The landing's submission, then the pass to its end: the report it stored,
 *  or the row it closed without spending where the stored report answered. */
async function scan(domain: string): Promise<Scanned> {
  const { POST } = await import("../../../src/app/api/scan/route");
  const started = await POST(
    new Request("https://app.example.com/api/scan", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `203.0.113.${pass}` },
      body: JSON.stringify({ value: domain }),
    })
  );
  expect(started.status).toBe(200);
  const stored = (): { args: Record<string, unknown> } | undefined => db.rpcCalls.find((call) => call.fn === "store_current_report");
  const closedUnspent = (): boolean =>
    db.queries.some((q) => q.table === "scans" && q.verb === "update" && q.values?.status === "done" && q.values?.cost_cents === 0);
  await vi.waitFor(() => expect(stored() !== undefined || closedUnspent()).toBe(true), { timeout: PASS_TIMEOUT_MS - 2000, interval: 20 });
  const ledger = db.queries
    .filter((q) => q.table === "fetches" && q.verb === "insert")
    .map((q) => ({ source: String(q.values?.source), cacheKey: String(q.values?.cache_key), costCents: Number(q.values?.cost_cents) }));
  return {
    report: (stored()?.args.p_report ?? current?.report) as StoredReport,
    measured: stored() !== undefined,
    spentCents: ledger.reduce((total, row) => total + row.costCents, 0),
    ledger,
  };
}

const suggestionsBought = (): number => labsRequests.filter((request) => request.url.includes("keyword_suggestions")).length;
const profileInputs = (): string[] => modelCalls.filter((input) => !input.includes('"keywords"'));

describe("a site its bot protection kept the reader off (SPEC §2, issue 1387)", () => {
  it.each([
    ["sage.com", "B2B, behind Cloudflare"],
    ["personio.de", "B2B, German, behind Vercel's checkpoint"],
    ["zillow.com", "consumer, behind PerimeterX"],
  ])(
    "%s (%s): the market is read from its listing in search, and the questions and AI answers run",
    async (domain) => {
      served = PROTECTED[domain] as Served;
      recording = loadRecording(domain);
      const { report, spentCents, ledger } = await scan(domain);

      // The on-page facts stay unmeasured: no score, no band.
      expect(report.complete).toBe(true);
      expect(report.onPage).toMatchObject({ kind: "unmeasured", because: "bot_protection" });
      // Issue 1392: the report wears its scan's date, not the home read's.
      expect(new Date(report.verdict.measuredAt).getTime()).toBeGreaterThan(READ_AT.getTime());
      expect(report.verdict.factors.foundations.kind).toBe("unmeasured");
      expect(report.verdict.factors.answerability.kind).toBe("unmeasured");
      expect(report.verdict.scoreAndBand.kind).toBe("unmeasured");

      // The profile call was given the listing, and no page text.
      expect(profileInputs()).toHaveLength(1);
      const asked = JSON.parse(profileInputs()[0] as string) as { search?: string; home?: string };
      expect(asked.home).toBeUndefined();
      expect(asked.search).toContain(`Site: ${domain}`);
      expect(ledger.find((row) => row.source.endsWith("ranked_keywords"))?.cacheKey).toMatch(/\|listing$/);

      // A market, the questions, and an answer row for each.
      expect(report.marketFrom).toBe("search");
      if (report.market.kind === "unmeasured" || report.questions.kind === "unmeasured") throw new Error("no market was read");
      expect(report.market.value.profile.category).not.toBe("");
      expect(report.questions.value).toHaveLength(BATTERY.QUESTIONS);
      expect(report.aiAnswers?.rows).toHaveLength(BATTERY.QUESTIONS);
      expect(report.aiAnswers?.measuredSearches).toBe(BATTERY.QUESTIONS);

      // Inside the free cap.
      expect(spentCents).toBeLessThanOrEqual(CAPS.FREE_C);

      if (process.env.RK_SHOW === "1") {
        const profile = report.market.value.profile;
        process.stdout.write(
          `\n## ${domain} — ${spentCents.toFixed(2)}¢\n${JSON.stringify({ ...profile, seeds: labsRequests.filter((r) => r.url.includes("keyword_suggestions")).map((r) => r.task.keyword) }, null, 1)}\n` +
            report.questions.value.map((q, i) => `${i + 1}. ${q.text}  [${q.search.keyword}]`).join("\n") +
            "\n"
        );
      }
    },
    PASS_TIMEOUT_MS
  );

  /** sage.com's real ranked answer, cut to its first `rows` rows. */
  function fewRows(rows: number): (url: string, task: Record<string, unknown>) => unknown | undefined {
    const held = loadRecording("sage.com");
    return (url, task) => {
      if (!url.includes("ranked_keywords")) return undefined;
      const answer = structuredClone(labsAnswer(held, url, task)) as { tasks: { result: { items: unknown[] }[] }[] };
      const result = answer.tasks[0]?.result[0];
      if (result !== undefined) result.items = result.items.slice(0, rows);
      return answer;
    };
  }

  it("guesses no market where the listing is too thin, and keeps why", async () => {
    served = PROTECTED["sage.com"] as Served;
    labsDouble = fewRows(6);
    const { report } = await scan("sage.com");

    expect(modelCalls).toHaveLength(0);
    expect(suggestionsBought()).toBe(0);
    expect(report.complete).toBe(true);
    expect(report.market).toMatchObject({ kind: "unmeasured", reason: "not_attempted", because: "few_ranked_searches" });
    expect(report.marketFrom).toBeUndefined();
    expect(report.questions.kind).toBe("unmeasured");
    expect(report.aiAnswers).toBeNull();
    // What the pass did before this change, it still does.
    expect(report.onPage).toMatchObject({ kind: "unmeasured", because: "bot_protection" });
    expect(report.ownRankedRows).toHaveLength(6);
  }, PASS_TIMEOUT_MS);

  it("guesses no market where the model reads none in the listing", async () => {
    served = PROTECTED["sage.com"] as Served;
    recording = loadRecording("sage.com");
    scripted = (input) =>
      input.includes('"search"')
        ? { category: "<UNKNOWN>", job: "", offeringType: "", audienceTerms: ["unknown", "unknown"], namedRivals: [], vocabulary: [], brandTokens: [] }
        : undefined;
    const { report } = await scan("sage.com");

    expect(profileInputs()).toHaveLength(1);
    expect(suggestionsBought()).toBe(0);
    expect(report.market).toMatchObject({ kind: "unmeasured", because: "market_not_named" });
    expect(report.marketFrom).toBeUndefined();
  }, PASS_TIMEOUT_MS);

  it("is not taken for a site whose pages were read", async () => {
    served = READABLE;
    recording = loadRecording("sage.com");
    scripted = (input) =>
      echoPhrasing(input) ??
      (input.includes('"home"')
        ? {
            category: "accounting software",
            job: "keep a small business's books",
            offeringType: "saas",
            audienceTerms: ["small business", "accountants"],
            namedRivals: [],
            vocabulary: ["accounting", "payroll", "invoicing"],
            brandTokens: ["sage"],
          }
        : undefined);
    const { report, ledger } = await scan("sage.com");

    expect(profileInputs()).toHaveLength(1);
    expect(profileInputs()[0]).not.toContain('"search"');
    expect(ledger.find((row) => row.source.endsWith("ranked_keywords"))?.cacheKey).not.toContain("listing");
    expect(report.onPage.kind).not.toBe("unmeasured");
    expect(new Date(report.verdict.measuredAt).getTime()).toBeGreaterThan(READ_AT.getTime());
    expect(report.market.kind).not.toBe("unmeasured");
    expect(report.marketFrom).toBeUndefined();
  }, PASS_TIMEOUT_MS);

  it("measures again over a stored report from before the listing was read, and serves one that recorded why it could not", async () => {
    served = PROTECTED["sage.com"] as Served;
    labsDouble = fewRows(6);
    const first = await scan("sage.com");

    // Stored with its reason: inside the window it is the answer, at no cost.
    const stored = JSON.parse(JSON.stringify(first.report)) as StoredReport;
    const startAgain = (report: StoredReport): void => {
      db.rpcCalls.length = 0;
      db.queries.length = 0;
      labsRequests.length = 0;
      current = { report };
    };
    startAgain(stored);
    const again = await scan("sage.com");
    expect(again.measured).toBe(false);
    expect(labsRequests).toHaveLength(0);

    // Stored before this change: the same report with no reason on it.
    const market = { ...stored.market } as { because?: string };
    delete market.because;
    startAgain({ ...stored, market: market as StoredReport["market"] });
    const measured = await scan("sage.com");
    expect(measured.measured).toBe(true);
    expect(labsRequests.some((request) => request.url.includes("ranked_keywords"))).toBe(true);
  }, PASS_TIMEOUT_MS);
});
