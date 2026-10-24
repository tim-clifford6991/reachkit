// tests/journeys/09-thin-market-to-live-page.test.ts — SPEC §5, §6, §7 (issue 800)
//
// Journey: a new site in a thin market — three ranked keywords, suggestions
// of 10–40 searches a month, rivals that rank for a little — goes from the
// setup submit to a right-sized page live on its hosted address and listed
// in its sitemap. And a paid pass that finds genuinely no demand records
// *market too small* and tells the founder why.
//
// This is the promise the product is sold on for the customers it targets
// (#764's RCA: every earlier journey used a market of thousands a month).
//
// **What is real.** `POST /api/setup` and the founder's signed session; the
// `scan/run` job through `runJob()`, the engine's deep pass with its six
// stages, the thin-market ladder (seeds, pool, volume steps), right-sizing,
// §7's derivation and the live opportunity store; the first draft the pass
// starts before it releases the founder — `generateDayPage` through the live
// generate store, §8's hard rules, the edge into review with its veto window
// and the draft-ready mail; the hosted health refresh (#791); the window's
// end as `publish/execute` delivers it (#790) through the hosted adapter; and
// the hosted host's own `GET /sitemap.xml`. One database double stores every
// row, so the page the sitemap lists is the draft the pass's opportunity
// became, and nothing in between is handed over by the test.
//
// **What is doubled, each at the last line of our own code:**
//
//   · Postgres          → the storing double the publishing suites share,
//                         with the stored procedures this path calls
//   · DataForSEO        → the global `fetch` its transport issues
//   · Anthropic         → the SDK client `llm()` constructs
//   · the customer's own server, and Vercel's domain list
//                       → `safeFetch` / `readRobots` / the resolver
//   · Resend            → `__setVendorTransportForTesting`
//   · the job platform  → `sendJobEvent`, delivered here through `runJob()`
//
// Nothing is bought and nothing is sent. The copy registry is a fixture, as
// in journeys 02–08: mails and notices are asserted by their keys.
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
process.env.VERCEL_API_TOKEN = "token-journey-09";
process.env.VERCEL_PROJECT_ID = "prj_journey_09";

// ── Postgres ────────────────────────────────────────────────────────────

const db: FakeDb = fakeDb();

const client = passClient(db, "journey 09");

vi.mock("@/lib/generate/pipeline/research", async (importOriginal) => (await import("./harness")).researchStandIn(importOriginal));
vi.mock("@/lib/db", () => ({ dbAdmin: () => client, db: () => client }));
vi.mock("@/lib/presentation/copy", async (importOriginal) => (await import("./harness")).copyByKey(importOriginal));
vi.mock("next/navigation", async () => (await import("./harness")).nextNavigation("journey 09"));
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

const DOMAIN = "quietbooks.com";
const HOST = `content.${DOMAIN}`;
const CATEGORY = "bookkeeping software for therapists";
const RIVALS = ["practiceledger.com", "counselbooks.com"] as const;

/** Each seed's suggestions: long-tail searches of 10–40 a month, and one
 *  head term far outsized for a site that ranks for three keywords. */
const HEAD_TERM = "bookkeeping software";
const THIN_SUGGESTIONS: Record<string, readonly (readonly [string, number])[]> = {
  [CATEGORY]: [
    ["bookkeeping software for therapists", 40],
    ["therapist bookkeeping software", 30],
    ["best bookkeeping app for private practice therapists", 20],
    ["therapy practice accounting software", 20],
    [HEAD_TERM, 22000],
  ],
};
const THIN_FALLBACK: readonly (readonly [string, number])[] = [
  ["bookkeeping for therapists in private practice", 10],
  ["counselor bookkeeping software", 10],
];

