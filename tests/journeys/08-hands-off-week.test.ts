// tests/journeys/08-hands-off-week.test.ts — SPEC §6, §7, §8 (issue 323)
//
// Journey: one site, left alone for a week. Nobody approves, nobody clicks,
// nobody calls an engine. The job platform ticks every hour on a fake
// clock and delivers the events the jobs send; everything else is the
// product. The week is read back afterwards, day by day.
//
// **What is real.** The four job definitions that make up a site's week —
// `draft/generate`, `publish/retry`, `publish/verify` and `weekly/refresh`
// — run through `runJob()`, the one path every invocation takes (the kill
// switch's guard included). Behind them the engine seam and every engine
// it calls: the site-local clock, the daily selection, `generateDayPage`
// and its four model steps through the real cost seam, §8's hard rules,
// the edge into review with its window and the draft-ready mail (issue
// 709), the window closing at its end, the claim and its guards, the
// hosted adapter, the +24 h check and the `published` mail, and on Monday
// the weekly selection, the week's claim, the verdicts and the digest.
//
// **What is doubled, each at the last line of our own code:**
//
//   · the job platform  → `sendJobEvent` and the hourly cron, driven here
//                         (`tick` below): a cron job runs every hour,
//                         an event runs `afterHours` after it was sent —
//                         or at the moment it was stamped for (issue #790)
//                         — once per idempotency key
//   · Anthropic         → the SDK client `llm()` constructs
//   · the live page     → `safeFetch` / `readRobots`: the hosted edge's
//                         answer for a published address is the page's own
//                         rendered body
//   · Resend            → `__setVendorTransportForTesting`
//   · Postgres          → the storing double the publishing suites share,
//                         plus §7's and §8's declared stores
//   · the weekly measurement → `runScan` at `tier: 'weekly'`. Journey 06
//                         runs that pass against its vendors end to end;
//                         here it stores the week's report the way the
//                         pass's own store does, so what Monday reads is a
//                         measured week and everything after it is real.
//
// **Two jobs are not ticked**, and neither is part of a site's week:
// `lead/nurture` is a lead's sequence, not a customer's, and
// `account/maintenance` is the account lifecycle (payments, hosting end,
// purge, retention mails) — nothing in it moves a page. `scan/run` is the
// deep pass at setup, which this site finished before the week starts.
//
// **The copy registry is a fixture**, as in journeys 02–05: the mails are
// asserted by their keys, and journey 06 asserts the digest's sentences
// against the real registry.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, installTransitionRpc, type FakeDb, type Row } from "../publish/harness";

const db: FakeDb = fakeDb();

/** `fetches` needs the cache read's `.gt().order().limit()` and §8's
 *  grounding read's `.eq().in()`, over rows stored in the same tables the
 *  rest of the week reads — journey 05's builder, for the same reason. */
function fetchesBuilder() {
  const filters: { op: string; column: string; value: unknown }[] = [];
  let verb: "select" | "insert" = "select";
  const self = {
    select: () => self,
    insert(values: Row) {
      verb = "insert";
      db.rows("fetches").push({ ...values });
      return self;
    },
    eq(column: string, value: unknown) {
      filters.push({ op: "eq", column, value });
      return self;
    },
    in(column: string, values: readonly unknown[]) {
      filters.push({ op: "in", column, value: values });
      return self;
    },
    gt: () => {
      filters.push({ op: "never", column: "", value: null });
      return self;
    },
    gte: () => self.gt(),
    order: () => self,
    limit: () => self,
    single: () => Promise.resolve({ data: null, error: null }),
    then(resolve: (value: { data: unknown[]; error: null }) => unknown) {
      if (verb === "insert") return Promise.resolve({ data: [], error: null }).then(resolve);
      const rows = db.rows("fetches").filter((row) =>
        filters.every((f) => {
          if (f.op === "eq") return row[f.column] === f.value;
          if (f.op === "in") return (f.value as unknown[]).includes(row[f.column]);
          // A cache read: the week spends fresh, so a freshness window
          // matches nothing.
          return false;
        })
      );
      return Promise.resolve({ data: rows, error: null }).then(resolve);
    },
  };
  return self;
}

