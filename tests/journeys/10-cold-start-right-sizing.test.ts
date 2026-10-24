// tests/journeys/10-cold-start-right-sizing.test.ts — SPEC §6, §7 (issue 858)
//
// Journey: the owner's walk of reachkit.app (2026-09-17). A site that ranks
// for three keywords, in a market whose head terms ("best seo software",
// 1 000/mo) belong to zapier.com (218 224 ranked) and ahrefs.com (59 767).
// The founder tracked those two, and one small site. On main the deep pass
// asked the head terms, every write target read as an unmeasured or
// outsized top ten, and the Overview led with "zapier.com is far beyond your
// reach for now".
//
// **What is real.** `POST /api/setup`; the `scan/run` job through
// `runJob()`, the deep pass with its stages, the market ladder, selection
// with the footprint-scaled volume and difficulty ceilings, rival sizing and
// derivation, §7's derivation and readiness through the live opportunity
// store; the Overview's own read of the stored rows, its model and its rival
// card rendered to markup.
//
// **What is doubled, at the last line of our own code:** Postgres (the
// storing double), DataForSEO (the global `fetch`, answering
// `keyword_suggestions` filters as the vendor documents them), Anthropic
// (the SDK client), the customer's own server, Vercel and Resend. Nothing
// is bought and nothing is sent.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, type FakeDb } from "../publish/harness";
import {
  JOURNEY_TIMEOUT_MS,
  captureMail,
  collapseTimers,
  deliverer,
  envelope,
  installPassRpcs,
  passClient,
  pageOutcome,
  rankedEnvelope,
  realTimers,
  signIn,
  stubVendorFetch,
  submitSetup,
  type QueuedEvent,
  type SentMail,
} from "./harness";

// Vercel's domain list is bound, so the hosted health refresh asks it.
process.env.VERCEL_API_TOKEN = "token-journey-10";
process.env.VERCEL_PROJECT_ID = "prj_journey_10";

// ── Postgres ────────────────────────────────────────────────────────────

const db: FakeDb = fakeDb();

const client = passClient(db, "journey 10");

vi.mock("@/lib/generate/pipeline/research", async (importOriginal) => (await import("./harness")).researchStandIn(importOriginal));
vi.mock("@/lib/db", () => ({ dbAdmin: () => client, db: () => client }));
vi.mock("@/lib/presentation/copy", async (importOriginal) => (await import("./harness")).copyByKey(importOriginal));
vi.mock("next/navigation", async () => (await import("./harness")).nextNavigation("journey 10"));
vi.mock("next/cache", async () => (await import("./harness")).nextCache());
const cookieJar = new Map<string, string>();
vi.mock("next/headers", async () => (await import("./harness")).nextHeaders(cookieJar));
vi.mock("@/app/(account)/setup/_setup/provider", async (importOriginal) => (await import("./harness")).liveSetupProvider(importOriginal));

// ── The job platform ────────────────────────────────────────────────────

const queued: QueuedEvent[] = [];
vi.mock("@/jobs/client", async () =>
  (await import("./harness")).jobsClient((name, data, at) => queued.push({ name, data, at }))
);

// ── The market ──────────────────────────────────────────────────────────

const DOMAIN = "reachkit.app";
const HOST = `content.${DOMAIN}`;
const CATEGORY = "seo software";
const GIANTS = { "zapier.com": 218_224, "ahrefs.com": 59_767 } as const;
const SMALL = "briefkit.io";
const SMALL_RANKED = 80;
/** Issue 901: a reachable competitor the pass's own top tens hold and the
 *  founder does not track — the `rohringresults.com` of the owner's live
 *  re-measure of 2026-09-19. Inside `max(500, 5×3)`, so it is evidence
 *  about this market, and on main it was never sized. */
const UNTRACKED = "rohringresults.com";
const UNTRACKED_RANKED = 338;
const RIVALS = ["zapier.com", "ahrefs.com", SMALL] as const;
const HEAD_TERMS = ["best seo software", "seo software tool", "ai tool for seo"];

