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
import { fakeDb, installTransitionRpc, type FakeDb, type Row } from "../publish/harness";
import { toolUseMessage } from "../llm/fixtures";
import type { FetchOutcome, RobotsPolicy } from "../../src/lib/egress/types";

// Vercel's domain list is bound, so the hosted health refresh asks it.
process.env.VERCEL_API_TOKEN = "token-journey-10";
process.env.VERCEL_PROJECT_ID = "prj_journey_10";

// ── Postgres ────────────────────────────────────────────────────────────

const db: FakeDb = fakeDb();

/** The storing double, plus the one builder member it does not carry
 *  (`upsert`, the site profile's write) and what a storing double cannot
 *  know: each table's column defaults, and that a nullable column the
 *  insert left out reads `null`, not absent. */
const COLUMN_DEFAULTS: Readonly<Record<string, () => Row>> = {
  scans: () => ({ digest_sent_at: null, report: null, is_current: false, created_at: new Date().toISOString() }),
  opportunities: () => ({
    status: "open",
    ready: false,
    unready_reason: "not_assessed",
    absorbed_queries: [],
    cluster_key: null,
    created_at: new Date().toISOString(),
    status_changed_at: new Date().toISOString(),
  }),
  drafts: () => ({
    body_md: null,
    meta: null,
    grounded_fact: null,
    cost_cents: 0,
    scheduled_for: null,
    veto_deadline: null,
    attribution: null,
    hard_rule_attempts: 0,
    rule_failures: null,
    claim_check: null,
    transitions: [],
    publishable_since: null,
    hard_rules_passed: false,
    opened_at: null,
    veto_reminded_at: null,
    approved_at: null,
    approved_by: null,
    told: null,
    veto_token_hash: null,
    veto_token_expires_at: null,
    veto_token_used_at: null,
    created_at: new Date().toISOString(),
  }),
  fetches: () => ({ created_at: new Date().toISOString() }),
};

const client = {
  from(table: string) {
    const builder = (db.client as { from(t: string): Record<string, unknown> }).from(table) as {
      insert(values: Row | Row[]): unknown;
      upsert?: (values: Row, opts?: { onConflict?: string }) => unknown;
    };
    const insert = builder.insert.bind(builder);
    const defaults = COLUMN_DEFAULTS[table];
    builder.insert = (values: Row | Row[]) => {
      if (Array.isArray(values) && values.length !== 1) throw new Error(`journey 10: a ${values.length}-row insert into ${table}`);
      const one = Array.isArray(values) ? values[0]! : values;
      return insert(defaults === undefined ? one : { ...defaults(), ...one });
    };
    builder.upsert = (values: Row, opts: { onConflict?: string } = {}) => {
      const key = opts.onConflict ?? "id";
      const held = db.rows(table).find((row) => row[key] === values[key]);
      if (held !== undefined) {
        Object.assign(held, values);
        return Promise.resolve({ data: [held], error: null });
      }
      return builder.insert(values);
    };
    return builder;
  },
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

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  redirect: (to: string) => {
    throw new Error(`journey 10: redirected to ${to}`);
  },
}));
// The hosted adapter clears the edge's cache on delivery; outside a request
// there is no cache, which that module already tolerates. A Server Function
// revalidates the app it changed (issue 837).
vi.mock("next/cache", () => ({ revalidateTag: () => undefined, revalidatePath: () => undefined }));

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

vi.mock("@/app/(account)/setup/_setup/provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/app/(account)/setup/_setup/provider")>();
  const { liveSetupStore } = await import("../../src/app/(account)/setup/_setup/store");
  return { ...actual, setupStore: () => liveSetupStore() };
});

// ── The job platform ────────────────────────────────────────────────────

interface QueuedEvent {
  name: string;
  data: Record<string, unknown>;
  at: Date | null;
}
const queued: QueuedEvent[] = [];

vi.mock("@/jobs/client", () => ({
  sendJobEvent: async (name: string, data: Record<string, unknown>, options: { at?: Date } = {}) => {
    queued.push({ name, data, at: options.at ?? null });
  },
}));

// ── The market ──────────────────────────────────────────────────────────

const DOMAIN = "reachkit.app";
const HOST = `content.${DOMAIN}`;
const CATEGORY = "seo software";
const GIANTS = { "zapier.com": 218_224, "ahrefs.com": 59_767 } as const;
const SMALL = "briefkit.io";
const SMALL_RANKED = 80;
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