/** The column defaults the migrations declare and a storing double has no
 *  way to know: a row inserted without them reads `null`, not absent. The
 *  weekly claim inserts a `scans` row and the digest reads its
 *  `digest_sent_at` — absent would read as "already sent". */
const COLUMN_DEFAULTS: Readonly<Record<string, Row>> = {
  scans: { digest_sent_at: null, report: null },
  // Monday's verdict reads `unpublished_at`; absent would read as a page
  // the customer took down.
  publications: { unpublished_at: null },
};

function withDefaults(table: string, builder: { insert(values: Row): unknown }): unknown {
  const defaults = COLUMN_DEFAULTS[table];
  if (defaults === undefined) return builder;
  const insert = builder.insert.bind(builder);
  builder.insert = (values: Row) => insert({ ...defaults, ...values });
  return builder;
}

const client = {
  from: (table: string) =>
    table === "fetches"
      ? fetchesBuilder()
      : withDefaults(table, (db.client as { from(t: string): { insert(values: Row): unknown } }).from(table)),
  rpc: (fn: string, args: Row) => (db.client as { rpc(f: string, a: Row): unknown }).rpc(fn, args),
};

vi.mock("@/lib/db", () => ({ dbAdmin: () => client, db: () => client }));

vi.mock("@/lib/presentation/copy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/presentation/copy")>();
  return {
    ...actual,
    copy: (key: string, vars?: Record<string, string | number>) =>
      vars === undefined ? key : `${key}(${Object.values(vars).join(",")})`,
  };
});

// The hosted adapter clears the edge's cache on delivery; outside a request
// there is no cache, which that module already tolerates.
vi.mock("next/cache", () => ({ revalidateTag: () => undefined }));

// ── The job platform ────────────────────────────────────────────────────

interface QueuedEvent {
  name: string;
  data: Record<string, unknown>;
  runAt: Date;
}

const queued: QueuedEvent[] = [];

vi.mock("@/jobs/client", () => ({
  sendJobEvent: async (name: string, data: Record<string, unknown>, options: { at?: Date } = {}) => {
    queued.push({ name, data, runAt: options.at ?? new Date(Date.now()) });
  },
}));

// ── The site's own pages, and the hosted edge ───────────────────────────

const SITE_DOMAIN = "acme.example";
const HOST = `content.${SITE_DOMAIN}`;

/** What a published hosted address answers: the page's own title and
 *  body, rendered by the one Markdown renderer the template uses. */
async function hostedAnswer(url: string): Promise<{ status: number; html: string }> {
  const publication = db.rows("publications").find((row) => row.live_url === url);
  const draft = db.rows("drafts").find((row) => row.id === publication?.draft_id);
  if (publication === undefined || draft === undefined) return { status: 404, html: "" };
  const { renderMarkdownHtml } = await import("../../src/lib/publish/render/markdown");
  return {
    status: 200,
    html:
      `<html><head><title>${String(draft.title)}</title>` +
      `<link rel="canonical" href="${url}"></head>` +
      `<body><h1>${String(draft.title)}</h1>${renderMarkdownHtml(String(draft.body_md))}</body></html>`,
  };
}

function answer(url: string, status: number, body: string, type: string) {
  return {
    ok: status >= 200 && status < 300,
    status,
    url,
    html: body,
    bytes: body.length,
    readAt: new Date(Date.now()),
    headers: { "content-type": type },
  };
}

