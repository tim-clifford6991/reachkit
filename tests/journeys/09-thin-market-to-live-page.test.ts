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
import { fakeDb, installTransitionRpc, type FakeDb, type Row } from "../publish/harness";
import { toolUseMessage } from "../llm/fixtures";
import type { FetchOutcome, RobotsPolicy } from "../../src/lib/egress/types";

// Vercel's domain list is bound, so the hosted health refresh asks it.
process.env.VERCEL_API_TOKEN = "token-journey-09";
process.env.VERCEL_PROJECT_ID = "prj_journey_09";

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
      if (Array.isArray(values) && values.length !== 1) throw new Error(`journey 09: a ${values.length}-row insert into ${table}`);
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
    throw new Error(`journey 09: redirected to ${to}`);
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
 *  of thousands of keywords — and one small site among them. */
const GIANTS = ["zapier.com", "ahrefs.com", "forbes.com", "capterra.com", "g2.com"] as const;
const CROWDED_RIVAL_TOTALS: Record<string, number> = { [RIVALS[0]]: 218_224, [RIVALS[1]]: 59_767 };

/** Issue 837: the broader category that does have searches, once the founder
 *  picks it — its seed answers the thin market's rows. */
const BROADER = "private practice bookkeeping";
let broaderCategory: string | null = null;
THIN_SUGGESTIONS[BROADER] = THIN_SUGGESTIONS[CATEGORY]!;

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
      return rankedEnvelope(
        rows.map(([keyword, volume]) => [keyword, volume, `https://${target}/`] as const),
        CROWDED_RIVAL_TOTALS[target] ?? 0
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
  const title = `How should a therapist choose ${query}?`;
  const bodyMarkdown = [
    `## ${title}`,
    "",
    "Start with how session payments reach your bank. A practice that sees clients weekly needs each deposit " +
      "matched to a category the day it lands, not at the end of the quarter when receipts are lost.",
    "",
    `${asked.grounded?.passage ?? ""} Read [the published plan](${asked.grounded?.url ?? ""}).`,
  ].join("\n");
  return {
    title,
    slug: query.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    description: `Choosing ${query} for a private practice.`,
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
            siteName: "QuietBooks",
            products: ["bookkeeping software"],
            claims: [],
            voice: {
              text: "Plain, calm and practical.",
              tone: "calm",
              person: "second",
              vocabulary: ["practice", "sessions"],
              claimsToKeep: [],
              claimsToAvoid: [],
            },
          });
        }
        const page = pageFor(asked as Parameters<typeof pageFor>[0]);
        if (task.startsWith("Write the brief")) {
          return text({ readerQuestion: page.title, angle: "start from the deposits", mustCover: ["deposits"], factIndexes: [0] });
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
        throw new Error(`journey 09: no model answer for task: ${task.slice(0, 80)}`);
      },
    };
  }
  return { default: FakeAnthropic };
});

// ── The modules, after the doubles above are in place ───────────────────

const { runJob } = await import("../../src/jobs/run");
const { scanRun } = await import("../../src/jobs/scan-run");
const { publishExecute } = await import("../../src/jobs/publish-execute");
const engine = await import("../../src/jobs/engine");
const { POST: setupRoute } = await import("../../src/app/api/setup/route");
const { GET: sitemap } = await import("../../src/app/(hosted)/sitemap.xml/route");
const { setActiveAccessReader, resetActiveAccessReader } = await import(
  "../../src/app/(account)/setup/_setup/store"
);
const { registerActiveAccessGate } = await import("../../src/lib/scan/weekly/access");
const { setIdentityAuth } = await import("../../src/lib/account/identity/auth");
const { addAuthUser, fakeIdentityAuth, newFakeAuth, signedInCookie } = await import(
  "../account/identity/fake-auth"
);
const { __setVendorTransportForTesting } = await import("../../src/lib/mail/vendor/resend");
const { releaseNotice } = await import("../../src/lib/scan/deep/notice");
const { onboardingPanel } = await import("../../src/app/(account)/app/_shell/onboarding");
const { passProgressFor } = await import("../../src/lib/scan/deep/progress");
const { demandBand } = await import("../../src/lib/opportunities/winnability/band");
const { readCategoryChoice } = await import("../../src/app/(account)/app/_shell/remeasure");
const { remeasureAction } = await import("../../src/app/(account)/app/_shell/remeasure-actions");
const { qualifyingDemand } = await import("../../src/lib/opportunities/winnability/bars");

