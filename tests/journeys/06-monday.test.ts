// tests/journeys/06-monday.test.ts — BUILD §3, §11, §12
//
// Journey: the customer's own Monday comes round → the week is measured
// once → every published page gets the week's verdict → the digest says
// what moved and omits what was not measured → the screens read the same
// week (JN-005).
//
// End to end, at the seams and no further in. Everything the product owns
// is real: the site-local week and its four selection predicates, the
// claim that makes a measurement once, `runWeekly` over `runScan` at
// `tier: 'weekly'` with the real cost seam and its ledger, §7's weekly
// top-up, the account of the week, §9's weekly verdicts, the digest read,
// §12's block list and its omission rule, and the week strip the overview
// draws. Three things outside the process are doubled, each at the last
// line of our own code:
//
//   · DataForSEO → the global `fetch` the vendor transport issues
//   · Anthropic  → the SDK client `llm()` constructs
//   · Postgres   → a PostgREST-shaped double, plus §7's and §9's own
//                  declared stores
//
// Five of those need a word.
//
// **The copy registry is NOT a fixture here, and that is the point of one
// of these tests.** Journeys 02–05 resolve each key to itself so the path
// can be walked; this journey is partly *about* the digest's own sentences,
// every one of which is owner-owed. So it runs against the real registry
// and asserts what that means: `copy()` refuses each of §12's weekly keys,
// and the send seam reports `not-composable` and reaches no vendor. The
// mail's shape — which four sections, in which order, and which of them the
// omission rule drops — is asserted on the block list, which carries keys
// and no sentences and so needs no registry at all.
//
// **Billing's access gate is registered by the boot path** (issue #180).
// ADR-050 puts active access in `src/lib/account/billing`, and
// `src/instrumentation.ts` installs it there through
// `installActiveAccessGate()`. The journey asserts both halves: cleared,
// the hourly selection throws rather than guessing — the honest answer —
// and installed the way boot installs it, the selection *decides*. The
// journey seeds no billing rows, so what it decides is "nobody is paying";
// that a paying site is selected and an ended one is not is asserted
// against a live schema in `tests/scan/weekly/schema.test.ts`.
//
// For the measurement itself the journey then registers a gate of its own
// that answers "everyone", because the flow under test is Monday's, not
// billing's.
//
// **The weekly mail is sent (#181), and this journey sends it.**
// `buildWeekly` composed it and `weeklyDigest` read what it needs, and
// until #181 no module in `src/**` called either — the journey composed
// the mail by hand and handed it to the send seam, which is exactly what
// `sendWeeklyDigest` now does: once per `(site_id, week_start)`, stamped
// on the week's own row only where the seam accepted it, and never for a
// week the site did not measure. The composition rows below are unchanged
// — they are about the block list — and the send is now the sender's.
//
// **The overview screen is still fixture-backed** (`_overview/provider.ts`
// names the three issues that replace it). Its week strip is a pure
// function of the site's own zone and today, so the journey drives that
// for real and reads the fixture nowhere.
//
// **The standard queue's poll interval is collapsed.** A weekly pass buys
// every SERP on the standard queue (§6.4 — live mode only where a human is
// waiting, and nobody is waiting on Monday), so each is a `task_post` and
// then a `task_get`. The journey stubs `setTimeout` to fire immediately.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, type DbQuery } from "../scan/run/harness";
import type { FetchOutcome, RobotsPolicy } from "../../src/lib/egress/types";

const db = fakeDb();

/** What each stored procedure answers. */
const rpcAnswers: Record<string, unknown> = {};

/** `sites` and `scans` are read here through two chain members the shared
 *  pipeline double does not carry — `.not('timezone','is',null)` and
 *  `.delete()` — so this journey builds those two tables' own builder and
 *  hands every other table to the double the §6.3 suites share. Rows are
 *  the journey's own little tables (`answerQuery` below), which is what
 *  lets the claim, the release and the week key be asserted as the writes
 *  they are. */
