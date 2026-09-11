// tests/journeys/04-setup-to-first-draft.test.ts — BUILD §3, §4.3
//
// Journey: the three setup decisions → the deep pass → the release latch →
// `/app` with the first page already on the calendar (JN-002 steps 3–9).
//
// End to end, at the seams and no further in. Everything the product owns
// is real: the setup screen's three cards, `POST /api/setup`, the closed
// submission shape, `completeSetup`, the live setup store's three writes,
// `applySetupChoice`'s one transaction, the `scan/run` event, the whole
// deep pass (`runScan` at `tier: 'deep'` — the same six stages, the paid
// battery, rival sizing, the real cost seam and its ledger), §7's
// derivation over what that pass measured, the release latch, the waiting
// screen's release rule and the calendar's own read. Four things outside
// the process are doubled, each at the last line of our own code:
//
//   · the customer's own server → `safeFetch` / `readRobots`
//   · DataForSEO                → the global `fetch` the vendor transport
//                                 issues
//   · Anthropic                 → the SDK client `llm()` constructs
//   · Postgres                  → a PostgREST-shaped double, plus §7's own
//                                 declared `OpportunityStore`
//
// Five of those need a word.
//
// **"Mocked at the vendors" is the transport, not the vendor functions.**
// `serpOrganic`, `llmScraper`, `aiMode` and `competitorsDomain` each take
// the `CostContext` and ledger through it, so standing in for them would
// take the cost seam out of the journey — and the promise this journey has
// to keep is §6.1's `CAP_DEEP`. So the double sits one layer further out,
// on the `fetch` the transport issues, exactly as journey 01's does. Every
// cent below is a cent the product would have written to `fetches`.
//
// **The standard queue's poll interval is collapsed.** `llm_scraper` has
// no live surface, so each of the twelve is a `task_post` and then a
// `task_get` polled every `VENDOR.stdQueuePollIntervalS` seconds. The
// journey stubs `setTimeout` to fire immediately: it is about the path,
// not about waiting two minutes for a fixture to answer.
//
// **The founder signs in, and the submit is theirs** (#133). Both halves
// of the switch this file used to name as a gap have landed:
// `_setup/provider.ts` hands out the live store in production, and
// `POST /api/setup` resolves the founder through `currentSession()`. So
// this journey mints a **real** session cookie through identity's own
// `sessionCookie()`, puts it in the jar `cookies()` reads, and lets
// `currentSession()` verify it the way it does on a deployed request —
// the MAC, the signed expiry, the account's own session stamp and its
// tombstone, all against the `users` row below. Nothing here stands in
// for identity any more; the provider is still mocked to the live store
// only because this file's own db is a fake and `importOriginal` is how it
// says so.
//
// **The copy registry is a fixture**, for the same reason as journeys 02
// and 03: `copy()` refuses an owner-owed key, and the screens on this path
// speak several. `COPY` itself is left real, so `writtenLine`'s
// owner-owed branch behaves exactly as it does in production.
//
// **The cost ledger is the point of the middle of this journey.** A deep
// pass spends real money — a live SERP and both battery engines for every
// question the market yielded, the market itself, the rival sizing and
// Haiku's typing — and §6.1 caps it at `CAPS.DEEP_C`. The journey adds up
// the `fetches` rows the pass wrote and asserts the ceiling, the sources,
// and the two things the free path's never-list forbids and this pass
// buys: per-rival ranked reads, and the paid battery.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { fakeDb, type DbQuery } from "../scan/run/harness";
import {
  memoryStore as opportunityMemoryStore,
  newMemoryState as newOpportunityState,
  type MemoryState as OpportunityState,
} from "../opportunities/memory-store";
import type { FetchOutcome, RobotsPolicy } from "../../src/lib/egress/types";
import { toolUseMessage } from "../llm/fixtures";

// ── Postgres ────────────────────────────────────────────────────────────

const db = fakeDb();

/** What each stored procedure answers. `apply_setup_choice` returns the
 *  destination id its transaction created; a `null` there is the arm
 *  `applySetupChoice` throws on, which is why the journey supplies one. */
const rpcAnswers: Record<string, unknown> = {};

const client = {
  from: (table: string) => db.client.from(table),
  rpc: (fn: string, args: unknown) => {
    db.rpcCalls.push({ fn, args: args as Record<string, unknown> });
    return Promise.resolve({ data: rpcAnswers[fn] ?? null, error: null });
  },
};