import type { JobDefinition, Outcome } from "../../src/jobs/types";

const USER_ID = "44444444-4444-4444-8444-444444444409";
const SITE_ID = "22222222-2222-4222-8222-222222222209";
const EMAIL = "founder@quietbooks.com";
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
    const id = "dest-journey-09";
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
      if (vendorLatencyS > 0) vi.setSystemTime(new Date(Date.now() + vendorLatencyS * 1000));
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
  "publish/execute": publishExecute,
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

function mailsOf(prefix: string): SentMail[] {
  return inbox.filter((mail) => mail.subject.startsWith(prefix));
}

const JOURNEY_TIMEOUT_MS = 60_000;

describe("a new site in a thin market goes from setup to a published right-sized page (issue 800)", () => {
  it(
    "setup → background deep pass → a right-sized ready opportunity → first draft in review → hosted publish → sitemap",
    async () => {
      // ── Setup: one submit, and the founder is released into the app.
      const submitted = await submitSetup();
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
      expect([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])).toEqual([liveUrl]);

      // Nothing on the way degraded.
      expect(runs.filter((run) => run.outcome.outcome !== "ran")).toEqual([]);
    },
    JOURNEY_TIMEOUT_MS
  );

  it(
    "a paid pass over a market with genuinely no demand records market too small, writes no page, and tells the founder and the owner",
    async () => {
      market = "none";
      expect((await submitSetup()).status).toBe(200);

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
      expect((await submitSetup()).status).toBe(200);
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
      expect((await submitSetup()).status).toBe(200);

      const [pass] = await deliver("scan/run", SUBMITTED_AT);
      realTimers();
      expect(pass).toEqual({ outcome: "ran", subjectId: expect.any(String) });

      const scan = db.rows("scans").find((row) => row.site_id === SITE_ID && row.tier === "deep")!;
      expect(scan.stopped_reason).toBe("complete");
      const report = scan.report as {
        questions: { kind: string; value: unknown[] };
        serps: { kind: string }[];
        rivals: { kind: string };
        rivalSizes: { kind: string; value: { band: string }[] };
      };
      // Every question the pass selected had its SERP measured.
      expect(report.questions.kind).toBe("measured");
      expect(report.questions.value).toHaveLength(12);
      expect(report.serps.map((serp) => serp.kind)).toEqual(report.questions.value.map(() => "measured"));
      expect(report.rivals.kind).toBe("measured");
      // The rivals were sized by this pass, and both are far from this site.
      expect(report.rivalSizes.kind).toBe("measured");
      expect(report.rivalSizes.value.map((size) => size.band)).toEqual(["far", "far"]);


      // SPEC §7 (issue 855): an update the hosted destination cannot deliver
      // is never the day's work and never a day of supply — it is not ready,
      // no draft is written from it, and supply does not count it.
      const fixes = db.rows("opportunities").filter((row) => row.site_id === SITE_ID && row.type === "fix_page");
      expect(fixes.length).toBeGreaterThan(0);
      for (const fix of fixes) expect(fix).toMatchObject({ ready: false, unready_reason: "destination_cannot_address" });
      const fixIds = new Set(fixes.map((row) => row.id));
      expect(db.rows("drafts").filter((row) => fixIds.has(row.opportunity_id))).toEqual([]);
      const { supplyDepth } = await import("../../src/lib/opportunities");
      // Issue 858: this market now yields ready write targets, so the pass's
      // first draft is written from one — that opportunity is queued, not unused.
      const drafted = new Set(db.rows("drafts").filter((row) => row.site_id === SITE_ID).map((row) => row.opportunity_id));
      expect(drafted.size).toBe(1);
      expect((await supplyDepth(SITE_ID)).unused).toBe(
        db
          .rows("opportunities")
          .filter((row) => row.site_id === SITE_ID && row.family !== "fix" && row.ready === true && !drafted.has(row.id)).length
      );
    },
    JOURNEY_TIMEOUT_MS
  );
});