function ownBuilder(table: string) {
  const query: DbQuery = { table, verb: "select", filters: [] };
  db.queries.push(query);
  const self = {
    select: () => self,
    insert(values: Record<string, unknown>) {
      query.verb = "insert";
      query.values = values;
      return self;
    },
    update(values: Record<string, unknown>) {
      query.verb = "update";
      query.values = values;
      return self;
    },
    delete() {
      query.verb = "update";
      query.values = { __deleted: true };
      return self;
    },
    eq(column: string, value: unknown) {
      query.filters.push([column, value]);
      return self;
    },
    in(column: string, values: readonly unknown[]) {
      query.filters.push([column, values]);
      return self;
    },
    is: () => self,
    not: () => self,
    gt: () => self,
    gte: () => self,
    lte: () => self,
    order: () => self,
    limit: () => self,
    single() {
      const answered = answerQuery(query);
      if (answered === UNIQUE_VIOLATION) return Promise.resolve(VIOLATION_RESULT);
      return Promise.resolve({ data: (answered ?? [])[0] ?? null, error: null });
    },
    then(resolve: (value: unknown) => unknown) {
      const answered = answerQuery(query);
      return Promise.resolve(
        answered === UNIQUE_VIOLATION ? VIOLATION_RESULT : { data: answered ?? [], error: null }
      ).then(resolve);
    },
  };
  return self;
}

const VIOLATION_RESULT = {
  data: null,
  error: { message: "duplicate key value violates unique constraint", code: "23505" },
};

const OWN_TABLES = new Set(["sites", "scans"]);

const client = {
  from: (table: string) =>
    OWN_TABLES.has(table) ? ownBuilder(table) : (db.client as { from(t: string): unknown }).from(table),
  rpc: (fn: string, args: unknown) => {
    db.rpcCalls.push({ fn, args: args as Record<string, unknown> });
    return Promise.resolve({ data: rpcAnswers[fn] ?? null, error: null });
  },
};

vi.mock("@/lib/db", () => ({ dbAdmin: () => client, db: () => client }));

// ── The customer's own server ───────────────────────────────────────────

const DOMAIN = "acme.com";
const READ_AT = new Date("2026-08-31T09:00:00.000Z");

const HOME_HTML = `<!doctype html><html><head><title>Acme</title></head><body>
  <h1>Project management software for agencies</h1>
  <h2>What is agency project management?</h2>
  <p>Agencies run many client projects at once. Teams that plan capacity a
     week ahead ship 20% more on time, on our 2026 benchmark of 900 studios.</p>
</body></html>`;

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

function typingAnswerFor(input: string): Record<string, unknown> {
  const asked = JSON.parse(input) as { derivedType: string; derivedSlug: string; targetQuery: string };
  return { type: asked.derivedType, slug: asked.derivedSlug, title: `The best ${asked.targetQuery}` };
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

function envelope(result: unknown): unknown {
  return { tasks: [{ id: "task-fixture", status_code: 20000, status_message: "Ok.", result: [result] }] };
}

const vendorRequests: { url: string; task: Record<string, unknown> }[] = [];

function vendorAnswer(url: string): unknown {
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
    return envelope({ items: [] });
  }
  return envelope({
    items: [
      { type: "organic", rank_group: 1, domain: RIVALS[0], url: `https://${RIVALS[0]}/`, title: "Asana" },
      { type: "organic", rank_group: 2, domain: RIVALS[1], url: `https://${RIVALS[1]}/`, title: "Monday" },
      { type: "organic", rank_group: 3, domain: DOMAIN, url: `https://${DOMAIN}/a`, title: "Acme" },
    ],
  });
}

// ── The rows this journey keeps ─────────────────────────────────────────

const SITE_ID = "site-journey-06";
const USER_ID = "user-journey-06";
const EMAIL = "founder@acme.com";
const ZONE = "America/New_York";
/** A zone on the other side of the date line, so one instant falls in two
 *  different customer-weeks — ADR-060's whole point. */