/** Every seed's suggestions, with the vendor's keyword difficulty. */
const UNIVERSE: { keyword: string; volume: number; difficulty?: number }[] = [
  { keyword: "best seo software", volume: 1000, difficulty: 78 },
  { keyword: "seo software tool", volume: 880, difficulty: 70 },
  { keyword: "ai tool for seo", volume: 880, difficulty: 64 },
  { keyword: "seo software for startups", volume: 260, difficulty: 52 },
  { keyword: "best ai seo content software", volume: 90, difficulty: 22 },
  { keyword: "seo content brief template for startups", volume: 40, difficulty: 8 },
  { keyword: "best seo content brief software for startups", volume: 70, difficulty: 12 },
  { keyword: "seo content brief software", volume: 50, difficulty: 26 },
  { keyword: "how to write an seo content brief", volume: 60, difficulty: 14 },
];

/** The site's own footprint: three ranked keywords. */
const OWN_RANKED: readonly (readonly [string, number, string])[] = [
  ["reachkit", 20, `https://${DOMAIN}/`],
  ["daily seo pages", 10, `https://${DOMAIN}/`],
  ["reachkit pricing", 10, `https://${DOMAIN}/pricing`],
];

type Condition = [string, string, number | null];
type Filter = Condition | (Filter | "and" | "or")[];

/** One `filters` expression as the vendor documents it: a condition, or
 *  conditions joined by "and" / "or", nested. */
function holds(row: { volume: number; difficulty?: number }, filter: Filter): boolean {
  if (typeof filter[0] === "string") {
    const [field, op, value] = filter as Condition;
    const actual = field === "keyword_info.search_volume" ? row.volume : (row.difficulty ?? null);
    if (op === "=") return actual === value;
    if (actual === null || value === null) return false;
    return op === ">=" ? actual >= value : op === "<=" ? actual <= value : false;
  }
  let result = holds(row, filter[0] as Filter);
  for (let i = 1; i < filter.length; i += 2) {
    const next = holds(row, filter[i + 1] as Filter);
    result = filter[i] === "or" ? result || next : result && next;
  }
  return result;
}

const vendorRequests: { url: string; task: Record<string, unknown> }[] = [];

function vendorAnswer(url: string, task: Record<string, unknown>): unknown {
  if (url.includes("/task_post")) {
    return { tasks: [{ id: "task-queued", status_code: 20100, status_message: "Task Created." }] };
  }
  if (url.includes("llm_scraper")) {
    return envelope({ items: [{ markdown: `Founders often use ${SMALL}.`, sources: [{ domain: SMALL }] }] });
  }
  if (url.includes("ai_mode")) {
    return envelope({ items: [{ type: "ai_overview", markdown: `${SMALL} is one option.`, references: [{ domain: SMALL }] }] });
  }
  if (url.includes("keyword_suggestions")) {
    const filters = task.filters as Filter | undefined;
    const rows = UNIVERSE.filter((row) => filters === undefined || holds(row, filters)).sort((a, b) => b.volume - a.volume);
    return envelope({
      items: rows.slice(0, Number(task.limit)).map((row) => ({
        keyword: row.keyword,
        keyword_info: { search_volume: row.volume },
        keyword_properties: { keyword_difficulty: row.difficulty ?? null },
      })),
    });
  }
  if (url.includes("ranked_keywords")) {
    const target = String(task.target ?? "");
    if (target === DOMAIN) return rankedEnvelope(OWN_RANKED, OWN_RANKED.length);
    const total =
      target === SMALL
        ? SMALL_RANKED
        : target === UNTRACKED
          ? UNTRACKED_RANKED
          : (GIANTS[target as keyof typeof GIANTS] ?? 0);
    return rankedEnvelope([[`${target.split(".")[0]} alternatives`, 20, `https://${target}/`]], total);
  }
  // Every SERP: the giants on top, the small domain of a long-tail search
  // below, and one reachable competitor the founder never named (901).
  return envelope({
    items: [
      { type: "organic", rank_group: 1, domain: "zapier.com", url: "https://zapier.com/blog/seo", title: "Zapier" },
      { type: "organic", rank_group: 2, domain: "ahrefs.com", url: "https://ahrefs.com/blog/seo", title: "Ahrefs" },
      { type: "organic", rank_group: 3, domain: SMALL, url: `https://${SMALL}/templates`, title: "BriefKit" },
      { type: "organic", rank_group: 4, domain: UNTRACKED, url: `https://${UNTRACKED}/seo`, title: "Rohring" },
    ],
  });
}