vi.mock("@/lib/egress", () => ({
  resolvesInDns: async () => true,
  readRobots: async (origin: string) => ({
    ok: true,
    origin,
    readAt: new Date(Date.now()),
    disallowsAll: false,
    disallowedAgents: {},
    sitemaps: [`https://${HOST}/sitemap.xml`],
    absent: false,
  }),
  safeFetch: async (url: string) => {
    const parsed = new URL(url);
    if (parsed.pathname.endsWith("sitemap.xml")) {
      const entries = db
        .rows("publications")
        .filter((row) => row.published_at !== null && row.published_at !== undefined)
        .map((row) => `<url><loc>${String(row.live_url)}</loc></url>`)
        .join("");
      return answer(url, 200, `<?xml version="1.0"?><urlset>${entries}</urlset>`, "application/xml");
    }
    const page = await hostedAnswer(url);
    return answer(url, page.status, page.html, "text/html");
  },
}));

// ── Anthropic ───────────────────────────────────────────────────────────

/** Seven evenings, seven questions, and seven pages that are each their
 *  own page — §8's near-duplicate rule compares every draft against the
 *  site's queued and published ones, so a week of one body would be a week
 *  of one page. Every page states the grounded passage word for word and
 *  links its source, and names no brand in its opening. */
const TOPICS = [
  [
    "project management software",
    "Count the people who open it every day before you look at a single plan. Seat limits bite late, " +
      "long after the trial is over, and a board nobody opens is only a list of good intentions.",
  ],
  [
    "task tracking tools",
    "Watch how work moves between colleagues this week. Handoffs lost in chat threads are the real " +
      "cost; assignment, due dates and a visible owner fix more than any dashboard ever will.",
  ],
  [
    "team planning apps",
    "Decide how far ahead your quarter is actually committed. Roadmaps drawn eighteen months out rot " +
      "quietly, while a six-week horizon with honest estimates survives contact with reality.",
  ],
  [
    "kanban boards for small teams",
    "Sketch the stages a card travels through on paper first. Five columns usually suffice; limiting " +
      "work in progress matters far more than colour labels, swimlanes or clever automation rules.",
  ],
  [
    "client project portals",
    "List exactly what customers should see without asking you. Approvals, files and milestone " +
      "status belong outside; internal debate, rough estimates and margins stay firmly inside.",
  ],
  [
    "resource planning software",
    "Look at who is overbooked next Tuesday, not next year. Capacity views earn their keep when " +
      "holidays, part-time schedules and shifting priorities appear together on one screen.",
  ],
  [
    "agency project software",
    "Trace how billable hours reach an invoice today. Retainers, fixed-fee scopes and change requests " +
      "each leak money differently, and timesheets filled in on Friday afternoon hide all three.",
  ],
] as const;

function pageFor(query: string) {
  const index = Math.max(0, TOPICS.findIndex(([topic]) => query.includes(topic)));
  const [topic, advice] = TOPICS[index] ?? TOPICS[0];
  const title = `Which ${topic} should a small team pick?`;
  const markdown = [
    `## ${title}`,
    "",
    advice,
    "",
    "Teams on the starter plan get 25 seats and unlimited projects for a flat",
    `monthly fee, per [the published pricing page](https://${SITE_DOMAIN}/pricing).`,
  ].join("\n");
  return {
    title,
    slug: topic.replace(/\s+/g, "-"),
    description: `Choosing ${topic} for a small team.`,
    bodyMarkdown: markdown,
  };
}

const modelCalls: string[] = [];

vi.mock("@anthropic-ai/sdk", () => {
  class FakeAnthropic {
    messages = {
      create: async (request: { messages: { content: string }[] }) => {
        const input = request.messages[0]?.content ?? "";
        const asked = JSON.parse(input) as {
          task: string;
          sections?: unknown[];
          opportunity?: { targetQuery?: string };
        };
        modelCalls.push(asked.task);
        const page = pageFor(asked.opportunity?.targetQuery ?? "");
        const answerFor = asked.task.startsWith("Write the brief")
          ? {
              readerQuestion: page.title,
              angle: "count what matters first",
              mustCover: ["seats"],
              factIndexes: [0],
            }
          : asked.task.startsWith("Write one heading")
            ? { headings: (asked.sections ?? []).map((_s, i) => (i === 0 ? page.title : `Section ${i + 1}`)) }
            : asked.task.startsWith("Make the page")
              ? { title: "", description: "", order: [0], firstBlock: "", insertFacts: [] }
              : page;
        return {
          content: [{ type: "text", text: JSON.stringify(answerFor) }],
          usage: { input_tokens: 800, output_tokens: 400 },
        };
      },
    };
  }
  return { default: FakeAnthropic };
});