/** The site's own footprint: three ranked keywords. */
const OWN_RANKED: readonly (readonly [string, number, string])[] = [
  ["private practice bookkeeping checklist", 20, `https://${DOMAIN}/checklist`],
  ["therapist expense tracking software", 30, `https://${DOMAIN}/`],
  ["quietbooks", 10, `https://${DOMAIN}/`],
];

/** Each rival's rows — relevant ones, and one no guard may let through. */
const RIVAL_RANKED: Record<string, readonly (readonly [string, number])[]> = {
  [RIVALS[0]]: [
    ["practiceledger alternatives", 20],
    ["therapist tax deductions software", 30],
    ["ledger nano wallet", 900],
  ],
  [RIVALS[1]]: [["counselbooks alternatives", 20]],
};

/** How much market there is. `thin` is the site this journey is about;
 *  `none` is a market in which nobody searches for anything this site does;
 *  `crowded` is reachkit.app's own on 2026-09-17 (issue 855) — a site that
 *  ranks for three keywords in a market of right-sized searches whose top
 *  tens are held by domains that rank for tens of thousands. */
let market: "thin" | "none" | "crowded" = "thin";

/** Issue 855: seconds each vendor request takes, counted one after another
 *  on the pass's own clock — slower than any real pass, which buys its
 *  twelve concurrently. `0` leaves the clock where the test put it. */
let vendorLatencyS = 0;

/** Issue 855: the crowded market's searches — twelve and more, each inside
 *  the demand a three-keyword site may be offered (`qualifyingDemand(3)`). */
const CROWDED_SUGGESTIONS: readonly (readonly [string, number])[] = [
  ["best bookkeeping software for therapists", 300],
  ["bookkeeping software for therapists", 280],
  ["therapist bookkeeping software", 180],
  ["accounting software for therapists", 240],
  ["best accounting app for private practice", 220],
  ["bookkeeping app for counselors", 200],
  ["private practice bookkeeping software", 260],
  ["therapy practice accounting software", 160],
  ["bookkeeping tool for therapists", 120],
  ["counselor bookkeeping software", 140],
  ["bookkeeping platform for private practice", 110],
  ["best bookkeeping tool for counselors", 90],
  ["therapist accounting app", 70],
  ["bookkeeping software for private practice therapists", 60],
];

/** Issue 855: the domains that hold a crowded top ten — each ranks for tens
 *  of thousands of keywords.
 *
 *  Issue 901 made the vendor answer for all of them: a pass now sizes the
 *  domains its own top tens hold, not only the two the founder tracks, so
 *  every domain below is asked for its ranked count and
 *  `CROWDED_UNNAMED_TOTAL` is what this crowded market says about the ones
 *  the map does not name. It is a large number because that is this
 *  journey's premise — "every top ten belongs to domains that rank for
 *  tens of thousands" is what makes its targets outsized (issue 881) — and
 *  a fixture that answered 0 for them would be asserting the opposite of
 *  the case it is here to hold. */
const GIANTS = ["zapier.com", "ahrefs.com", "forbes.com", "capterra.com", "g2.com"] as const;
const CROWDED_RIVAL_TOTALS: Record<string, number> = { [RIVALS[0]]: 218_224, [RIVALS[1]]: 59_767 };
const CROWDED_UNNAMED_TOTAL = 90_000;

/** Issue 837: the broader category that does have searches, once the founder
 *  picks it — its seed answers the thin market's rows. */
const BROADER = "private practice bookkeeping";
let broaderCategory: string | null = null;
THIN_SUGGESTIONS[BROADER] = THIN_SUGGESTIONS[CATEGORY]!;

const vendorRequests: { url: string; task: Record<string, unknown> }[] = [];