// ── The customer's own server, the hosted edge and Vercel ───────────────

const GROUNDING_PASSAGE =
  "ReachKit writes one right-sized SEO content page a day for 49 euro a month, and every page waits 24 hours in review.";

const HOME_HTML = `<!doctype html><html><head><title>ReachKit</title></head><body>
  <h1>SEO content for startups, written every day</h1>
  <h2>What goes into an SEO content brief?</h2>
  <p>${GROUNDING_PASSAGE}</p>
  <p>Every brief starts from the searches your market actually makes.</p>
  <a href="/pricing">Pricing</a>
</body></html>`;

const vercelDomainCalls: string[] = [];
/** Whether the founder has pointed their CNAME yet — what Vercel's domain
 *  list reports as `verified`. */
let recordPointed = false;

vi.mock("@/lib/egress/safe-fetch", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  safeFetch: async (url: string, opts: { method?: string; body?: string } = {}) => {
    if (url.startsWith("https://api.vercel.com/")) {
      vercelDomainCalls.push(`${opts.method ?? "GET"} ${url}`);
      return pageOutcome(url, 200, JSON.stringify({ name: HOST, verified: recordPointed }));
    }
    return pageOutcome(url, 200, HOME_HTML);
  },
}));
vi.mock("@/lib/egress/robots", async () => (await import("./harness")).openRobots());
vi.mock("@/lib/egress/dns", async () => (await import("./harness")).dnsKnowing(DOMAIN));

// ── Anthropic ───────────────────────────────────────────────────────────

const PROFILE_ANSWER = {
  category: CATEGORY,
  job: "write seo content for startups",
  offeringType: "saas",
  audienceTerms: ["startups", "founders"],
  namedRivals: [],
  vocabulary: ["seo content", "content brief", "ai seo"],
  brandTokens: ["reachkit"],
};

const modelTasks: string[] = [];

/** The page §8's writer answers with: it opens on the target search in
 *  the reader's words, names no brand in its opening, and states the one
 *  grounded passage word for word, linked to where it was read. */
function pageFor(asked: { opportunity?: { targetQuery?: string | null }; grounded?: { url: string; passage: string } }) {
  const query = asked.opportunity?.targetQuery ?? "seo content briefs";
  const title = `How should a startup choose ${query}?`;
  const bodyMarkdown = [
    `## ${title}`,
    "",
    "Start with the searches your buyers already make. A startup that publishes weekly needs each brief " +
      "matched to one of those searches before a word is written, not after the page is live.",
    "",
    `${asked.grounded?.passage ?? ""} Read [the published plan](${asked.grounded?.url ?? ""}).`,
  ].join("\n");
  return {
    title,
    slug: query.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    description: `Choosing ${query} for a startup.`,
    bodyMarkdown,
  };
}

vi.mock("@anthropic-ai/sdk", async () =>
  (await import("./harness")).anthropicFor({
    journey: "journey 10",
    profile: PROFILE_ANSWER,
    site: { siteName: "ReachKit", products: ["seo content"], vocabulary: ["brief", "searches"] },
    pageFor,
    tasks: modelTasks,
  })
);

// ── The modules, after the doubles above are in place ───────────────────

const { scanRun } = await import("../../src/jobs/scan-run");
const { setActiveAccessReader, resetActiveAccessReader } = await import(
  "../../src/app/(account)/setup/_setup/store"
);
const { registerActiveAccessGate } = await import("../../src/lib/scan/weekly/access");
const { setIdentityAuth } = await import("../../src/lib/account/identity/auth");
const { difficultyCeiling, qualifyingDemand } = await import("../../src/lib/opportunities/winnability/bars");
const { readOverviewFacts } = await import("../../src/app/(account)/app/_overview/store");
const { assembleOverview } = await import("../../src/app/(account)/app/_overview/model");
const { RivalModule } = await import("../../src/app/(account)/app/_overview/RivalModule");
const { renderToStaticMarkup } = await import("react-dom/server");
const { createElement } = await import("react");

import type { Outcome } from "../../src/jobs/types";