// ── The weekly measurement ──────────────────────────────────────────────

const weeklyPasses: { scanId: string; tier: string }[] = [];

vi.mock("@/lib/scan/run", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/lib/scan/run")>();
  return {
    ...actual,
    runScan: async (a: { scanId?: string; tier: string }) => {
      if (a.scanId === undefined) throw new Error("the week harness only runs the claimed weekly pass");
      weeklyPasses.push({ scanId: a.scanId, tier: a.tier });
      const fixtures = await import("../generate/fixtures");
      const row = db.rows("scans").find((scan) => scan.id === a.scanId);
      if (row === undefined) throw new Error("the weekly pass ran without its claimed row");
      // What `store_current_report` leaves on the claimed row.
      Object.assign(row, {
        status: "done",
        // Measured under the site's own domain, as the pass measures it, and
        // stored as jsonb stores it — dates as strings.
        report: JSON.parse(JSON.stringify(fixtures.report({ domain: SITE_DOMAIN as never }))),
        completed_at: new Date(Date.now()).toISOString(),
      });
      return { scanId: a.scanId, status: "done" };
    },
  };
});

// ── The modules, after the fixtures above are in place ──────────────────

const { runJob } = await import("../../src/jobs/run");
const { draftGenerate } = await import("../../src/jobs/draft-generate");
const { publishExecute } = await import("../../src/jobs/publish-execute");
const { publishVerify } = await import("../../src/jobs/publish-verify");
const { publishRetry } = await import("../../src/jobs/publish-retry");
const { weeklyRefresh } = await import("../../src/jobs/weekly-refresh");
const { setGenerateStore } = await import("../../src/lib/generate");
const { setOpportunityStore } = await import("../../src/lib/opportunities");
const { registerActiveAccessGate } = await import("../../src/lib/scan/weekly/access");
const { __setVendorTransportForTesting } = await import("../../src/lib/mail/vendor/resend");
const { VETO } = await import("../../src/lib/config/constants");
const generateFixtures = await import("../generate/fixtures");
const opportunityDoubles = await import("../opportunities/memory-store");

import type { JobDefinition, Outcome } from "../../src/jobs/types";

const SITE_ID = generateFixtures.SITE_ID;
const SCAN_ID = generateFixtures.SCAN_ID;
const USER_ID = "44444444-4444-4444-8444-444444444444";
const DEST_ID = "dest-journey-08";
const TIME_ZONE = "America/New_York";
const EMAIL = "founder@acme.example";

/** The week: Tuesday 00:00 UTC to the Tuesday after, one tick an hour. The
 *  site's own Monday (14 September, New York) falls inside it. */
const WEEK_START = new Date("2026-09-08T00:00:00.000Z");
const WEEK_HOURS = 7 * 24;
const HOUR = 3_600_000;

const SOURCE_HTML =
  "<html><body><h1>Pricing</h1><p>Teams on the starter plan get 25 seats and " +
  "unlimited projects for a flat monthly fee.</p><p>Larger teams talk to us.</p></body></html>";

interface SentMail {
  to: string[];
  subject: string;
  html: string;
}
const inbox: SentMail[] = [];

interface Invocation {
  at: Date;
  job: string;
  outcome: Outcome;
}
const runs: Invocation[] = [];