function vendorAnswer(url: string, task: Record<string, unknown>): unknown {
  if (url.includes("/task_post")) {
    return { tasks: [{ id: "task-queued", status_code: 20100, status_message: "Task Created." }] };
  }
  if (url.includes("llm_scraper")) {
    return envelope({
      items: [{ markdown: `Therapists often use ${RIVALS[0]}.`, sources: [{ domain: RIVALS[0] }] }],
    });
  }
  if (url.includes("ai_mode")) {
    return envelope({
      items: [
        { type: "ai_overview", markdown: `${RIVALS[1]} is one option.`, references: [{ domain: RIVALS[1] }] },
      ],
    });
  }
  if (url.includes("keyword_suggestions")) {
    const seed = String(task.keyword ?? "");
    if (market === "crowded") {
      return envelope({
        items: CROWDED_SUGGESTIONS.map(([keyword, volume]) => ({ keyword, keyword_info: { search_volume: volume } })),
      });
    }
    if (market === "none" && seed !== broaderCategory) return envelope({ items: [] });
    const rows = THIN_SUGGESTIONS[seed] ?? THIN_FALLBACK;
    return envelope({ items: rows.map(([keyword, volume]) => ({ keyword, keyword_info: { search_volume: volume } })) });
  }
  if (url.includes("competitors_domain")) {
    return envelope({
      items: RIVALS.map((domain, i) => ({
        domain,
        metrics: { organic: { count: 60 - i * 10, pos_1: 2 } },
        full_domain_metrics: { organic: { count: 60 - i * 10 } },
      })),
    });
  }
  if (url.includes("ranked_keywords")) {
    const target = String(task.target ?? "");
    if (market === "none") return rankedEnvelope([], 0);
    if (target === DOMAIN) return rankedEnvelope(OWN_RANKED, OWN_RANKED.length);
    const rows = RIVAL_RANKED[target] ?? [];
    if (market === "crowded") {
      // A domain that ranks for tens of thousands returns rows, and the
      // vendor's zero-result shape drops the total where there are none
      // (`ledgeredWithTotal`), so the map's gaps answer with one row too.
      const crowded = rows.length > 0 ? rows : ([[`${target.split(".")[0]} guide`, 20]] as const);
      return rankedEnvelope(
        crowded.map(([keyword, volume]) => [keyword, volume, `https://${target}/`] as const),
        CROWDED_RIVAL_TOTALS[target] ?? CROWDED_UNNAMED_TOTAL
      );
    }
    return rankedEnvelope(
      rows.map(([keyword, volume]) => [keyword, volume, `https://${target}/`] as const),
      target === RIVALS[0] ? 60 : 50
    );
  }
  // A crowded top ten: the giants and the tracked rivals, one small site,
  // and no AI Overview on the page.
  if (market === "crowded") {
    const domains = [...GIANTS, ...RIVALS, "smallbooks.io"];
    return envelope({
      items: domains.map((domain, i) => ({
        type: "organic",
        rank_group: i + 1,
        domain,
        url: `https://${domain}/${String(task.keyword ?? "").replace(/\s+/g, "-")}`,
        title: `Page ${i + 1}`,
      })),
    });
  }
  // A live organic SERP: the two small rivals hold the top of it.
  return envelope({
    items: [
      { type: "organic", rank_group: 1, domain: RIVALS[0], url: `https://${RIVALS[0]}/guide`, title: "Guide" },
      { type: "organic", rank_group: 2, domain: RIVALS[1], url: `https://${RIVALS[1]}/blog`, title: "Blog" },
    ],
  });
}

// ── The customer's own server, the hosted edge and Vercel ───────────────

const GROUNDING_PASSAGE =
  "Therapists on the solo plan reconcile 3 bank accounts and send unlimited invoices for one flat monthly fee.";