const FAR_ZONE = "Pacific/Auckland";

interface SiteRow {
  id: string;
  domain: string;
  timezone: string | null;
  /** The account that owns the site — read by #181's digest to find the
   *  address to write to. */
  user_id?: string;
}

interface ScanRow {
  id: string;
  site_id: string;
  tier: string;
  week_start: string | null;
  status: string;
  report: unknown;
  /** #181's stamp: when the digest for this site-week was accepted by the
   *  send seam. Null until it was — including for a send the seam refused,
   *  which is what leaves the week open for the next tick. */
  digest_sent_at?: string | null;
}

/** The one error this journey's little tables can raise, and the only one
 *  the claim distinguishes. */
const UNIQUE_VIOLATION = Symbol("23505");

let sites: SiteRow[] = [];
let scans: ScanRow[] = [];


/** The two tables this journey's own reads and writes go through. */
function answerQuery(query: DbQuery): unknown[] | typeof UNIQUE_VIOLATION | null {
  if (query.table === "sites") {
    const filters = new Map(query.filters);
    // `sitesWithAZone` asks for the ones that have stated a zone; the
    // predicate is `not('timezone','is',null)`, which the builder above
    // records as no filter, so it is applied here.
    return sites
      .filter((site) => site.timezone !== null)
      .filter((site) => !filters.has("id") || filters.get("id") === site.id);
  }
  if (query.table !== "scans") return null;

  if (query.verb === "insert") {
    const values = query.values ?? {};
    // `unique (site_id, week_start) where tier = 'weekly'` — the claim's
    // whole enforcement, mirrored, because a double without it would let
    // this journey demonstrate a second measurement Postgres refuses.
    const clash =
      values.tier === "weekly" &&
      scans.some(
        (scan) =>
          scan.tier === "weekly" &&
          scan.site_id === values.site_id &&
          scan.week_start === values.week_start
      );
    if (clash) return UNIQUE_VIOLATION;
    scans.push({
      id: String(values.id),
      site_id: String(values.site_id),
      tier: String(values.tier),
      week_start: (values.week_start as string | null) ?? null,
      digest_sent_at: (values.digest_sent_at as string | null) ?? null,
      status: String(values.status ?? "running"),
      report: null,
    });
    return [{ id: values.id }];
  }

  const matches = (scan: ScanRow): boolean =>
    query.filters.every(([column, value]) => {
      const held =
        column === "site_id"
          ? scan.site_id
          : column === "tier"
            ? scan.tier
            : column === "digest_sent_at"
              ? (scan.digest_sent_at ?? null)
              : column === "week_start"
                ? scan.week_start
              : column === "id"
                ? scan.id
                : undefined;
      if (held === undefined) return true;
      return Array.isArray(value) ? (value as unknown[]).includes(held) : held === value;
    });

  const hit = scans.filter(matches);
  // The release: a pass that produced no report leaves no week behind it.
  if (query.verb === "update" && query.values?.__deleted === true) {
    scans = scans.filter((scan) => !matches(scan));
    return hit;
  }
  if (query.verb === "update") {
    for (const scan of hit) Object.assign(scan, query.values);
    return hit;
  }
  return hit;
}

// ── The modules, after the fixtures above are in place ──────────────────