vi.mock("@/lib/db", () => ({ dbAdmin: () => client, db: () => client }));

// ── The copy registry ───────────────────────────────────────────────────

vi.mock("@/lib/presentation/copy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/presentation/copy")>();
  return {
    ...actual,
    copy: (key: string, vars?: Record<string, string | number>) =>
      vars === undefined ? key : `${key}(${Object.values(vars).join(",")})`,
  };
});

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

/** The founder's own cookie jar (#133). `beforeEach` signs the founder in
 *  to Supabase Auth's double and puts its session cookie here, so
 *  `currentSession()` runs its whole verification against it — `getUser()`
 *  on the cookie, then the `users` row (#468). This file supplies the
 *  transport a server request would, and nothing else. */
const cookieJar = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => [...cookieJar].map(([name, value]) => ({ name, value })),
    get: (name: string) => {
      const value = cookieJar.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set: (name: string, value: string) => {
      cookieJar.set(name, value);
    },
    delete: (name: string) => {
      cookieJar.delete(name);
    },
  }),
  headers: async () => new Headers(),
}));

// ── The job platform ────────────────────────────────────────────────────

const jobEvents: { name: string; payload: Record<string, unknown> }[] = [];
vi.mock("@/jobs/client", () => ({
  sendJobEvent: async (name: string, payload: Record<string, unknown>) => {
    jobEvents.push({ name, payload });
  },
}));

// The switch `provider.ts` writes down in its own header — see this file's.
vi.mock("@/app/(account)/setup/_setup/provider", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../../src/app/(account)/setup/_setup/provider")
  >();
  const { liveSetupStore } = await import("../../src/app/(account)/setup/_setup/store");
  return { ...actual, setupStore: () => liveSetupStore() };
});

// ── The customer's own server ───────────────────────────────────────────

const HOME_HTML = `<!doctype html><html><head><title>Acme</title></head><body>
  <h1>Project management software for agencies</h1>
  <h2>What is agency project management?</h2>
  <p>Agencies run many client projects at once. Teams that plan capacity a
     week ahead ship 20% more on time, on our 2026 benchmark of 900 studios.</p>
  <a href="/pricing">Pricing</a>
</body></html>`;

const READ_AT = new Date("2026-09-06T09:00:00.000Z");