const HOME_HTML = `<!doctype html><html><head><title>QuietBooks</title></head><body>
  <h1>Bookkeeping software for therapists</h1>
  <h2>What does bookkeeping for a private practice involve?</h2>
  <p>${GROUNDING_PASSAGE}</p>
  <p>Every session payment lands in the right category without a spreadsheet.</p>
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
  job: "keep a private practice's books",
  offeringType: "saas",
  audienceTerms: ["therapists", "counselors"],
  namedRivals: [],
  vocabulary: ["private practice bookkeeping", "therapist accounting"],
  brandTokens: ["quietbooks"],
};

const modelTasks: string[] = [];

/** The page §8's writer answers with: it opens on the target search in
 *  the reader's words, names no brand in its opening, and states the one
 *  grounded passage word for word, linked to where it was read. */
function pageFor(asked: { opportunity?: { targetQuery?: string | null }; grounded?: { url: string; passage: string } }) {
  const query = asked.opportunity?.targetQuery ?? "bookkeeping for therapists";
  // A statement that leads with the search and carries the grounded
  // passage's own number (issue 1389).
  const title = `${query.charAt(0).toUpperCase()}${query.slice(1)}: 3 bank accounts, one fee`;
  const question = `Which ${query}?`;
  const bodyMarkdown = [
    `## ${question}`,
    "",
    "Start with how session payments reach your bank. A practice that sees clients weekly needs each deposit " +
      "matched to a category the day it lands, not at the end of the quarter when receipts are lost.",
    "",
    `${asked.grounded?.passage ?? ""} Read [the published plan](${asked.grounded?.url ?? ""}).`,
  ].join("\n");
  return {
    title,
    question,
    slug: query.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    description: `Choosing ${query}: match each deposit to a category the day it lands, and keep every receipt where you can find it again.`,
    bodyMarkdown,
  };
}

vi.mock("@/lib/generate/pipeline/pack", async (importOriginal) => (await import("./harness")).packStandIn(importOriginal));
vi.mock("@anthropic-ai/sdk", async () =>
  (await import("./harness")).anthropicFor({
    journey: "journey 09",
    profile: PROFILE_ANSWER,
    site: { siteName: "QuietBooks", products: ["bookkeeping software"], vocabulary: ["practice", "sessions"] },
    pageFor,
    tasks: modelTasks,
  })
);

// ── The modules, after the doubles above are in place ───────────────────

const { scanRun } = await import("../../src/jobs/scan-run");
const { publishExecute } = await import("../../src/jobs/publish-execute");
const engine = await import("../../src/jobs/engine");
const { GET: sitemap } = await import("../../src/app/(hosted)/sitemap.xml/route");
const { setActiveAccessReader, resetActiveAccessReader } = await import(
  "../../src/app/(account)/setup/_setup/store"
);
const { registerActiveAccessGate } = await import("../../src/lib/scan/weekly/access");
const { setIdentityAuth } = await import("../../src/lib/account/identity/auth");
const { releaseNotice } = await import("../../src/lib/scan/deep/notice");
const { onboardingPanel } = await import("../../src/app/(account)/app/_shell/onboarding");
const { passProgressFor } = await import("../../src/lib/scan/deep/progress");
const { demandBand } = await import("../../src/lib/opportunities/winnability/band");
const { readCategoryChoice } = await import("../../src/app/(account)/app/_shell/remeasure");
const { remeasureAction } = await import("../../src/app/(account)/app/_shell/remeasure-actions");
const { qualifyingDemand } = await import("../../src/lib/opportunities/winnability/bars");

import type { Outcome } from "../../src/jobs/types";

const USER_ID = "44444444-4444-4444-8444-444444444409";
const SITE_ID = "22222222-2222-4222-8222-222222222209";
const EMAIL = "founder@quietbooks.example";
const TIME_ZONE = "America/Chicago";

/** Sunday afternoon in the site's own zone: the founder finishes setup. */
const SUBMITTED_AT = new Date("2026-09-20T20:00:00.000Z");
const HOUR = 3_600_000;

const inbox: SentMail[] = [];
const runs: { job: string; outcome: Outcome }[] = [];