const { CAPS } = await import("../../src/lib/config/constants");
const weekly = await import("../../src/lib/scan/weekly");
const { ActiveAccessGateNotRegistered } = await import("../../src/lib/scan/weekly/access");
const { installActiveAccessGate } = await import("../../src/lib/account/billing");
const { setOpportunityStore } = await import("../../src/lib/opportunities");
const verdicts = await import("../../src/lib/opportunities/verdicts");
const { buildWeekly } = await import("../../src/lib/mail/templates/weekly");
const { omittedIndexes } = await import("../../src/lib/mail/blocks/omit");
const { chooseWholeMailLine } = await import("../../src/lib/mail/shell/compose");
const { sendEmail } = await import("../../src/lib/mail/send");
const { sendWeeklyDigest } = await import("../../src/lib/mail/weekly");
const { copy } = await import("../../src/lib/presentation/copy");
const { COPY, OWNER_OWED } = await import("../../src/lib/presentation/copy/registry");
const { readWeek: weekStrip, CALENDAR_HREF } = await import(
  "../../src/app/(account)/app/_overview/week"
);
const { measured, measuredZero, unmeasured } = await import("../../src/lib/measure/measured");
const { __setVendorTransportForTesting } = await import("../../src/lib/mail/vendor/resend");

const opportunityDoubles = await import("../opportunities/memory-store");
const verdictDoubles = await import("../opportunities/verdicts/harness");

/** Monday 06:00 in New York — the site's own local Monday at its own due
 *  hour. In Auckland the same instant is Monday evening, which is a
 *  different local hour and so not due. */
const MONDAY = new Date("2026-08-31T10:00:00.000Z");

/** Half past midnight on Monday in Auckland, which is still Sunday morning
 *  in New York: one instant, two customer-weeks. */
const ACROSS_THE_LINE = new Date("2026-08-30T12:30:00.000Z");

let opportunities: ReturnType<typeof opportunityDoubles.newMemoryState>;
let vendorSends: number;
let realSetTimeout: typeof setTimeout;

beforeEach(() => {
  db.reset();
  // Everything the pipeline reads outside this journey's own two tables:
  // no blocked domain, and every vendor call a cache miss.
  db.answer = (query) => (query.table === "domain_blocks" || query.table === "fetches" ? [] : null);
  for (const key of Object.keys(rpcAnswers)) delete rpcAnswers[key];
  modelCalls.length = 0;
  vendorRequests.length = 0;
  vendorSends = 0;

  sites = [{ id: SITE_ID, domain: DOMAIN, timezone: ZONE, user_id: USER_ID }];
  // The address the digest is written to (#181). `users` is not one of
  // this journey's own tables, so it lives in the shared double beside
  // everything else the pass reads.
  db.rows.set("users", [{ id: USER_ID, email: EMAIL }]);
  scans = [];

  opportunities = opportunityDoubles.newMemoryState({ now: MONDAY, profile: PROFILE_ANSWER });
  setOpportunityStore(opportunityDoubles.memoryStore(opportunities));

  // The gate ADR-050 puts in billing, registered the way billing will.
  weekly.registerActiveAccessGate(async (ids) => new Set(ids));

  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const body = typeof init?.body === "string" ? (JSON.parse(init.body) as unknown[]) : [];
      vendorRequests.push({ url, task: (body[0] ?? {}) as Record<string, unknown> });
      return { ok: true, status: 200, statusText: "OK", json: async () => vendorAnswer(url) };
    })
  );

  realSetTimeout = globalThis.setTimeout;
  vi.stubGlobal("setTimeout", ((fn: () => void) => {
    fn();
    return 0;
  }) as unknown as typeof setTimeout);

  __setVendorTransportForTesting(async () => {
    vendorSends += 1;
    return { status: 200, headers: {}, body: JSON.stringify({ id: "resend-1" }) };
  });
});

afterEach(() => {
  vi.stubGlobal("setTimeout", realSetTimeout);
  vi.unstubAllGlobals();
  setOpportunityStore(null);
  weekly.registerActiveAccessGate(null);
  verdictDoubles.releaseStore();
  __setVendorTransportForTesting(null);
});

/** The `fetches` rows the pass wrote — the ledger, as the product would
 *  have stored it. */
function ledger(): { source: string; costCents: number }[] {
  return db.queries
    .filter((q) => q.table === "fetches" && q.verb === "insert")
    .map((q) => ({ source: String(q.values?.source), costCents: Number(q.values?.cost_cents) }));
}