/** §8's store and §9's are one `drafts` table; journey 05's join, here. */
function joinedGenerateStore(): ReturnType<typeof generateFixtures.memoryStore> {
  const inner = generateFixtures.memoryStore({
    site: {
      id: SITE_ID,
      domain: SITE_DOMAIN,
      category: "project management software",
      voiceText: null,
      doNotClaim: [],
      rivals: [],
    },
  });
  const insertDraft = inner.insertDraft.bind(inner);
  const patchDraft = inner.patchDraft.bind(inner);
  inner.insertDraft = async (row) => {
    const id = await insertDraft(row);
    db.rows("drafts").push({
      id,
      site_id: SITE_ID,
      opportunity_id: row.opportunity_id,
      state: row.state,
      title: row.title,
      body_md: row.body_md,
      meta: row.meta ?? {},
      transitions: [],
      hard_rules_passed: false,
      publishable_since: null,
      veto_deadline: null,
      approved_at: null,
      approved_by: null,
      told: null,
      veto_token_hash: null,
      veto_token_expires_at: null,
      veto_token_used_at: null,
      scheduled_for: row.scheduled_for,
      created_at: new Date(Date.now()).toISOString(),
    });
    return id;
  };
  inner.patchDraft = async (draftId, patch) => {
    await patchDraft(draftId, patch);
    const row = db.rows("drafts").find((d) => d.id === draftId);
    if (row === undefined) return;
    for (const column of ["state", "title", "body_md", "hard_rules_passed", "scheduled_for"]) {
      if (column in patch) row[column] = (patch as Record<string, unknown>)[column];
    }
  };
  return inner;
}

/** Seven opportunities §7 left for the week, one per evening. */
async function seedTheWeeksSupply(
  opportunities: ReturnType<typeof opportunityDoubles.newMemoryState>
): Promise<void> {
  const store = opportunityDoubles.memoryStore(opportunities);
  for (const [topic] of TOPICS) {
    const query = `best ${topic}`;
    const slug = topic.replace(/\s+/g, "-");
    const seedRow = generateFixtures.opportunity({ targetQuery: query, targetRef: slug });
    const inserted = await store.insert({
      site_id: SITE_ID,
      scan_id: SCAN_ID,
      type: seedRow.type,
      family: seedRow.family,
      target_query: query,
      target_ref: slug,
      proposed_slug: slug,
      title: `What's the best ${topic}?`,
      volume: 1900,
      evidence: { ...seedRow.evidence, query } as never,
      acceptance: { form: "top20", query },
      fit_band: seedRow.fitBand,
      effort: seedRow.effort,
    });
    if (inserted.outcome !== "created") throw new Error(`the fixture opportunity for ${topic} was refused`);
    db.rows("opportunities").push({
      id: inserted.row.id,
      site_id: SITE_ID,
      scan_id: SCAN_ID,
      proposed_slug: slug,
      target_query: query,
      volume: 1900,
      // The acceptance test Monday's verdict reads, as §7 stored it.
      acceptance: { form: "top20", query },
      evidence: { ...seedRow.evidence, query },
    });
  }
}

/** One hour of the platform, each invocation through `runJob()`, once per
 *  idempotency key: the events whose moment is this hour's, then every cron
 *  job, then the events those sent whose moment has come. An event stamped
 *  for 09:00 is delivered at 09:00 — the hourly publish tick on the same
 *  hour is its backstop, not its carrier (issue #790). */
const CRON_JOBS: readonly JobDefinition[] = [draftGenerate, publishRetry, weeklyRefresh];
const EVENT_JOBS: Readonly<Record<string, JobDefinition>> = {
  "publish/execute": publishExecute,
  "publish/verify": publishVerify,
};
const delivered = new Set<string>();

/** The moment a queued event runs: its stamp plus its job's declared delay. */
function dueAt(event: QueuedEvent): number {
  const job = EVENT_JOBS[event.name];
  if (job === undefined) throw new Error(`no job listens for ${event.name}`);
  const delay = job.trigger.kind === "event" ? (job.trigger.afterHours ?? 0) : 0;
  return event.runAt.getTime() + delay * HOUR;
}

async function tick(now: Date): Promise<void> {
  vi.setSystemTime(now);
  await deliverDueEvents(now);
  for (const job of CRON_JOBS) {
    runs.push({ at: now, job: job.id, outcome: await runJob(job, { data: {}, now }) });
  }
  await deliverDueEvents(now);
}