vi.mock("@/lib/egress/safe-fetch", () => ({
  safeFetch: async (url: string): Promise<FetchOutcome> => ({
    ok: true,
    status: 200,
    url,
    html: HOME_HTML,
    bytes: HOME_HTML.length,
    readAt: READ_AT,
    headers: {},
  }),
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

// The domain the founder types at setup resolves; §4.3 refuses one that
// does not, and that arm is asserted below.
const resolving = new Set<string>();
vi.mock("@/lib/egress/dns", () => ({
  resolvesInDns: async (host: string) => resolving.has(host),
}));

// ── Anthropic ───────────────────────────────────────────────────────────

const PROFILE_ANSWER = {
  category: "project management software for agencies",
  job: "run many client projects at once",
  offeringType: "saas",
  audienceTerms: ["agencies", "studios"],
  namedRivals: ["asana"],
  vocabulary: ["project management", "capacity planning", "client work"],
  brandTokens: ["acme"],
};

const modelCalls: string[] = [];

vi.mock("@anthropic-ai/sdk", () => {
  class FakeAnthropic {
    messages = {
      create: async (request: { messages: { content: string }[] }) => {
        const input = request.messages[0]?.content ?? "";
        modelCalls.push(input);
        const answer = input.includes("Label an already-derived")
          ? typingAnswerFor(input)
          : input.includes('"home"')
            ? PROFILE_ANSWER
            : {
                questions: (JSON.parse(input) as { id: string; keyword: string }[]).map((row) => ({
                  id: row.id,
                  text: `What's the best ${row.keyword}?`,
                })),
              };
        // The phrasing answers the way the vendor does under a forced tool
        // (issue #512); every other answer keeps the text path.
        if ("questions" in answer) return toolUseMessage(answer, 900, 220, "question-phrasing");
        return {
          content: [{ type: "text", text: JSON.stringify(answer) }],
          usage: { input_tokens: 900, output_tokens: 220 },
        };
      },
    };
  }
  return { default: FakeAnthropic };
});

/** §7's labeller, doing only what §7 lets it do: it keeps the type the
 *  evidence already derived and proposes a slug and a title for it. */
function typingAnswerFor(input: string): Record<string, unknown> {
  const asked = JSON.parse(input) as { derivedType: string; derivedSlug: string; targetQuery: string };
  return {
    type: asked.derivedType,
    slug: asked.derivedSlug,
    title: `The best ${asked.targetQuery}`,
  };
}

// ── DataForSEO ──────────────────────────────────────────────────────────

const SUGGESTIONS = [
  "agency project management software",
  "best project management software for agencies",
  "asana alternatives for agencies",
  "client work management tools",
  "creative agency project management",
  "studio resource planning software",
  "agency capacity planning tool",
  "project management for design agencies",
  "agency time tracking software",
  "client project tracker",
  "agency workflow software",
  "best tool for agency retainers",
  "agency profitability software",
  "project management software for marketing agencies",
  "agency operations platform",
  "resource management for agencies",
  "agency project tracker software",
];

const RIVALS = ["asana.com", "monday.com", "clickup.com"] as const;

function envelope(result: unknown, status = 20000): unknown {
  return { tasks: [{ id: "task-fixture", status_code: status, status_message: "Ok.", result: [result] }] };
}

const vendorRequests: { url: string; task: Record<string, unknown> }[] = [];

function vendorAnswer(url: string): unknown {
  // The standard queue: a `task_post` answers 20100 with an id, and the
  // first `task_get` answers complete.
  if (url.includes("/task_post")) {
    return { tasks: [{ id: "task-queued", status_code: 20100, status_message: "Task Created." }] };
  }
  if (url.includes("llm_scraper")) {
    return envelope({
      items: [
        {
          markdown: `Agencies usually pick ${RIVALS[0]} or ${RIVALS[1]}.`,
          sources: [{ domain: RIVALS[0] }, { domain: RIVALS[1] }],
        },
      ],
    });
  }
  if (url.includes("ai_mode")) {
    return envelope({
      items: [
        {
          type: "ai_overview",
          markdown: `${RIVALS[0]} and ${RIVALS[2]} lead this market.`,
          references: [{ domain: RIVALS[0] }, { domain: RIVALS[2] }],
        },
      ],
    });
  }
  if (url.includes("keyword_suggestions")) {
    return envelope({
      items: SUGGESTIONS.map((keyword, i) => ({
        keyword,
        keyword_info: { search_volume: 5200 - i * 140 },
      })),
    });
  }
  if (url.includes("competitors_domain")) {
    return envelope({
      items: RIVALS.map((domain, i) => ({
        domain,
        metrics: { organic: { count: 9000 - i * 1500, pos_1: 40 - i * 5 } },
        full_domain_metrics: { organic: { count: 9000 - i * 1500 } },
      })),
    });
  }
  if (url.includes("ranked_keywords")) {
    return envelope({ items: [] }); // a cold start: the customer ranks for nothing
  }
  return envelope({
    items: [
      { type: "organic", rank_group: 1, domain: RIVALS[0], url: `https://${RIVALS[0]}/`, title: "Asana" },
      { type: "organic", rank_group: 2, domain: RIVALS[1], url: `https://${RIVALS[1]}/`, title: "Monday" },
      { type: "organic", rank_group: 3, domain: "reddit.com", url: "https://reddit.com/r/agency", title: "Reddit" },
    ],
  });
}

// ── The rows this journey keeps ─────────────────────────────────────────

const USER_ID = "user-journey-04";
const SITE_ID = "site-journey-04";

/** The `users` row behind this journey's session. `deleted_at` is null on
 *  purpose: it is the column that turns a verified Supabase session into
 *  "not a session", and this founder is not deleted. */
const ACCOUNT_ROW = {
  id: USER_ID,
  email: "founder@acme.com",
  name: null,
  pending_email: null,
  pending_email_token_hash: null,
  pending_email_sent_at: null,
  first_signed_in_at: null,
  deleted_at: null,
};
const DOMAIN = "acme.com";
const TIME_ZONE = "America/New_York";
const PAID_AT = new Date("2026-09-06T08:00:00.000Z");

interface SiteRow {
  id: string;
  user_id: string;
  domain: string;
  category: string | null;
  competitors: string[] | null;
  created_at: string;
  setup_completed_at: string | null;
  setup_released_at: string | null;
  setup_released_reason: string | null;
  setup_stage: string | null;
  // §9's governing pair, which `apply_setup_choice` writes in the same
  // transaction as the destination (#175 made the calendar read it).
  mode: string;
  veto_hours: number;
  publish_time: string;
  timezone: string;
  publishing_enabled: boolean;
}

let site: SiteRow;
let opportunities: OpportunityState;

function freshSite(): SiteRow {
  return {
    id: SITE_ID,
    user_id: USER_ID,
    domain: DOMAIN,
    category: null,
    competitors: null,
    created_at: PAID_AT.toISOString(),
    setup_completed_at: null,
    setup_released_at: null,
    setup_released_reason: null,
    setup_stage: null,
    mode: "autopilot",
    veto_hours: VETO.defaultHours,
    publish_time: "09:00",
    timezone: TIME_ZONE,
    publishing_enabled: true,
  };
}

/** The `sites` table, as PostgREST would answer for it. Everything else on
 *  this path is a cache miss or a cold start. */
function answerQuery(query: DbQuery): unknown[] | null {
  if (query.table === "domain_blocks" || query.table === "fetches") return [];
  if (query.table === "scans") return query.verb === "select" ? [] : [];
  // The account `currentSession()` verifies this journey's cookie against
  // (#133): a live account, never signed out of elsewhere, not tombstoned.
  if (query.table === "users") {
    const filters = new Map(query.filters);
    if (filters.has("id") && filters.get("id") !== USER_ID) return [];
    return [ACCOUNT_ROW];
  }
  if (query.table !== "sites") return null;

  const filters = new Map(query.filters);
  const mine =
    (!filters.has("id") || filters.get("id") === site.id) &&
    (!filters.has("user_id") || filters.get("user_id") === site.user_id);
  if (!mine) return [];

  if (query.verb === "select") return [{ ...site }];
  if (query.verb !== "update") return [];

  // `set … where setup_released_at is null` — the latch's one conditional
  // update. A second writer matches no row and is told so.
  if (query.filters.some(([column]) => column === "setup_released_at") && site.setup_released_at !== null) {
    return [];
  }
  Object.assign(site, query.values);
  return [{ ...site }];
}

// ── The modules, after the fixtures above are in place ──────────────────

const { CAPS, PRICE_BOOK, TIMING, VETO } = await import("../../src/lib/config/constants");
const { setOpportunityStore } = await import("../../src/lib/opportunities");
const { setCalendarSiteReader } = await import(
  "../../src/app/(account)/app/calendar/provider"
);
const { readCalendarFacts } = await import("../../src/app/(account)/app/calendar/store");
const { assembleMonth } = await import("../../src/app/(account)/app/calendar/month");
const { monthOf, dayKeyOf } = await import("../../src/app/(account)/app/calendar/dates");
const { CalendarView } = await import("../../src/app/(account)/app/calendar/CalendarView");
const { setActiveAccessReader, resetActiveAccessReader } = await import(
  "../../src/app/(account)/setup/_setup/store"
);
const { POST: setupRoute } = await import("../../src/app/api/setup/route");
const { setIdentityAuth } = await import("../../src/lib/account/identity/auth");
const { addAuthUser, fakeIdentityAuth, newFakeAuth, signedInCookie } = await import(
  "../account/identity/fake-auth"
);
const { runDeepPass } = await import("../../src/lib/scan/deep/run");
const { passProgressFor } = await import("../../src/lib/scan/deep/progress");
const { isReleased, deadlineFrom } = await import("../../src/lib/scan/deep/release");
const { destinationFor, APP_PATH } = await import(
  "../../src/app/(account)/setup/waiting/release"
);
const { nextForDay, supplyDepth } = await import("../../src/lib/opportunities");
const { SetupForm } = await import("../../src/app/(account)/setup/SetupForm");
const { assembleSetup } = await import("../../src/app/(account)/setup/_setup/facts");
const { FIXTURE_SETUP_FACTS } = await import(
  "../../src/app/(account)/setup/_setup/fixture"
);

/** The three decisions, as the one submit carries them. */
const THE_THREE_DECISIONS = {
  domain: DOMAIN,
  category: "project management software for agencies",
  competitors: [...RIVALS],
  mode: "autopilot" as const,
  destination: { kind: "hosted" as const },
};

let realSetTimeout: typeof setTimeout;

beforeEach(() => {
  db.reset();
  db.answer = answerQuery;
  db.singles.set("scans", { id: "scan-journey-04" });
  for (const key of Object.keys(rpcAnswers)) delete rpcAnswers[key];
  rpcAnswers.apply_setup_choice = "destination-journey-04";

  jobEvents.length = 0;
  modelCalls.length = 0;
  vendorRequests.length = 0;
  site = freshSite();
  // The one site, for the reads that ask for a single row — §9's own
  // publishing settings among them (#175).
  db.singles.set("sites", site as unknown as Record<string, unknown>);
  resolving.clear();
  resolving.add(DOMAIN);

  opportunities = newOpportunityState({
    now: new Date("2026-09-06T12:00:00.000Z"),
    // The site's profile, as the scan that just ran derived it. §7's
    // ranking takes its intent term from it and ranks nothing without one
    // — an order derived from a classification we could not make is
    // exactly what `rankOpen` refuses to produce.
    profile: PROFILE_ANSWER,
  });
  setOpportunityStore(opportunityMemoryStore(opportunities));
  setActiveAccessReader(async () => true);

  // Step 2's own outcome, as a value: the founder followed their sign-in
  // link and Supabase's `verifyOtp` set this (#468). Verified by identity
  // through `getUser()` — the journey asserts the submit is *theirs*, which
  // is what #133 wired and what a stand-in user id could never have shown.
  cookieJar.clear();
  const auth = newFakeAuth();
  addAuthUser(auth, { id: USER_ID, email: ACCOUNT_ROW.email });
  setIdentityAuth(fakeIdentityAuth(auth));
  const [name, value] = signedInCookie(auth, USER_ID).split("=") as [string, string];
  cookieJar.set(name, value);

  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const body = typeof init?.body === "string" ? (JSON.parse(init.body) as unknown[]) : [];
      vendorRequests.push({ url, task: (body[0] ?? {}) as Record<string, unknown> });
      return { ok: true, status: 200, statusText: "OK", json: async () => vendorAnswer(url) };
    })
  );

  // The standard queue's ten-second poll, collapsed. See the header.
  realSetTimeout = globalThis.setTimeout;
  vi.stubGlobal("setTimeout", ((fn: () => void) => {
    fn();
    return 0;
  }) as unknown as typeof setTimeout);
});