/** The whole measurement, as the hourly tick starts it. */
async function measureTheWeek(now = MONDAY) {
  const due = await weekly.dueSites(now);
  expect(due.map((site) => site.siteId)).toEqual([SITE_ID]);
  const site = due[0]!;
  return weekly.runWeekly({ siteId: site.siteId, domain: site.domain, zone: site.zone, now });
}

/**
 * §12's four weekly sections, and the lines still owed on them.
 *
 * Two dropped off this list on 2026-09-08 (issue #376): `mail.weekly.score`
 * and `mail.weekly.aiAnswers` are labels UI-SPEC S20 writes unbracketed —
 * "Discoverability Score", "AI answers" — which ruling 11a makes approved
 * copy, so they are filled by transcription. The mail still does not
 * compose, and the assertions below still hold, because its *subject* is
 * owed: S20 writes that too, but on a number §12 lets be unmeasured, and a
 * subject has no omission arm (issue #388).
 */
const DIGEST_KEYS = [
  "mail.weekly.subject",
  "mail.weekly.verdicts",
  "mail.weekly.verdicts.none",
  "mail.weekly.next",
  "mail.weekly.next.none",
  "mail.weekly.next.item",
  "mail.weekly.page",
  "mail.weekly.page.moved",
  "mail.weekly.page.moved_over",
] as const;

const JOURNEY_TIMEOUT_MS = 60_000;