function envelope(result: unknown): unknown {
  return { tasks: [{ id: "task-fixture", status_code: 20000, status_message: "Ok.", result: [result] }] };
}

function rankedEnvelope(rows: readonly (readonly [string, number, string])[], total: number): unknown {
  return envelope({
    total_count: total,
    items: rows.map(([keyword, volume, url], i) => ({
      keyword_data: { keyword, keyword_info: { search_volume: volume } },
      ranked_serp_element: { serp_item: { rank_group: 8 + i, url } },
    })),
  });
}

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
    const total = target === SMALL ? SMALL_RANKED : (GIANTS[target as keyof typeof GIANTS] ?? 0);
    return rankedEnvelope([[`${target.split(".")[0]} alternatives`, 20, `https://${target}/`]], total);
  }
  // Every SERP: the giants on top, the small domain of a long-tail search below.
  return envelope({
    items: [
      { type: "organic", rank_group: 1, domain: "zapier.com", url: "https://zapier.com/blog/seo", title: "Zapier" },
      { type: "organic", rank_group: 2, domain: "ahrefs.com", url: "https://ahrefs.com/blog/seo", title: "Ahrefs" },
      { type: "organic", rank_group: 3, domain: SMALL, url: `https://${SMALL}/templates`, title: "BriefKit" },
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

function outcome(url: string, status: number, body: string): FetchOutcome {
  return {
    ok: true,
    status,
    url,
    html: body,
    bytes: body.length,
    readAt: new Date(),
    headers: {},
  } as FetchOutcome;
}

vi.mock("@/lib/egress/safe-fetch", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  safeFetch: async (url: string, opts: { method?: string; body?: string } = {}): Promise<FetchOutcome> => {
    if (url.startsWith("https://api.vercel.com/")) {
      vercelDomainCalls.push(`${opts.method ?? "GET"} ${url}`);
      return outcome(url, 200, JSON.stringify({ name: HOST, verified: recordPointed }));
    }
    return outcome(url, 200, HOME_HTML);
  },
}));

vi.mock("@/lib/egress/robots", () => ({
  readRobots: async (origin: string): Promise<RobotsPolicy> => ({
    ok: true,
    origin,
    readAt: new Date(),
    disallowsAll: false,
    disallowedAgents: {},
    sitemaps: [],
    absent: false,
  }),
}));

vi.mock("@/lib/egress/dns", () => ({
  resolvesInDns: async (host: string) => host === DOMAIN,
  hostnameTaken: async () => false,
}));

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

vi.mock("@anthropic-ai/sdk", () => {
  class FakeAnthropic {
    messages = {
      create: async (request: { messages: { content: string }[] }) => {
        const input = request.messages[0]?.content ?? "";
        const asked = JSON.parse(input) as Record<string, unknown> & { task?: string };
        const task = String(asked.task ?? (input.includes('"home"') ? "profile" : "unknown"));
        modelTasks.push(task);
        const text = (answer: unknown) => ({
          content: [{ type: "text", text: JSON.stringify(answer) }],
          usage: { input_tokens: 800, output_tokens: 300 },
        });
        if (task.startsWith("Each entry under `keywords`")) {
          const keywords = asked.keywords as { id: string; keyword: string }[];
          return toolUseMessage(
            { questions: keywords.map((row) => ({ id: row.id, text: `What is the best ${row.keyword}?` })) },
            800,
            200,
            "question-phrasing"
          );
        }
        if (task.startsWith("Describe the business")) return text(PROFILE_ANSWER);
        if (task.startsWith("Label an already-derived")) {
          const typing = asked as unknown as { derivedType: string; derivedSlug: string; targetQuery: string };
          return text({ type: typing.derivedType, slug: typing.derivedSlug, title: `The best ${typing.targetQuery}` });
        }
        if (task.startsWith("Read the pages of one business")) {
          return text({
            siteName: "ReachKit",
            products: ["seo content"],
            claims: [],
            voice: {
              text: "Plain, calm and practical.",
              tone: "calm",
              person: "second",
              vocabulary: ["brief", "searches"],
              claimsToKeep: [],
              claimsToAvoid: [],
            },
          });
        }
        const page = pageFor(asked as Parameters<typeof pageFor>[0]);
        if (task.startsWith("Write the brief")) {
          return text({ readerQuestion: page.title, angle: "start from the searches", mustCover: ["searches"], factIndexes: [0] });
        }
        if (task.startsWith("Write one heading")) {
          const sections = (asked.sections as unknown[] | undefined) ?? [];
          return text({ headings: sections.map((_s, i) => (i === 0 ? page.title : `Section ${i + 1}`)) });
        }
        if (task.startsWith("Make the page")) {
          return text({ title: "", description: "", order: [0], firstBlock: "", insertFacts: [] });
        }
        if (task.startsWith("Decide whether the page states")) return text({ matches: false, matchedIndex: null });
        if (task.startsWith("Write the page")) return text(page);
        throw new Error(`journey 10: no model answer for task: ${task.slice(0, 80)}`);
      },
    };
  }
  return { default: FakeAnthropic };
});

// ── The modules, after the doubles above are in place ───────────────────

const { runJob } = await import("../../src/jobs/run");
const { scanRun } = await import("../../src/jobs/scan-run");
const { POST: setupRoute } = await import("../../src/app/api/setup/route");
const { setActiveAccessReader, resetActiveAccessReader } = await import(
  "../../src/app/(account)/setup/_setup/store"
);
const { registerActiveAccessGate } = await import("../../src/lib/scan/weekly/access");
const { setIdentityAuth } = await import("../../src/lib/account/identity/auth");
const { addAuthUser, fakeIdentityAuth, newFakeAuth, signedInCookie } = await import(
  "../account/identity/fake-auth"
);
const { __setVendorTransportForTesting } = await import("../../src/lib/mail/vendor/resend");
const { difficultyCeiling, qualifyingDemand } = await import("../../src/lib/opportunities/winnability/bars");
const { readOverviewFacts } = await import("../../src/app/(account)/app/_overview/store");
const { assembleOverview } = await import("../../src/app/(account)/app/_overview/model");
const { RivalModule } = await import("../../src/app/(account)/app/_overview/RivalModule");
const { renderToStaticMarkup } = await import("react-dom/server");
const { createElement } = await import("react");

import type { JobDefinition, Outcome } from "../../src/jobs/types";

const USER_ID = "44444444-4444-4444-8444-444444444410";
const SITE_ID = "22222222-2222-4222-8222-222222222210";
const EMAIL = "founder@reachkit.app";
const TIME_ZONE = "America/Chicago";

/** Sunday afternoon in the site's own zone: the founder finishes setup. */
const SUBMITTED_AT = new Date("2026-09-20T20:00:00.000Z");
const HOUR = 3_600_000;

interface SentMail {
  to: string[];
  subject: string;
  html: string;
}
const inbox: SentMail[] = [];
const runs: { job: string; outcome: Outcome }[] = [];

function setUpTheDatabase(): void {
  db.reset();
  installTransitionRpc(db);
  // One onboarding row per site, held by its primary key.
  db.uniqueIndexes.push({ table: "scans", columns: ["id"] });
  db.rpcs.set("fetches_spend_since", (args: Row) =>
    db
      .rows("fetches")
      .filter((row) => String(row.created_at) >= String(args.p_since))
      .reduce((total, row) => total + Number(row.cost_cents ?? 0), 0)
  );
  db.rpcs.set("append_scan_stage_event", () => null);
  // `apply_setup_choice`, as the migration writes it: the mode on the site,
  // and one destination created waiting for DNS.
  db.rpcs.set("apply_setup_choice", (args: Row) => {
    const site = db.rows("sites").find((row) => row.id === args.p_site_id);
    if (site === undefined) throw new Error("apply_setup_choice: no site");
    site.mode = args.p_mode;
    const id = "dest-journey-10";
    db.rows("destinations").push({
      id,
      site_id: args.p_site_id,
      kind: args.p_kind,
      config: null,
      health: "expired",
      health_reason: null,
      health_changed_at: new Date().toISOString(),
      last_checked_at: new Date().toISOString(),
      publish_capable: null,
      stamp_capable: null,
      hostname: args.p_hostname,
      hostname_state: args.p_hostname === null ? null : "pending_dns",
      hostname_checked_at: null,
      deleted_at: null,
    });
    return id;
  });
  // `store_current_report`: the claimed row takes the report and becomes
  // the domain's current one.
  db.rpcs.set("store_current_report", (args: Row) => {
    for (const row of db.rows("scans")) {
      if (row.domain === args.p_domain && args.p_make_current === true) row.is_current = false;
    }
    let row = db.rows("scans").find((scan) => scan.id === args.p_scan_id);
    if (row === undefined) {
      row = { id: args.p_scan_id, created_at: new Date().toISOString() };
      db.rows("scans").push(row);
    }
    Object.assign(row, {
      domain: args.p_domain,
      site_id: args.p_site_id,
      tier: args.p_tier,
      status: args.p_status,
      score: args.p_score,
      // jsonb columns: a later step reads back plain data, never the
      // objects the pass held.
      drivers: JSON.parse(JSON.stringify(args.p_drivers)),
      report: JSON.parse(JSON.stringify(args.p_report)),
      cost_cents: args.p_cost_cents,
      stopped_reason: args.p_stopped_reason,
      is_current: args.p_make_current,
      completed_at: new Date().toISOString(),
    });
    return null;
  });

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

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(SUBMITTED_AT);
  setUpTheDatabase();
  queued.length = 0;
  runs.length = 0;
  inbox.length = 0;
  modelTasks.length = 0;
  vendorRequests.length = 0;
  vercelDomainCalls.length = 0;
  recordPointed = false;

  setActiveAccessReader(async () => true);
  registerActiveAccessGate(async (siteIds) => new Set(siteIds));

  cookieJar.clear();
  const auth = newFakeAuth();
  addAuthUser(auth, { id: USER_ID, email: EMAIL });
  setIdentityAuth(fakeIdentityAuth(auth));
  const [name, value] = signedInCookie(auth, USER_ID).split("=") as [string, string];
  cookieJar.set(name, value);

  __setVendorTransportForTesting(async (payload: string) => {
    inbox.push(JSON.parse(payload) as SentMail);
    return { status: 200, headers: {}, body: JSON.stringify({ id: `resend-${inbox.length}` }) };
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
  collapseTimers();
});

const realSetTimeout = globalThis.setTimeout;

/** The standard queue's ten-second poll, collapsed for the deep pass
 *  (journey 04's reason): every timer fires at once. */
function collapseTimers(): void {
  vi.stubGlobal("setTimeout", ((fn: () => void) => {
    fn();
    return 0;
  }) as unknown as typeof setTimeout);
}

/** Real timers again once the pass is over: a delivery races its own
 *  timeout, and a timeout that fires at once is a delivery that timed out. */
function realTimers(): void {
  vi.stubGlobal("setTimeout", realSetTimeout);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  setIdentityAuth(null);
  resetActiveAccessReader();
  registerActiveAccessGate(null);
});

// ── The founder's steps, and the platform's ─────────────────────────────

async function submitSetup(): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await setupRoute(
    new Request("https://reachkit.example/api/setup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        domain: DOMAIN,
        category: CATEGORY,
        competitors: [...RIVALS],
        mode: "autopilot",
        destination: { kind: "hosted", label: "content" },
      }),
    }),
    undefined
  );
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