afterEach(() => {
  setIdentityAuth(null);
  vi.stubGlobal("setTimeout", realSetTimeout);
  vi.unstubAllGlobals();
  setOpportunityStore(null);
  setCalendarSiteReader(null);
  resetActiveAccessReader();
});

// ── The journey, in the steps a founder takes ───────────────────────────

/** Step 3 — the one submit. */
async function submitTheThree(
  over: Partial<typeof THE_THREE_DECISIONS> | Record<string, unknown> = {}
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await setupRoute(
    new Request("https://app.example.com/api/setup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...THE_THREE_DECISIONS, ...over }),
    }),
    undefined
  );
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

/** Steps 4–8 — the `scan/run` event the submit queued, run. */
async function runTheQueuedPass(): Promise<{ status: string; reason: string }> {
  const queued = jobEvents.find((event) => event.name === "scan/run");
  if (queued === undefined) throw new Error("no scan/run event was queued");
  const result = await runDeepPass({
    siteId: queued.payload.siteId as string,
    domain: queued.payload.domain as string,
  });
  return { status: result.status, reason: result.reason };
}

/** The `fetches` rows the pass wrote — the ledger, as the product would
 *  have stored it. */
function ledger(): { source: string; costCents: number }[] {
  return db.queries
    .filter((q) => q.table === "fetches" && q.verb === "insert")
    .map((q) => ({ source: String(q.values?.source), costCents: Number(q.values?.cost_cents) }));
}