async function setUpTheDatabase(): Promise<void> {
  db.reset();
  await installPassRpcs(db, "dest-journey-09");

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
  market = "thin";
  vendorLatencyS = 0;
  broaderCategory = null;
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
  stubVendorFetch(vendorRequests, vendorAnswer, () => {
    if (vendorLatencyS > 0) vi.setSystemTime(new Date(Date.now() + vendorLatencyS * 1000));
  });
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
const deliver = deliverer({ queued, jobs: { "scan/run": scanRun, "publish/execute": publishExecute }, runs });

function mailsOf(prefix: string): SentMail[] {
  return inbox.filter((mail) => mail.subject.startsWith(prefix));
}

describe("a new site in a thin market goes from setup to a published right-sized page (issue 800)", () => {
  it(
    "setup → background deep pass → a right-sized ready opportunity → first draft in review → hosted publish → sitemap",
    async () => {
      // ── Setup: one submit, and the founder is released into the app.
      const submitted = await submitSetup(setup);
      expect(submitted).toEqual({ status: 200, body: { ok: true, siteId: SITE_ID } });
      expect(queued.map((event) => event.name)).toEqual(["scan/run"]);
      expect(db.rows("destinations")).toMatchObject([{ kind: "hosted", hostname: HOST, hostname_state: "pending_dns" }]);

      // ── The deep pass runs in the background, as its job.
      const [pass] = await deliver("scan/run", SUBMITTED_AT);
      realTimers();
      expect(pass).toEqual({ outcome: "ran", subjectId: expect.any(String) });

      const scan = db.rows("scans").find((row) => row.site_id === SITE_ID && row.tier === "deep");
      expect(scan).toMatchObject({ status: "done", is_current: true });
      const report = scan!.report as {
        questions: { kind: string; value: { search: { keyword: string; volume: number; floor?: number } }[] };
      };

      // The thin-market ladder reached questions from below the 50/mo step,
      // inside its extra-seed limit.
      expect(report.questions.kind).toBe("measured");
      expect(report.questions.value.some((q) => (q.search.floor ?? 50) < 50)).toBe(true);
      const seeds = vendorRequests.filter((request) => request.url.includes("keyword_suggestions"));
      expect(seeds.length).toBeGreaterThan(1);
      expect(seeds.length).toBeLessThanOrEqual(4);

      // Right-sized at selection (issue 830): no stored question is a search
      // outsized for a site that ranks for three keywords, and the head term
      // is never bought — no SERP and no battery call names it.
      for (const question of report.questions.value) {
        expect(question.search.volume).toBeLessThanOrEqual(qualifyingDemand(OWN_RANKED.length));
      }
      expect(report.questions.value.map((q) => q.search.keyword)).not.toContain(HEAD_TERM);
      const bought = vendorRequests.filter((request) =>
        ["serp/google/organic", "llm_scraper", "ai_mode"].some((path) => request.url.includes(path))
      );
      expect(bought.length).toBeGreaterThan(0);
      expect(bought.filter((request) => request.task.keyword === HEAD_TERM)).toEqual([]);

      // ── Derivation: at least one ready opportunity, right-sized for a
      //    site that ranks for three keywords — and never the head term.
      const ready = db.rows("opportunities").filter((row) => row.site_id === SITE_ID && row.ready === true);
      expect(ready.length).toBeGreaterThanOrEqual(1);
      for (const row of ready) {
        expect(demandBand({ volume: Number(row.volume), ownRanked: OWN_RANKED.length })).toBe("winnable");
      }
      expect(db.rows("opportunities").map((row) => row.target_query)).not.toContain(HEAD_TERM);

      // ── The first draft, written from a ready opportunity before the
      //    release, and waiting in review while the host waits for DNS.
      const drafts = db.rows("drafts").filter((row) => row.site_id === SITE_ID);
      expect(drafts).toHaveLength(1);
      const draft = drafts[0]!;
      expect(draft).toMatchObject({ state: "in_review", hard_rules_passed: true });
      expect(ready.map((row) => row.id)).toContain(draft.opportunity_id);
      expect(db.rows("destinations")[0]).toMatchObject({ health: "expired", hostname_state: "pending_dns" });

      const site = db.rows("sites").find((row) => row.id === SITE_ID)!;
      expect(site.setup_released_reason).toBe("completed");
      const progress = await passProgressFor(SITE_ID);
      expect(progress).toEqual({ running: false, degraded: false });
      expect(onboardingPanel({ progress, notice: await releaseNotice({ domain: DOMAIN }), weekZero: true })).toEqual({
        kind: "none",
      });

      // The founder is told when it goes out, and the window's end is
      // already on the platform, stamped for that moment (#790).
      const execute = queued.find((event) => event.name === "publish/execute");
      expect(execute?.data).toMatchObject({ draftId: draft.id });
      const dueAt = execute!.at!;
      expect(dueAt.getTime()).toBeGreaterThanOrEqual(new Date(String(draft.veto_deadline)).getTime());
      expect(draft.told).toMatchObject({ kind: "interval", publishesAt: dueAt.toISOString() });
      expect(mailsOf("mail.draftReady").map((mail) => mail.to)).toEqual([[EMAIL]]);

      // ── The founder points their record; the hosted health refresh
      //    finds the host verified.
      vi.setSystemTime(new Date(SUBMITTED_AT.getTime() + 2 * HOUR));
      recordPointed = true;
      const destination = db.rows("destinations")[0]!;
      expect(await engine.refreshDestinationHealth(String(destination.id))).toEqual({ done: true });
      expect(destination).toMatchObject({ health: "ok", hostname_state: "live" });
      expect(vercelDomainCalls.length).toBeGreaterThan(0);

      // Nothing goes out before the window ends.
      expect(await deliver("publish/execute", new Date(dueAt.getTime() - HOUR))).toEqual([]);
      expect(db.rows("publications")).toEqual([]);

      // ── The window ends; the event stamped for it publishes the page.
      vi.setSystemTime(dueAt);
      const [published] = await deliver("publish/execute", dueAt);
      expect(published).toEqual({ outcome: "ran", subjectId: draft.id });
      expect(draft.state).toBe("published");

      const publications = db.rows("publications");
      expect(publications).toHaveLength(1);
      const liveUrl = String(publications[0]!.live_url);
      expect(liveUrl.startsWith(`https://${HOST}/`)).toBe(true);
      expect(publications[0]).toMatchObject({ destination: "hosted", draft_id: draft.id });

      // ── The host's own sitemap lists it.
      const response = await sitemap(new Request(`https://${HOST}/sitemap.xml`, { headers: { host: HOST } }));
      expect(response.status).toBe(200);
      const xml = await response.text();
      expect([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])).toEqual([
        // The index, then the page (issue 1141).
        new URL("/", liveUrl).href,
        liveUrl,
      ]);

      // Nothing on the way degraded.
      expect(runs.filter((run) => run.outcome.outcome !== "ran")).toEqual([]);
    },
    JOURNEY_TIMEOUT_MS
  );

  it(
    "a paid pass over a market with genuinely no demand records market too small, writes no page, and tells the founder and the owner",
    async () => {
      market = "none";
      expect((await submitSetup(setup)).status).toBe(200);

      const [pass] = await deliver("scan/run", SUBMITTED_AT);
      expect(pass?.outcome).toBe("ran");

      const scan = db.rows("scans").find((row) => row.site_id === SITE_ID && row.tier === "deep")!;
      expect(scan.status).toBe("done");
      expect((scan.report as { questions: { kind: string } }).questions.kind).toBe("zero");

      // Never padded: no opportunity, no draft, nothing scheduled.
      expect(db.rows("opportunities").filter((row) => row.ready === true)).toEqual([]);
      expect(db.rows("drafts")).toEqual([]);
      expect(queued.filter((event) => event.name === "publish/execute")).toEqual([]);

      // The founder is released and told why their app is empty.
      const site = db.rows("sites").find((row) => row.id === SITE_ID)!;
      expect(site.setup_released_at).not.toBeNull();
      const notice = await releaseNotice({ domain: DOMAIN });
      expect(notice?.key).toBe("setup.release.market-too-small");
      expect(
        onboardingPanel({ progress: await passProgressFor(SITE_ID), notice, weekZero: true })
      ).toEqual({ kind: "notice", key: "setup.release.market-too-small" });

      // And the owner's alert left.
      const alerts = inbox.filter((mail) => mail.html.includes("mail.ops.incident.market-too-small"));
      expect(alerts).toHaveLength(1);
      expect(alerts[0]!.to).toEqual(["owner@example.com"]);
    },
    JOURNEY_TIMEOUT_MS
  );

  it(
    "a market too small offers broader categories; picking one measures again now, fills the calendar, and a rapid second press is refused (issue 837)",
    async () => {
      market = "none";
      expect((await submitSetup(setup)).status).toBe(200);
      await deliver("scan/run", SUBMITTED_AT);
      expect((await releaseNotice({ domain: DOMAIN }))?.key).toBe("setup.release.market-too-small");
      expect(db.rows("drafts")).toEqual([]);

      // The founder is offered two or three broader categories from the
      // site's own profile — never the category that was just measured.
      const { suggestions } = await readCategoryChoice();
      expect(suggestions.length).toBeGreaterThanOrEqual(2);
      expect(suggestions.length).toBeLessThanOrEqual(3);
      expect(suggestions).toContain(BROADER);
      expect(suggestions).not.toContain(CATEGORY);

      // They pick one. The press saves it and queues a pass at once — no
      // wait for Monday — and the side panel shows the pass's steps.
      vi.setSystemTime(new Date(SUBMITTED_AT.getTime() + 5 * 60_000));
      broaderCategory = BROADER;
      const pick = new FormData();
      pick.set("category", BROADER);
      expect(await remeasureAction({ answer: "idle" }, pick)).toEqual({ answer: "started" });
      expect(db.rows("sites").find((row) => row.id === SITE_ID)?.category).toBe(BROADER);
      const passes = queued.filter((event) => event.name === "scan/run");
      expect(passes).toHaveLength(1);
      expect(passes[0]!.data).toMatchObject({ tier: "deep", siteId: SITE_ID, remeasure: true });
      expect(await passProgressFor(SITE_ID)).toMatchObject({ running: true });
      expect(onboardingPanel({ progress: await passProgressFor(SITE_ID), notice: null, weekZero: true }).kind).toBe(
        "running"
      );

      // A rapid second press starts nothing and says why in a written line.
      const again = new FormData();
      again.set("category", "therapist accounting");
      expect(await remeasureAction({ answer: "idle" }, again)).toEqual({
        answer: "refused",
        line: "setup.remeasure.refused.running",
      });
      expect(queued.filter((event) => event.name === "scan/run")).toHaveLength(1);
      expect(db.rows("sites").find((row) => row.id === SITE_ID)?.category).toBe(BROADER);

      // The pass runs as its job on the row the press claimed, seeded on
      // the chosen category, and produces opportunities and the first page.
      const [pass] = await deliver("scan/run", new Date());
      expect(pass).toEqual({ outcome: "ran", subjectId: passes[0]!.data.scanId });
      const deep = db.rows("scans").filter((row) => row.site_id === SITE_ID && row.tier === "deep");
      expect(deep).toHaveLength(2);
      expect(deep.find((row) => row.id === passes[0]!.data.scanId)).toMatchObject({ status: "done", is_current: true });
      const seeds = vendorRequests.filter((request) => request.url.includes("keyword_suggestions"));
      expect(seeds.map((request) => request.task.keyword)).toContain(BROADER);

      expect(db.rows("opportunities").filter((row) => row.site_id === SITE_ID && row.ready === true).length).toBeGreaterThan(0);
      expect(db.rows("drafts").filter((row) => row.site_id === SITE_ID)).toHaveLength(1);
      expect(await releaseNotice({ domain: DOMAIN })).toBeNull();
      expect(await passProgressFor(SITE_ID)).toMatchObject({ running: false });
    },
    JOURNEY_TIMEOUT_MS
  );

  it(
    "issue 855: a three-keyword site in a crowded market measures all twelve inside its ceiling and sizes its own rivals; an update its hosted destination cannot deliver is never the day's work",
    async () => {
      market = "crowded";
      // Every vendor request takes two seconds, one after another: the free
      // report's 50 s would stop the pass part-way through its twelve.
      vendorLatencyS = 2;
      expect((await submitSetup(setup)).status).toBe(200);

      const [pass] = await deliver("scan/run", SUBMITTED_AT);
      realTimers();
      expect(pass).toEqual({ outcome: "ran", subjectId: expect.any(String) });

      const scan = db.rows("scans").find((row) => row.site_id === SITE_ID && row.tier === "deep")!;
      expect(scan.stopped_reason).toBe("complete");
      const report = scan.report as {
        questions: { kind: string; value: unknown[] };
        serps: { kind: string }[];
        rivals: { kind: string };
        rivalSizes: { kind: string; value: { domain: string; band: string }[] };
      };
      // Every question the pass selected had its SERP measured.
      expect(report.questions.kind).toBe("measured");
      expect(report.questions.value).toHaveLength(12);
      expect(report.serps.map((serp) => serp.kind)).toEqual(report.questions.value.map(() => "measured"));
      expect(report.rivals.kind).toBe("measured");
      // The rivals were sized by this pass, and both are far from this site.
      // The pass's own top tens add their domains after them (issue 901),
      // and in this market every one of those is far too.
      expect(report.rivalSizes.kind).toBe("measured");
      expect(report.rivalSizes.value.slice(0, 2).map((size) => size.domain)).toEqual([...RIVALS]);
      expect(report.rivalSizes.value.map((size) => size.band)).toEqual(
        report.rivalSizes.value.map(() => "far")
      );


      // SPEC §7 (issue 855): an update the hosted destination cannot deliver
      // is never the day's work and never a day of supply — it is not ready,
      // no draft is written from it, and supply does not count it.
      const fixes = db.rows("opportunities").filter((row) => row.site_id === SITE_ID && row.type === "fix_page");
      expect(fixes.length).toBeGreaterThan(0);
      for (const fix of fixes) expect(fix).toMatchObject({ ready: false, unready_reason: "destination_cannot_address" });
      const fixIds = new Set(fixes.map((row) => row.id));
      expect(db.rows("drafts").filter((row) => fixIds.has(row.opportunity_id))).toEqual([]);
      const { supplyDepth, supplyState } = await import("../../src/lib/opportunities");
      // Issue 881: this market's every top ten belongs to domains that rank
      // for tens of thousands, so every target it yields is outsized for a
      // site ranking for three. The honest outcome is **no page** — the run
      // that wrote one here is the dogfood incident, and this case used to
      // assert it. A `not-yet` row is not dismissed and not counted: it
      // stays open, it is zero days of supply, and the state says which
      // zero it is.
      const writes = db
        .rows("opportunities")
        .filter((row) => row.site_id === SITE_ID && row.family !== "fix");
      expect(writes.length).toBeGreaterThan(0);
      expect(writes.every((row) => row.fit_band === "not-yet")).toBe(true);
      expect(db.rows("drafts").filter((row) => row.site_id === SITE_ID)).toEqual([]);
      expect((await supplyDepth(SITE_ID)).unused).toBe(0);
      expect(await supplyState(SITE_ID)).toBe("outsized");
    },
    JOURNEY_TIMEOUT_MS
  );
});