/** Events sent during this tick, or before it, whose moment has come. */
async function deliverDueEvents(now: Date): Promise<void> {
  for (;;) {
    const next = queued.find((event) => dueAt(event) <= now.getTime());
    if (next === undefined) break;
    queued.splice(queued.indexOf(next), 1);
    const job = EVENT_JOBS[next.name]!;
    const key = `${job.id}:${job.idempotencyKey.map((k) => String(next.data[k])).join(",")}`;
    if (delivered.has(key)) continue;
    delivered.add(key);
    runs.push({ at: now, job: job.id, outcome: await runJob(job, { data: next.data, now }) });
  }
}

let weekRan = false;

async function leaveTheSiteAloneForAWeek(): Promise<void> {
  if (weekRan) return;
  weekRan = true;
  for (let hour = 0; hour <= WEEK_HOURS; hour += 1) {
    await tick(new Date(WEEK_START.getTime() + hour * HOUR));
  }
}

function setUpTheSite(): void {
  db.reset();
  installTransitionRpc(db);
  // The product's day ledger, summed from the `fetches` rows this week
  // wrote — an unanswered read would refuse every paid call (issue 792).
  db.rpcs.set("fetches_spend_since", (args: Row) =>
    db
      .rows("fetches")
      // A row inserted here carries no `created_at`; the column's default
      // is now(), so it counts toward today.
      .filter((row) => row.created_at === undefined || String(row.created_at) >= String(args.p_since))
      .reduce((total, row) => total + Number(row.cost_cents ?? 0), 0)
  );
  db.uniqueIndexes.push({
    table: "scans",
    columns: ["site_id", "week_start"],
    where: (row) => row.tier === "weekly",
  });
  db.seed("users", [{ id: USER_ID, email: EMAIL, notify: null }]);
  db.seed("sites", [
    {
      id: SITE_ID,
      user_id: USER_ID,
      domain: SITE_DOMAIN,
      mode: "autopilot",
      veto_hours: VETO.defaultHours,
      publish_time: "09:00",
      publishing_enabled: true,
      timezone: TIME_ZONE,
      category: "project management software",
    },
  ]);
  db.seed("destinations", [
    {
      id: DEST_ID,
      site_id: SITE_ID,
      kind: "hosted",
      health: "ok",
      publish_capable: true,
      hostname: HOST,
      hostname_state: "live",
      deleted_at: null,
      config: null,
    },
  ]);
  db.seed("drafts", []);
  db.seed("publications", []);
  db.seed("opportunities", []);
  // The deep pass at setup: the scan that grounds every page this week, and
  // the one own-document read §8 reads the fact from.
  db.seed("scans", [
    {
      id: SCAN_ID,
      site_id: SITE_ID,
      domain: SITE_DOMAIN,
      tier: "deep",
      status: "done",
      is_current: true,
      report: generateFixtures.report(),
      created_at: "2026-09-07T12:00:00.000Z",
    },
  ]);
  db.seed("fetches", [
    {
      scan_id: SCAN_ID,
      source: "egress.safeFetch",
      cost_cents: 0,
      payload: {
        url: `https://${SITE_DOMAIN}/pricing`,
        status: 200,
        html: SOURCE_HTML,
        bytes: SOURCE_HTML.length,
        readAt: "2026-09-07T12:00:00.000Z",
      },
    },
  ]);
}

beforeEach(async () => {
  if (weekRan) return;
  vi.useFakeTimers({ toFake: ["Date"] });
  setUpTheSite();
  const market = generateFixtures.report().market;
  const opportunities = opportunityDoubles.newMemoryState({
    now: WEEK_START,
    // The profile the deep pass measured, which is what supply ranks on.
    profile: market.kind === "unmeasured" ? null : market.value.profile,
  });
  setOpportunityStore(opportunityDoubles.memoryStore(opportunities));
  await seedTheWeeksSupply(opportunities);
  setGenerateStore(joinedGenerateStore());
  registerActiveAccessGate(async (siteIds) => new Set(siteIds));
  __setVendorTransportForTesting(async (payload: string) => {
    inbox.push(JSON.parse(payload) as SentMail);
    return { status: 200, headers: {}, body: JSON.stringify({ id: `resend-${inbox.length}` }) };
  });
});