const USER_ID = "44444444-4444-4444-8444-444444444410";
const SITE_ID = "22222222-2222-4222-8222-222222222210";
const EMAIL = "founder@reachkit.app";
const TIME_ZONE = "America/Chicago";

/** Sunday afternoon in the site's own zone: the founder finishes setup. */
const SUBMITTED_AT = new Date("2026-09-20T20:00:00.000Z");
const HOUR = 3_600_000;

const inbox: SentMail[] = [];
const runs: { job: string; outcome: Outcome }[] = [];

async function setUpTheDatabase(): Promise<void> {
  db.reset();
  await installPassRpcs(db, "dest-journey-10");

  db.seed("users", [
    {
      id: USER_ID,
      email: EMAIL,
      name: null,
      notify: null,
      paid_through: "2026-10-20T20:00:00.000Z",
      pending_email: null,
      pending_email_token_hash: null,
      pending_email_sent_at: null,
      first_signed_in_at: null,
      deleted_at: null,
    },
  ]);
  db.seed("sites", [
    {
      id: SITE_ID,
      user_id: USER_ID,
      domain: DOMAIN,
      category: null,
      competitors: null,
      // SPEC §6 (owner D64, issue 1301): a top-ten domain is sized only
      // where the site's market holds it as on-market. Setup's rival
      // conclusion read this product's brand volume (D50) beside the rivals
      // the founder then chose for themselves.
      market: {
        current: {
          category: "SEO software",
          rivals: [],
          demand: { at: new Date(SUBMITTED_AT.getTime() - HOUR).toISOString(), own: 0, brands: { rohringresults: 320 } },
        },
        categoryOverridden: true,
        rivalsOverridden: true,
      },
      created_at: new Date(SUBMITTED_AT.getTime() - HOUR).toISOString(),
      setup_completed_at: null,
      setup_released_at: null,
      setup_released_reason: null,
      setup_stage: null,
      setup_stage_times: null,
      mode: "autopilot",
      veto_hours: 24,
      publish_time: "09:00",
      timezone: TIME_ZONE,
      publishing_enabled: true,
      hosted_serving_ends_at: null,
      voice_text: null,
      do_not_claim: [],
    },
  ]);
  for (const table of ["destinations", "drafts", "publications", "opportunities", "scans", "fetches"]) {
    db.seed(table, []);
  }
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(SUBMITTED_AT);
  await setUpTheDatabase();
  queued.length = 0;
  runs.length = 0;
  inbox.length = 0;
  modelTasks.length = 0;
  vendorRequests.length = 0;
  vercelDomainCalls.length = 0;
  recordPointed = false;

  setActiveAccessReader(async () => true);
  registerActiveAccessGate(async (siteIds) => new Set(siteIds));
  await signIn(cookieJar, { id: USER_ID, email: EMAIL });
  await captureMail(inbox);
  stubVendorFetch(vendorRequests, vendorAnswer);
  collapseTimers();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  setIdentityAuth(null);
  resetActiveAccessReader();
  registerActiveAccessGate(null);
});

// ── The founder's steps, and the platform's ─────────────────────────────

const setup = { domain: DOMAIN, category: CATEGORY, competitors: [...RIVALS], mode: "autopilot", destination: { kind: "hosted", label: "content" } };
const deliver = deliverer({ queued, jobs: { "scan/run": scanRun }, runs });