describe("Monday: the week is re-measured, judged, and told (JN-005)", () => {
  it("Monday is the customer's own, not the server's — and the gate is billing's to answer", async () => {
    const weekStart = weekly.weekStartFor({ at: MONDAY, zone: ZONE });
    expect(weekly.isWeeklyDue({ at: MONDAY, zone: ZONE })).toBe(true);
    expect(weekStart).toBe("2026-08-31");
    // The same instant, a different zone: a different local hour, so not
    // due — the tick is hourly and the gate is each site's own clock.
    expect(weekly.isWeeklyDue({ at: MONDAY, zone: FAR_ZONE })).toBe(false);
    // And one instant falls in two different customer-weeks. A weekly cron
    // on one UTC hour would file both under one of them (ADR-060).
    expect(weekly.weekStartFor({ at: ACROSS_THE_LINE, zone: ZONE })).not.toBe(
      weekly.weekStartFor({ at: ACROSS_THE_LINE, zone: FAR_ZONE })
    );

    // With billing's gate unregistered, the selection throws rather than
    // measuring the wrong set of sites or refusing a paying customer.
    weekly.registerActiveAccessGate(null);
    await expect(weekly.dueSites(MONDAY)).rejects.toBeInstanceOf(ActiveAccessGateNotRegistered);

    // And the boot path is what ends that: `src/instrumentation.ts` calls
    // exactly this, once, on every Node boot. Afterwards the same selection
    // answers instead of throwing — this journey holds no billing rows, so
    // the answer is that nobody here is paying, which is a decision and not
    // a guess.
    await installActiveAccessGate();
    await expect(weekly.dueSites(MONDAY)).resolves.toEqual([]);
  });

  it(
    "the week is measured once, on the standard queue, inside CAP_WEEKLY",
    async () => {
      const outcome = await measureTheWeek();
      expect(outcome.ran).toBe(true);
      if (!outcome.ran) throw new Error("unreachable");
      expect(outcome.status === "done" || outcome.status === "degraded").toBe(true);

      // §6.4: live mode only where a human is waiting. Nobody is waiting on
      // Monday, so every SERP is bought on the standard queue.
      const serps = vendorRequests.filter((r) => r.url.includes("/serp/google/organic"));
      expect(serps.length).toBeGreaterThan(0);
      // Every one of them is queued and then polled — never asked live.
      expect(serps.some((r) => r.url.includes("/task_post"))).toBe(true);
      for (const request of serps) {
        expect(
          request.url.includes("/task_post") || request.url.includes("/task_get"),
          request.url
        ).toBe(true);
      }
      expect(vendorRequests.some((r) => r.url.includes("/live/advanced"))).toBe(false);

      const rows = ledger();
      const spent = rows.reduce((total, row) => total + row.costCents, 0);
      expect(spent).toBeGreaterThan(0);
      expect(spent).toBeLessThanOrEqual(CAPS.WEEKLY_C);
      // The paid battery, which the free path never buys.
      const sources = new Set(rows.map((row) => row.source));
      expect(sources).toContain("ai_optimization/chat_gpt/llm_scraper");
      expect(sources).toContain("serp/google/ai_mode");

      // Once, and the claim is what makes it so: the row carries the week,
      // and a second tick inside the same week is refused before any spend.
      const stamped = scans.filter((scan) => scan.tier === "weekly");
      expect(stamped).toHaveLength(1);
      expect(stamped[0]?.week_start).toBe("2026-08-31");
      const spentBefore = ledger().length;
      await expect(
        weekly.runWeekly({ siteId: SITE_ID, domain: DOMAIN, zone: ZONE, now: MONDAY })
      ).resolves.toEqual({ ran: false, because: "already_measured" });
      expect(ledger()).toHaveLength(spentBefore);
    },
    JOURNEY_TIMEOUT_MS
  );

  it(
    "the account of the week names what it did not reach, and never a week it did not take",
    async () => {
      // Before the measurement, REQ-065 c3's arm: not measured, and the day
      // the next one is due — never a silent skip and never a stale week.
      const before = await weekly.accountForWeek({
        siteId: SITE_ID,
        weekStart: "2026-08-31",
        now: MONDAY,
      });
      expect(before.kind).toBe("not_measured");
      if (before.kind !== "not_measured") throw new Error("unreachable");
      expect(before.nextDueOn.getTime()).toBeGreaterThan(MONDAY.getTime());

      await measureTheWeek();

      const after = await weekly.accountForWeek({
        siteId: SITE_ID,
        weekStart: "2026-08-31",
        now: MONDAY,
      });
      expect(after.kind === "complete" || after.kind === "partial").toBe(true);
      if (after.kind === "not_measured" || after.kind === "not_owed") throw new Error("unreachable");
      // The date is the measurement's own, not the storage's.
      expect(after.measuredAt).toBeInstanceOf(Date);
      if (after.kind === "partial") {
        // Every part it names is a section the blob says was not measured —
        // a measured zero is a measurement and appears in no part.
        for (const part of after.unmeasured) {
          expect(["on_page", "market", "rivals", "score", "ai_answers", "rankings"]).toContain(part);
        }
      }
    },
    JOURNEY_TIMEOUT_MS
  );

  it("nothing is spent on a week that is not owed, and the refusal says which", async () => {
    // A site with no stated zone has no local Monday, so no week of its own
    // has begun (REQ-073 c1 forbids a zone we chose).
    sites = [{ id: SITE_ID, domain: DOMAIN, timezone: null, user_id: USER_ID }];
    await expect(weekly.dueSites(MONDAY)).resolves.toEqual([]);
    await expect(
      weekly.runWeekly({ siteId: SITE_ID, domain: DOMAIN, now: MONDAY })
    ).resolves.toEqual({ ran: false, because: "week_not_begun" });

    // Access ended: no week is owed, and none is measured.
    sites = [{ id: SITE_ID, domain: DOMAIN, timezone: ZONE, user_id: USER_ID }];
    weekly.registerActiveAccessGate(async () => new Set());
    await expect(weekly.dueSites(MONDAY)).resolves.toEqual([]);
    await expect(
      weekly.runWeekly({ siteId: SITE_ID, domain: DOMAIN, zone: ZONE, now: MONDAY })
    ).resolves.toEqual({ ran: false, because: "no_active_access" });

    expect(ledger()).toEqual([]);
    expect(scans).toEqual([]);
  });

  it("every published page gets this week's verdict, written once", async () => {
    const page = verdictDoubles.pageOf();
    const store = verdictDoubles.fakeStore({
      pages: [page],
      scanId: "scan-week",
      report: verdictDoubles.reportWithOwnPlace(3),
    });

    const judged = await verdicts.judgeWeek({ siteId: verdictDoubles.SITE_ID, week: verdictDoubles.WEEK });
    expect(judged.standings).toHaveLength(1);
    expect(judged.standings[0]?.publicationId).toBe(page.publicationId);
    expect(judged.standings[0]?.standing.kind).toBe("verdict");
    const written = store.rows.length;
    expect(written).toBe(1);

    // Idempotent on `(publication_id, week_start)`: a second delivery of
    // Monday's tick mints no second verdict.
    await verdicts.judgeWeek({ siteId: verdictDoubles.SITE_ID, week: verdictDoubles.WEEK });
    expect(store.rows).toHaveLength(written);

    // And a week that carries no measurement writes nothing at all: there
    // is nowhere to record a week that was not taken, which is what stops
    // one missed Monday becoming a permanent state (ADR-071).
    const noWeek = verdictDoubles.fakeStore({ pages: [page], report: null });
    const unmeasuredWeek = await verdicts.judgeWeek({
      siteId: verdictDoubles.SITE_ID,
      week: verdictDoubles.WEEK,
    });
    expect(unmeasuredWeek.standings[0]?.standing.kind).toBe("no_week");
    expect(noWeek.rows).toEqual([]);
  });

  it("the digest states what moved, and omits the sections the week did not measure", async () => {
    const page = verdictDoubles.pageOf();
    verdictDoubles.fakeStore({
      pages: [page],
      scanId: "scan-week",
      report: verdictDoubles.reportWithOwnPlace(3),
    });
    await verdicts.judgeWeek({ siteId: verdictDoubles.SITE_ID, week: verdictDoubles.WEEK });

    const digest = await verdicts.weeklyDigest({
      siteId: verdictDoubles.SITE_ID,
      week: verdictDoubles.WEEK,
    });
    expect(digest.standings).toHaveLength(1);
    expect(digest.weekMeasuredAt).toBeInstanceOf(Date);

    // §12's four sections, in §12's order.
    const whole = buildWeekly({
      scoreDelta: measured(4, MONDAY),
      // A measured zero is a result — "no movement" — and prints.
      aiAnswersDelta: measuredZero(0, MONDAY),
      pages: measured(
        digest.standings.map((standing) => ({ liveUrl: standing.liveUrl, standing: standing.standing })),
        MONDAY
      ),
      next: measured([{ targetQuery: "agency capacity planning tool" }], MONDAY),
    });
    expect(whole.subject).toBe("mail.weekly.subject");
    expect(whole.blocks.map((block) => block.block)).toEqual([
      "heading",
      "paragraph",
      "stat",
      "stat",
      "verdicts",
      "list",
      "action",
    ]);
    expect(omittedIndexes(whole.blocks)).toEqual([]);

    // A week that reached neither the score nor the AI answers omits both
    // blocks rather than printing a 0 for a measurement nobody made.
    const partial = buildWeekly({
      scoreDelta: unmeasured("undeterminable", MONDAY),
      aiAnswersDelta: unmeasured("not_attempted", MONDAY),
      pages: unmeasured("not_attempted", MONDAY),
      next: unmeasured("not_attempted", MONDAY),
    });
    // Indexes 2–5 since #376: S20's heading and its one line lead, and
    // neither is conditional — the four §12 sections that are still follow
    // them and are still the four that drop.
    expect(omittedIndexes(partial.blocks)).toEqual([2, 3, 4, 5]);
    // Every conditional section dropped: the mail carries the one line
    // that says so rather than standing empty.
    expect(chooseWholeMailLine({ blocks: partial.blocks })).toBe("mail.nothing_to_report");

    // And through the sender the tick actually calls (#181). The week has
    // to exist for it to be told about: this row is the one `claimWeek`
    // writes, with no report — which reads back as a *partial* week, the
    // arm that still sends and names the sections it missed.
    scans.push({
      id: "scan-told",
      site_id: SITE_ID,
      tier: "weekly",
      week_start: "2026-08-31",
      status: "done",
      report: null,
      digest_sent_at: null,
    });

    // Every one of the eleven lines is owner-owed, so the mail does not
    // compose — the seam says exactly that, no vendor request is made,
    // and **the week is left unstamped**, so the Monday the owner writes
    // them the digest goes. This keeps discriminating once they do.
    const told = await sendWeeklyDigest({ siteId: SITE_ID, weekStart: "2026-08-31", now: MONDAY });
    expect(told).toEqual({ sent: false, reason: "not-composable" });
    expect(vendorSends).toBe(0);
    expect(scans.find((scan) => scan.id === "scan-told")?.digest_sent_at ?? null).toBeNull();
  });

  it("every sentence the digest speaks is the owner's, and none of them is written yet", async () => {
    for (const key of DIGEST_KEYS) {
      expect(Object.keys(COPY), key).toContain(key);
      expect(COPY[key], key).toBe("");
      expect(OWNER_OWED, key).toContain(key);
      expect(() => copy(key), key).toThrow(/owner-owed/);
    }

    // So the mail does not compose, the seam says exactly that, and no
    // vendor request is made. This is the blocking point, asserted rather
    // than left implicit — and it keeps discriminating once the owner
    // fills the keys in.
    const mail = buildWeekly({
      scoreDelta: measured(4, MONDAY),
      aiAnswersDelta: measuredZero(0, MONDAY),
      pages: measured([], MONDAY),
      next: measured([], MONDAY),
    });
    const sent = await sendEmail({
      kind: "weekly",
      to: "founder@acme.com",
      userId: "user-1",
      subject: mail.subject,
      blocks: mail.blocks,
      measurement: { state: "complete" },
    });
    expect(sent).toEqual({ sent: false, reason: "not-composable" });
    expect(vendorSends).toBe(0);

  });

  it("the screens read the same week the measurement was filed under", async () => {
    // §4.5's seven-day strip: done, today, still to come — decided on the
    // site's own calendar date, never the server's.
    const strip = weekStrip({ today: MONDAY, timeZone: ZONE });
    expect(strip.days).toHaveLength(7);
    expect(strip.days.filter((day) => day.state === "today")).toHaveLength(1);
    expect(strip.days[0]?.state).toBe("today"); // the customer's own Monday
    expect(strip.days.map((day) => day.state)).toEqual([
      "today",
      "to-come",
      "to-come",
      "to-come",
      "to-come",
      "to-come",
      "to-come",
    ]);
    expect(strip.calendarHref).toBe(CALENDAR_HREF);

    // One instant, two customer-weeks: the strip and the week key agree,
    // because both are read in the site's own zone and nowhere else.
    const here = weekStrip({ today: ACROSS_THE_LINE, timeZone: ZONE });
    const far = weekStrip({ today: ACROSS_THE_LINE, timeZone: FAR_ZONE });
    expect(here.days.findIndex((day) => day.state === "today")).not.toBe(
      far.days.findIndex((day) => day.state === "today")
    );
    // The idempotency key the partial unique index makes unrepresentable
    // twice is `(site, week start)`, and the week start is the site's own.
    expect(
      weekly.weekKey({
        siteId: SITE_ID,
        weekStart: weekly.weekStartFor({ at: ACROSS_THE_LINE, zone: FAR_ZONE }),
      })
    ).not.toBe(
      weekly.weekKey({
        siteId: SITE_ID,
        weekStart: weekly.weekStartFor({ at: ACROSS_THE_LINE, zone: ZONE }),
      })
    );
  });
});