afterEach(() => {
  vi.useRealTimers();
});

const WEEK_TIMEOUT_MS = 120_000;

function mailsOf(prefix: string): SentMail[] {
  return inbox.filter((mail) => mail.subject.startsWith(prefix));
}

/** The site-local calendar day a moment falls on. */
function localDay(at: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(at);
}

function dayLedger(): Record<string, string[]> {
  const ledger: Record<string, string[]> = {};
  const note = (at: Date, what: string) => {
    (ledger[localDay(at)] ??= []).push(what);
  };
  for (const run of runs) {
    if (run.outcome.outcome === "skipped") continue;
    note(run.at, `${run.job}:${run.outcome.outcome}`);
  }
  return ledger;
}

describe("one site, left alone for a week (issue 323)", () => {
  it(
    "the week, day by day, in the site's own calendar — every hour that did something, and nothing else",
    async () => {
      await leaveTheSiteAloneForAWeek();
      // The record issue 323 asks for. Each evening prepares tomorrow's page
      // and tells the customer; its 24-hour window runs out the next evening
      // and it goes out at the following 09:00, so the first page is live on
      // Thursday; the check runs a day after each go-live; the site's own
      // Monday is measured at 06:00, before that morning's page goes out.
      // Each page goes out through the `publish/execute` its evening sent
      // for that 09:00 (issue #790) — the hourly sweep finds nothing left.
      expect(dayLedger()).toEqual({
        "2026-09-08": ["draft/generate:ran"],
        "2026-09-09": ["draft/generate:ran"],
        "2026-09-10": ["publish/execute:ran", "draft/generate:ran"],
        "2026-09-11": ["publish/execute:ran", "publish/verify:ran", "draft/generate:ran"],
        "2026-09-12": ["publish/execute:ran", "publish/verify:ran", "draft/generate:ran"],
        "2026-09-13": ["publish/execute:ran", "publish/verify:ran", "draft/generate:ran"],
        "2026-09-14": ["weekly/refresh:ran", "publish/execute:ran", "publish/verify:ran", "draft/generate:ran"],
      });
      // Four model steps a page, seven pages, and not one regeneration.
      expect(modelCalls).toHaveLength(7 * 4);
    },
    WEEK_TIMEOUT_MS
  );


  it(
    "every evening the tick prepares a page, and every page enters review with the customer told",
    async () => {
      await leaveTheSiteAloneForAWeek();

      const generated = runs.filter((run) => run.job === "draft/generate" && run.outcome.outcome !== "skipped");
      // One evening a day, at the site's own due hour, and nothing degraded.
      expect(generated.map((run) => run.outcome)).toEqual(
        Array.from({ length: 7 }, () => ({ outcome: "ran", subjectId: null }))
      );
      expect(new Set(generated.map((run) => localDay(run.at))).size).toBe(7);

      const drafts = db.rows("drafts");
      expect(drafts).toHaveLength(7);
      for (const draft of drafts) {
        expect(draft.hard_rules_passed).toBe(true);
        expect(draft.veto_deadline).not.toBeNull();
        expect(draft.told).not.toBeNull();
      }
      expect(mailsOf("mail.draftReady")).toHaveLength(7);
      expect(mailsOf("mail.draftReady").every((mail) => mail.to[0] === EMAIL)).toBe(true);
    },
    WEEK_TIMEOUT_MS
  );

  it(
    "each page publishes on its own at the end of its window, to the hosted destination, one a day",
    async () => {
      await leaveTheSiteAloneForAWeek();

      const published = db.rows("publications").filter((row) => row.published_at !== null);
      expect(published.length).toBeGreaterThanOrEqual(5);
      for (const publication of published) {
        expect(publication.destination).toBe("hosted");
        expect(String(publication.live_url).startsWith(`https://${HOST}/`)).toBe(true);
        const draft = db.rows("drafts").find((row) => row.id === publication.draft_id)!;
        // Never before its window ran out, and nobody but the clock moved it.
        expect(new Date(String(publication.published_at)).getTime()).toBeGreaterThanOrEqual(
          new Date(String(draft.veto_deadline)).getTime()
        );
        const actors = (draft.transitions as { to: string; actor: { kind: string } }[]).map((t) => t.actor.kind);
        expect(actors.every((kind) => kind === "system")).toBe(true);
      }
      const days = published.map((row) => localDay(new Date(String(row.published_at))));
      expect(new Set(days).size).toBe(days.length);
    },
    WEEK_TIMEOUT_MS
  );

  it(
    "twenty-four hours after each page went live, the check records what it saw and the customer is told",
    async () => {
      await leaveTheSiteAloneForAWeek();

      const published = db.rows("publications").filter((row) => row.published_at !== null);
      const dueByNow = published.filter(
        (row) => new Date(String(row.published_at)).getTime() + 24 * HOUR <= WEEK_START.getTime() + WEEK_HOURS * HOUR
      );
      expect(dueByNow.length).toBeGreaterThanOrEqual(4);
      for (const publication of dueByNow) {
        const verify = publication.verify as { outcome?: string } | null;
        expect(["found", "absent", "unconfirmed"]).toContain(verify?.outcome);
      }
      expect(mailsOf("mail.published")).toHaveLength(dueByNow.length);
    },
    WEEK_TIMEOUT_MS
  );

  it(
    "on the site's own Monday the week is measured once, every live page is judged, and the digest leaves",
    async () => {
      await leaveTheSiteAloneForAWeek();

      expect(weeklyPasses).toHaveLength(1);
      const monday = runs.filter((run) => run.job === "weekly/refresh" && run.outcome.outcome !== "skipped");
      expect(monday).toHaveLength(1);
      expect(localDay(monday[0]!.at)).toBe("2026-09-14");
      expect(monday[0]!.outcome).toEqual({ outcome: "ran", subjectId: null });

      const liveByMonday = db
        .rows("publications")
        .filter((row) => row.published_at !== null && new Date(String(row.published_at)) <= monday[0]!.at);
      const verdicts = db.rows("page_verdicts");
      expect(new Set(verdicts.map((row) => row.publication_id))).toEqual(
        new Set(liveByMonday.map((row) => row.id))
      );
      // #795: each page was given its test when it was claimed, and each is
      // judged by it — the week's one question names none of these searches,
      // and not one page reads untracked.
      for (const publication of liveByMonday) {
        const draft = db.rows("drafts").find((row) => row.id === publication.draft_id)!;
        const opportunity = db.rows("opportunities").find((row) => row.id === draft.opportunity_id)!;
        expect(publication.acceptance).toEqual(opportunity.acceptance);
      }
      expect(verdicts.filter((row) => row.verdict === "not_judgeable").map((row) => row.cause)).toEqual([]);
      expect(mailsOf("mail.weekly")).toHaveLength(1);
    },
    WEEK_TIMEOUT_MS
  );

  it(
    "no hour of the week failed, and nothing a person would have to do was left undone",
    async () => {
      await leaveTheSiteAloneForAWeek();
      const troubled = runs.filter((run) => run.outcome.outcome === "degraded" || run.outcome.outcome === "stopped");
      expect(troubled).toEqual([]);
      // Every event whose moment came inside the week ran; the ones still
      // waiting are due after the last tick.
      const end = WEEK_START.getTime() + WEEK_HOURS * HOUR;
      expect(queued.filter((event) => dueAt(event) <= end)).toEqual([]);
    },
    WEEK_TIMEOUT_MS
  );
});