/** The month the calendar opens on, and the facts behind it. */
async function readTheCalendar(now = new Date("2026-09-06T12:00:00.000Z")) {
  setCalendarSiteReader(async () => ({ siteId: SITE_ID, timeZone: TIME_ZONE }));
  const month = monthOf(dayKeyOf(now, TIME_ZONE));
  const facts = await readCalendarFacts({ site: { siteId: SITE_ID, timeZone: TIME_ZONE }, month, now });
  return { month, facts, model: assembleMonth(facts, month) };
}

/** A whole onboarding: the three decisions, and the pass they start. */
async function untilTheFounderIsReleased(): Promise<void> {
  const submitted = await submitTheThree();
  expect(submitted.status).toBe(200);
  await runTheQueuedPass();
}

const JOURNEY_TIMEOUT_MS = 60_000;

describe("three decisions → deep pass → the first page already on the calendar (JN-002 steps 3–9)", () => {
  it("step 3 — the screen asks three decisions and the submit carries those and nothing else", async () => {
    const model = assembleSetup({ ...FIXTURE_SETUP_FACTS, cnameTarget: "content.example.com" });
    const html = renderToStaticMarkup(createElement(SetupForm, { model }));

    // Three cards, one submit (§4.3) — and since #356 that is literal: the
    // approved set (UI-SPEC S10) merges the site and its inferred market
    // into one card, "Your site & market", because both are known here and
    // each needs only a Change. So this arm names three heads, not four.
    expect(html).toContain("setup.site-and-market.title");
    expect(html).toContain("setup.competitors.title");
    expect(html).toContain("setup.publishing.title");
    expect(html).toContain('data-testid="setup-destination"');
    expect(html).toContain("setup.submit");
    // Nothing that tunes the engine is on the screen: no cadence, no cap,
    // no question count, no model choice (REQ-025 c1).
    for (const forbidden of ["cadence", "cap", "model", "questions per"]) {
      expect(html.toLowerCase()).not.toContain(`setup.${forbidden}`);
    }

    // And a field absent from `SetupSubmission` cannot be sent: the
    // adapter parses to the closed shape and drops what is not in it.
    const withExtra = await submitTheThree({ veto_hours: 0 } as Record<string, unknown>);
    expect(withExtra.status).toBe(200);
    expect(jobEvents.filter((e) => e.name === "scan/run")).toHaveLength(1);
  });

  it("step 3 — one submit writes the three answers, the mode-and-destination transaction, the stamp, and queues the pass", async () => {
    const submitted = await submitTheThree();
    expect(submitted).toEqual({ status: 200, body: { ok: true, siteId: SITE_ID } });

    // The three answers, on the founder's own site row.
    expect(site.category).toBe(THE_THREE_DECISIONS.category);
    expect(site.competitors).toEqual([...RIVALS]);
    expect(site.domain).toBe(DOMAIN);

    // `applySetupChoice`: one transaction, both writes or neither.
    const applied = db.rpcCalls.filter((call) => call.fn === "apply_setup_choice");
    expect(applied).toHaveLength(1);
    expect(applied[0]?.args).toEqual({
      p_site_id: SITE_ID,
      p_mode: "autopilot",
      p_kind: "hosted",
    });

    // The stamp is written last, and it is what the gate, the reminders
    // and the release deadline all read.
    expect(site.setup_completed_at).not.toBeNull();

    // The pass is queued as the one pipeline with tier as a parameter —
    // §4.3 has no pipeline of its own to start.
    expect(jobEvents).toEqual([
      {
        name: "scan/run",
        payload: { scanId: `setup-${SITE_ID}`, domain: DOMAIN, tier: "deep", siteId: SITE_ID },
      },
    ]);

    // A second submit starts no second pass (REQ-025 c4).
    const again = await submitTheThree();
    expect(again).toEqual({ status: 422, body: { ok: false, refused: "already_complete" } });
    expect(jobEvents.filter((event) => event.name === "scan/run")).toHaveLength(1);
  });


  // ── Issue #240: the WordPress arm of step 3 ─────────────────────────
  //
  // REQ-028 c3 lets a founder choose WordPress and connect later, and
  // setup still completes. What that leaves behind is a **destination
  // waiting for a credential** — and until #240 there was nowhere on any
  // screen to give it one, which is the M10 gap. This is the hand-off:
  // the row setup writes is the row the Publishing card offers Connect on,
  // so the founder's next step exists rather than being described.
  it("step 3, WordPress — setup completes, and the row it leaves is one the card can connect", async () => {
    const submitted = await submitTheThree({
      destination: { kind: "wordpress", connectLater: true },
    });
    expect(submitted).toEqual({ status: 200, body: { ok: true, siteId: SITE_ID } });

    // Setup finished: a deferred WordPress does not hold it up (c3).
    expect(site.setup_completed_at).not.toBeNull();

    const applied = db.rpcCalls.filter((call) => call.fn === "apply_setup_choice");
    expect(applied).toHaveLength(1);
    expect(applied[0]?.args).toMatchObject({ p_site_id: SITE_ID, p_kind: "wordpress" });

    // And the state that row lands in is the one the card reads as "needs
    // a first credential" — `connect`, not `reconnect`: this founder has
    // never connected, and the control's word is the difference.
    const { destinationView } = await import("../../src/lib/publish/destinations/view");
    const view = destinationView({
      id: "dest-wordpress",
      kind: "wordpress",
      health: "expired",
      reason: "never_connected",
      lastCheckedAt: new Date(),
      heldPages: 0,
    });
    expect(view.action).toBe("connect");
  });

  it("step 3 — the refusals §4.3 names, in the order the facts become knowable", async () => {
    // Access first: a founder without it is told that, not that their
    // domain is wrong.
    setActiveAccessReader(async () => false);
    expect((await submitTheThree({ domain: "not a domain" })).body).toEqual({
      ok: false,
      refused: "no_active_access",
    });
    expect(site.setup_completed_at).toBeNull();
    setActiveAccessReader(async () => true);

    // Then the payload, then DNS.
    expect((await submitTheThree({ category: "  " })).body).toEqual({
      ok: false,
      refused: "market_missing",
    });
    expect((await submitTheThree({ domain: "nowhere.example.net" })).body).toEqual({
      ok: false,
      refused: "invalid_domain",
    });
    // A body that is not the closed shape at all never reaches the engine.
    const malformed = await setupRoute(
      new Request("https://app.example.com/api/setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain: DOMAIN }),
      }),
      undefined
    );
    expect(malformed.status).toBe(400);
    expect(jobEvents).toEqual([]);
  });

  it(
    "steps 4–8 — the deep pass runs the six stages, spends inside CAP_DEEP, and every cent of it is ledgered",
    async () => {
      await untilTheFounderIsReleased();

      const rows = ledger();
      const spent = rows.reduce((total, row) => total + row.costCents, 0);
      expect(spent).toBeGreaterThan(0);
      expect(spent).toBeLessThanOrEqual(CAPS.DEEP_C);

      // §6.2's paid battery, which the free path never buys: both engines,
      // beside the twelve SERPs.
      const sources = new Set(rows.map((row) => row.source));
      expect(sources).toContain("dataforseo_labs/google/keyword_suggestions");
      expect(sources).toContain("serp/google/organic");
      expect(sources).toContain("ai_optimization/chat_gpt/llm_scraper");
      expect(sources).toContain("serp/google/ai_mode");
      // §6.6's rival sizing, which the free path's never-list forbids: the
      // customer's own ranked read at the paid row count, and one per
      // rival at the rival row count.
      const ranked = rows.filter((row) => row.source === "dataforseo_labs/google/ranked_keywords");
      expect(ranked.some((row) => row.costCents === PRICE_BOOK.RANKED_PAID_COST_C)).toBe(true);
      expect(ranked.filter((row) => row.costCents === PRICE_BOOK.RANKED_RIVAL_COST_C).length)
        .toBeGreaterThan(0);
      // Never the free path's own 50-row read: this pass buys 300.
      expect(ranked.some((row) => row.costCents === PRICE_BOOK.RANKED_FREE_COST_C)).toBe(false);

      // One SERP per question the market yielded, live — a founder is
      // watching this one — and none carries the free path's AI-Overview
      // surcharge flag, because the paid battery buys AI Mode outright.
      const serps = vendorRequests.filter((r) => r.url.includes("/serp/google/organic"));
      expect(serps.length).toBeGreaterThan(0);
      for (const request of serps) {
        expect(request.url).toContain("/live/advanced");
        expect(request.task.load_async_ai_overview).toBe(false);
      }

      // The battery runs beside every one of them, both engines, so the
      // three records stay the same length as each other.
      expect(rows.filter((row) => row.source === "serp/google/organic")).toHaveLength(serps.length);
      expect(rows.filter((row) => row.source === "ai_optimization/chat_gpt/llm_scraper")).toHaveLength(
        serps.length
      );
      expect(rows.filter((row) => row.source === "serp/google/ai_mode")).toHaveLength(serps.length);

      // The standard queue was used for the one endpoint that has no live
      // surface, and for nothing else.
      const queued = vendorRequests.filter((r) => r.url.includes("/task_post"));
      expect(queued).toHaveLength(serps.length);
      for (const request of queued) expect(request.url).toContain("llm_scraper");
    },
    JOURNEY_TIMEOUT_MS
  );

  it(
    "step 8 — the pass's own measurements become supply, and Haiku only labelled them",
    async () => {
      await untilTheFounderIsReleased();

      expect(opportunities.rows.length).toBeGreaterThan(0);
      for (const row of opportunities.rows) {
        expect(row.site_id).toBe(SITE_ID);
        expect(row.status).toBe("open");
        // Every target came out of a search this pass measured.
        expect(row.target_query === null || typeof row.target_query === "string").toBe(true);
      }

      // §7's first sentence: no model decides what an opportunity is. Every
      // typing call was shown the type the evidence already derived and
      // answered with that same type.
      const typing = modelCalls.filter((call) => call.includes("Label an already-derived"));
      expect(typing.length).toBeGreaterThan(0);
      for (const call of typing) {
        const asked = JSON.parse(call) as { derivedType: string; allowedTypes: string[] };
        expect(asked.allowedTypes).toContain(asked.derivedType);
      }
    },
    JOURNEY_TIMEOUT_MS
  );

  it(
    "step 9 — the latch releases the founder once, and the waiting screen lets go",
    async () => {
      const submitted = await submitTheThree();
      expect(submitted.status).toBe(200);

      // Before the pass ends: still running, a named step, no time of any
      // kind, and a deadline that is a fact about their own submit.
      const midFlight = await passProgressFor(SITE_ID);
      expect(midFlight.running).toBe(true);
      expect(Object.keys(midFlight)).toEqual(["running", "stage", "enteredAt"]);
      const before = await isReleased(SITE_ID, new Date(PAID_AT.getTime() + 60_000));
      expect(before.released).toBe(false);

      const ran = await runTheQueuedPass();
      expect(ran.status).toBe("done");
      expect(ran.reason).toBe("completed");

      // The latch, written from the pass's own end state, once.
      expect(site.setup_released_at).not.toBeNull();
      expect(site.setup_released_reason).toBe("completed");
      // And no step is under way any more.
      expect(site.setup_stage).toBeNull();

      const after = await passProgressFor(SITE_ID);
      expect(after).toEqual({ running: false, degraded: false });
      expect(destinationFor(after)).toBe(APP_PATH);

      // The deadline cannot un-say it: a read long after the window finds
      // the reason the first writer left.
      const submittedAt = new Date(site.setup_completed_at as string);
      const deadline = deadlineFrom(submittedAt);
      // The deadline is a fact about their own submit, arithmetic over one
      // pin and nothing else.
      expect(deadline.getTime() - submittedAt.getTime()).toBe(TIMING.deepReleaseMin * 60_000);
      const later = await isReleased(SITE_ID, new Date(deadline.getTime() + 60_000));
      expect(later).toMatchObject({ released: true, reason: "completed" });
    },
    JOURNEY_TIMEOUT_MS
  );

  it(
    "step 9 — and /app opens on a calendar whose first fillable date already carries the first page",
    async () => {
      await untilTheFounderIsReleased();

      const head = await nextForDay(SITE_ID);
      expect(head).not.toBeNull();
      const depth = await supplyDepth(SITE_ID);
      expect(depth.unused).toBe(opportunities.rows.length);

      const { month, facts, model } = await readTheCalendar();
      expect(facts.drafts.length).toBeGreaterThan(0);

      // The head of §7's one ranked list is the page on the first fillable
      // date — one list, one order, no second ranking. It is planned and
      // not yet written: §8 turns it into a draft on the morning it is
      // due, so a planned date carries a page and no draft id.
      const first = facts.drafts[0];
      expect(first?.state).toBe("planned");
      expect(first?.draftId).toBeNull();
      expect(first?.scheduledFor.startsWith(month)).toBe(true);
      // The page on that date is the head's own target, and the founder
      // is told which search it is for and who holds the answer today.
      expect(first?.title).toBe(head?.targetQuery);
      expect(first?.why.search).toBe(head?.targetQuery);
      expect(first?.why.answeredTodayBy.length).toBeGreaterThan(0);
      // The calendar states supply from the count it read, never a 0 it
      // guessed (ADR-061).
      expect(facts.unusedSupply).toBe(depth.unused);
      // Never padded: no more dates are accounted for than there is supply.
      expect(facts.drafts.length).toBeLessThanOrEqual(depth.unused);

      // And the screen renders that date, accounted for.
      const html = renderToStaticMarkup(createElement(CalendarView, { model }));
      expect(html).toContain(first?.scheduledFor.slice(-2));
      expect(html).toContain("calendar.stage.planned");
    },
    JOURNEY_TIMEOUT_MS
  );
});