const EVENT_JOBS: Readonly<Record<string, JobDefinition>> = {
  "scan/run": scanRun,
};

/** Delivers every queued event of this name whose moment has come,
 *  through `runJob()`. */
async function deliver(name: string, now: Date): Promise<Outcome[]> {
  const job = EVENT_JOBS[name]!;
  const out: Outcome[] = [];
  for (;;) {
    const next = queued.find((event) => event.name === name && (event.at === null || event.at <= now));
    if (next === undefined) return out;
    queued.splice(queued.indexOf(next), 1);
    const result = await runJob(job, { data: next.data, now });
    runs.push({ job: job.id, outcome: result });
    out.push(result);
  }
}

const JOURNEY_TIMEOUT_MS = 60_000;

describe("a cold-start site is offered right-sized questions, reachable rivals and winnable targets (issue 858)", () => {
  it(
    "setup → deep pass → derivation: long-tail questions, far rivals kept out of 'your rivals', a ready winnable or reach write target, and an Overview that does not lead with a giant",
    async () => {
      const submitted = await submitSetup();
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

      // ── Write opportunities follow: at least one ready, winnable or reach.
      const writes = db
        .rows("opportunities")
        .filter((row) => row.site_id === SITE_ID && row.family === "write" && row.ready === true);
      expect(writes.length).toBeGreaterThanOrEqual(1);
      for (const row of writes) expect(["winnable", "reach"]).toContain(row.fit_band);
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