describe("a cold-start site is offered right-sized questions, reachable rivals and winnable targets (issue 858)", () => {
  it(
    "setup → deep pass → derivation: long-tail questions, far rivals kept out of 'your rivals', a ready winnable or reach write target, and an Overview that does not lead with a giant",
    async () => {
      const submitted = await submitSetup(setup);
      expect(submitted).toEqual({ status: 200, body: { ok: true, siteId: SITE_ID } });

      const [pass] = await deliver("scan/run", SUBMITTED_AT);
      realTimers();
      expect(pass).toEqual({ outcome: "ran", subjectId: expect.any(String) });

      const scan = db.rows("scans").find((row) => row.site_id === SITE_ID && row.tier === "deep");
      expect(scan).toMatchObject({ status: "done", is_current: true });
      const report = scan!.report as {
        questions: { kind: string; value: { search: { keyword: string; volume: number; difficulty?: number } }[] };
        rivals: { kind: string; value: { domain: string }[] };
        rivalSizes: { kind: string; value: { domain: string; state: string; band?: string }[] };
      };

      // ── Questions: long-tail, inside the footprint's volume and difficulty
      //    ceilings; no head term is asked, and no SERP is bought for one.
      expect(report.questions.kind).toBe("measured");
      const searches = report.questions.value.map((q) => q.search);
      expect(searches.length).toBeGreaterThan(0);
      for (const head of HEAD_TERMS) expect(searches.map((s) => s.keyword)).not.toContain(head);
      for (const search of searches) {
        expect(search.volume).toBeLessThanOrEqual(qualifyingDemand(OWN_RANKED.length));
        expect(search.difficulty ?? 0).toBeLessThanOrEqual(difficultyCeiling(OWN_RANKED.length));
      }
      const bought = vendorRequests.filter((r) => r.url.includes("serp/google/organic"));
      for (const head of HEAD_TERMS) expect(bought.filter((r) => r.task.keyword === head)).toEqual([]);

      // ── Rivals: the giants are sized far and are not the report's rivals;
      //    the reachable one leads.
      const bands = new Map(report.rivalSizes.value.map((size) => [size.domain, size.band]));
      expect(bands.get("zapier.com")).toBe("far");
      expect(bands.get("ahrefs.com")).toBe("far");
      expect(bands.get(SMALL)).toBe("near");
      const shown = report.rivals.value.map((rival) => rival.domain);
      expect(shown[0]).toBe(SMALL);
      expect(shown).not.toContain("zapier.com");
      expect(shown).not.toContain("ahrefs.com");

      // ── Issue 901: the pass also sized the reachable competitor its own
      //    top tens hold and the founder never named, banded it against
      //    this site, and it is one of the report's rivals. On main it was
      //    never measured, so it carried no band at all.
      const untracked = report.rivalSizes.value.find((size) => size.domain === UNTRACKED);
      expect(untracked).toMatchObject({ state: "sized", band: "middle" });
      expect(shown).toContain(UNTRACKED);
      expect(vendorRequests.filter((r) => r.url.includes("ranked_keywords") && r.task.target === UNTRACKED)).toHaveLength(1);

      // ── Write opportunities follow: at least one ready, winnable or reach.
      const writes = db
        .rows("opportunities")
        // The pass's first-draft kickoff has no model here, so its page is
        // stopped and the target derivation made ready now rests (D26).
        .filter(
          (row) =>
            row.site_id === SITE_ID && row.family === "write" && (row.ready === true || row.unready_reason === "resting")
        );
      expect(writes.length).toBeGreaterThanOrEqual(1);
      for (const row of writes) expect(["winnable", "reach"]).toContain(row.fit_band);
      // No SERP carries an AI Overview; ChatGPT and AI Mode cite the small
      // rival and not the site — the answer-page trigger reads those columns.
      expect(writes.some((row) => row.type === "answer_page")).toBe(true);
      expect(db.rows("opportunities").map((row) => row.target_query)).not.toEqual(expect.arrayContaining([HEAD_TERMS[0]]));

      // ── The Overview, read from the stored rows: the reachable rival is a
      //    row, the giants are named as market leaders after it, and no
      //    "far beyond your reach" line leads the card.
      const facts = await readOverviewFacts({ siteId: SITE_ID, timeZone: TIME_ZONE, domain: DOMAIN });
      const model = assembleOverview(facts);
      expect(model.rivals.rivals.map((rival) => rival.domain)).toEqual([SMALL]);
      expect(model.rivals.leaders.domains).toEqual(["zapier.com", "ahrefs.com"]);
      const markup = renderToStaticMarkup(createElement(RivalModule, { rivals: model.rivals, timeZone: TIME_ZONE }));
      expect(markup).not.toContain("overview.rivals.far.line");
      expect(markup).toContain("overview.rivals.leaders(zapier.com, ahrefs.com)");
      expect(markup.indexOf(SMALL)).toBeLessThan(markup.indexOf("overview.rivals.leaders("));
    },
    JOURNEY_TIMEOUT_MS
  );
});
