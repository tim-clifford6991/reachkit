// tests/journeys/harness.ts — the doubles the journeys share. Not a suite.
//
// A journey keeps its own market, its own pages and its own steps. What it
// stands them on — the copy registry by key, the job platform, the
// customer's server, the model, the mail vendor, the clock — is here, once.
// A `vi.mock` factory reaches it through a dynamic import, which runs after
// this file and the journey's own state exist:
//
//   vi.mock("next/headers", async () => (await import("./harness")).nextHeaders(cookieJar));
//
// The database double stays the one each journey already stands on
// (`../publish/harness` or `../scan/run/harness`): the two answer different
// questions, and this file imports neither.
import { vi } from "vitest";
import type { FetchOutcome, RobotsPolicy } from "../../src/lib/egress/types";
import type { JobDefinition, Outcome } from "../../src/jobs/types";
import type { FakeDb, Row } from "../publish/harness";

export const JOURNEY_TIMEOUT_MS = 60_000;

// ── Module doubles, for `vi.mock` ───────────────────────────────────────

/** The copy registry as its keys: mails and notices are asserted by key. */
export async function copyByKey(importOriginal: <T>() => Promise<T>) {
  const actual = await importOriginal<typeof import("@/lib/presentation/copy")>();
  return {
    ...actual,
    copy: (key: string, vars?: Record<string, string | number>) =>
      vars === undefined ? key : `${key}(${Object.values(vars).join(",")})`,
  };
}

/** No journey reaches a vendor from the research step: its reads and its
 *  one search are stood in for, and the page is written from the business's
 *  own facts. */
export async function researchStandIn(importOriginal: <T>() => Promise<T>) {
  const fixtures = await import("../generate/fixtures");
  return fixtures.researchStandIn(await importOriginal<object>());
}

/** What a pack must hold is `tests/generate/pipeline/pack.test.ts`'s; a
 *  journey's pack is built from what the run read and is short of nothing. */
export async function packStandIn(importOriginal: <T>() => Promise<T>) {
  const fixtures = await import("../generate/fixtures");
  return fixtures.packStandIn(await importOriginal<object>());
}

/** The job platform: `sendJobEvent` hands each event to the journey, and
 *  #971's stage push (`client.realtime`) is the no-op it is outside a run —
 *  a double without it throws on every stage. */
export function jobsClient(onSend: (name: string, data: Record<string, unknown>, at: Date | null) => void) {
  return {
    client: { realtime: { publish: async () => undefined } },
    sendJobEvent: async (name: string, data: Record<string, unknown>, options: { at?: Date } = {}) => {
      onSend(name, data, options.at ?? null);
    },
  };
}

/** `next/headers` over a cookie jar the journey holds. */
export function nextHeaders(cookieJar: Map<string, string>) {
  return {
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
  };
}

/** A redirect is a failure of the journey, named. */
export function nextNavigation(journey: string) {
  return {
    useRouter: () => ({ refresh: vi.fn() }),
    redirect: (to: string) => {
      throw new Error(`${journey}: redirected to ${to}`);
    },
  };
}

/** The hosted adapter clears the edge's cache on delivery and a Server
 *  Function revalidates the app it changed (issue 837); outside a request
 *  there is no cache. */
export function nextCache() {
  return { revalidateTag: () => undefined, revalidatePath: () => undefined };
}

/** A `robots.txt` that allows every page. */
export function openRobots(a: { readAt?: () => Date; disallowedAgents?: Record<string, boolean> } = {}) {
  return {
    readRobots: async (origin: string): Promise<RobotsPolicy> => ({
      ok: true,
      origin,
      readAt: a.readAt?.() ?? new Date(),
      disallowsAll: false,
      disallowedAgents: a.disallowedAgents ?? {},
      sitemaps: [],
      absent: false,
    }),
  };
}

/** A resolver that knows the customer's own domain and no other. */
export function dnsKnowing(domain: string) {
  return {
    resolvesInDns: async (host: string) => host === domain,
    hostnameTaken: async () => false,
  };
}

/** Setup's provider over the live store. */
export async function liveSetupProvider(importOriginal: <T>() => Promise<T>) {
  const actual = await importOriginal<typeof import("../../src/app/(account)/setup/_setup/provider")>();
  const { liveSetupStore } = await import("../../src/app/(account)/setup/_setup/store");
  return { ...actual, setupStore: () => liveSetupStore() };
}

// ── Vendor answers ──────────────────────────────────────────────────────

/** DataForSEO's envelope around one result. */
export function envelope(result: unknown): unknown {
  return { tasks: [{ id: "task-fixture", status_code: 20000, status_message: "Ok.", result: [result] }] };
}

/** `ranked_keywords` for one domain: its rows, and how many it ranks for. */
export function rankedEnvelope(rows: readonly (readonly [string, number, string])[], total: number): unknown {
  return envelope({
    total_count: total,
    items: rows.map(([keyword, volume, url], i) => ({
      keyword_data: { keyword, keyword_info: { search_volume: volume } },
      ranked_serp_element: { serp_item: { rank_group: 8 + i, url } },
    })),
  });
}

/** A page the customer's server answers with. */
export function pageOutcome(url: string, status: number, body: string): FetchOutcome {
  return { ok: true, status, url, html: body, bytes: body.length, readAt: new Date(), headers: {} } as FetchOutcome;
}

/** Anthropic's SDK client for a scan: the profile of the home page, the
 *  question phrasing (as the vendor answers under a forced tool, issue
 *  512), and §7's labeller, which keeps the type the evidence derived and
 *  proposes a slug and a title. Every input is recorded in `calls`. */
export function anthropicForScan(a: { profile: object; calls: string[] }) {
  class FakeAnthropic {
    messages = {
      create: async (request: { messages: { content: string }[] }) => {
        const input = request.messages[0]?.content ?? "";
        a.calls.push(input);
        if (input.includes("Label an already-derived")) {
          const asked = JSON.parse(input) as { derivedType: string; derivedSlug: string; targetQuery: string };
          const typing = { type: asked.derivedType, slug: asked.derivedSlug, title: `The best ${asked.targetQuery}` };
          return { content: [{ type: "text", text: JSON.stringify(typing) }], usage: { input_tokens: 900, output_tokens: 220 } };
        }
        if (input.includes('"home"')) {
          return { content: [{ type: "text", text: JSON.stringify(a.profile) }], usage: { input_tokens: 900, output_tokens: 220 } };
        }
        const { toolUseMessage } = await import("../llm/fixtures");
        const keywords = (JSON.parse(input) as { keywords: { id: string; keyword: string }[] }).keywords;
        return toolUseMessage(
          { questions: keywords.map((row) => ({ id: row.id, text: `What's the best ${row.keyword}?` })) },
          900,
          220,
          "question-phrasing"
        );
      },
    };
  }
  return { default: FakeAnthropic };
}

export interface SiteRead {
  siteName: string;
  products: string[];
  vocabulary: string[];
}

export interface WrittenPage {
  title: string;
  slug: string;
  description: string;
  bodyMarkdown: string;
}

/** Anthropic's SDK client, answering each of the pass's model tasks for one
 *  business: the profile, the question phrasing, the typing, the site read,
 *  an empty research read, and the one write call — the page `pageFor`
 *  builds for the pack's own target from its first fact. */
export function anthropicFor(a: {
  journey: string;
  profile: object;
  site: SiteRead;
  pageFor: (asked: { opportunity?: { targetQuery?: string | null }; grounded?: { url: string; passage: string } }) => WrittenPage;
  tasks: string[];
}) {
  class FakeAnthropic {
    messages = {
      create: async (request: { messages: { content: string }[] }) => {
        const input = request.messages[0]?.content ?? "";
        const asked = JSON.parse(input) as Record<string, unknown> & { task?: string };
        const task = String(asked.task ?? (input.includes('"home"') ? "profile" : "unknown"));
        a.tasks.push(task);
        const text = (answer: unknown) => ({
          content: [{ type: "text", text: JSON.stringify(answer) }],
          usage: { input_tokens: 800, output_tokens: 300 },
        });
        if (task.startsWith("Each entry under `keywords`")) {
          const { toolUseMessage } = await import("../llm/fixtures");
          const keywords = asked.keywords as { id: string; keyword: string }[];
          return toolUseMessage(
            { questions: keywords.map((row) => ({ id: row.id, text: `What is the best ${row.keyword}?` })) },
            800,
            200,
            "question-phrasing"
          );
        }
        if (task.startsWith("Describe the business")) return text(a.profile);
        if (task.startsWith("Label an already-derived")) {
          const typing = asked as unknown as { derivedType: string; derivedSlug: string; targetQuery: string };
          return text({ type: typing.derivedType, slug: typing.derivedSlug, title: `The best ${typing.targetQuery}` });
        }
        if (task.startsWith("Read the pages of one business")) {
          return text({
            siteName: a.site.siteName,
            products: a.site.products,
            claims: [],
            voice: {
              text: "Plain, calm and practical.",
              tone: "calm",
              person: "second",
              vocabulary: a.site.vocabulary,
              claimsToKeep: [],
              claimsToAvoid: [],
            },
          });
        }
        if (task.startsWith("Copy out the claims")) return text({ claims: [] });
        if (task.startsWith("Write one page")) {
          const pack = asked.pack as { target: { question: string }; facts: { url: string; passage: string }[] };
          const page = a.pageFor({ opportunity: { targetQuery: pack.target.question }, grounded: pack.facts[0] });
          const { partsFromPage } = await import("../generate/fixtures");
          return text(partsFromPage(page, page.slug));
        }
        throw new Error(`${a.journey}: no model answer for task: ${task.slice(0, 80)}`);
      },
    };
  }
  return { default: FakeAnthropic };
}

// ── The storing database, for a pass that runs end to end ───────────────

/** What a storing double cannot know: each table's column defaults, and
 *  that a nullable column an insert left out reads `null`, not absent. */
const PASS_DEFAULTS: Readonly<Record<string, () => Row>> = {
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

/** The storing double as the pass's client: one-row inserts with each
 *  table's defaults, and the site profile's upsert, which the shared double
 *  does not carry. */
export function passClient(db: FakeDb, journey: string) {
  return {
    from(table: string) {
      const builder = (db.client as { from(t: string): Record<string, unknown> }).from(table) as {
        insert(values: Row | Row[]): unknown;
        upsert?: (values: Row, opts?: { onConflict?: string }) => unknown;
      };
      const insert = builder.insert.bind(builder);
      const defaults = PASS_DEFAULTS[table];
      builder.insert = (values: Row | Row[]) => {
        if (Array.isArray(values) && values.length !== 1) throw new Error(`${journey}: a ${values.length}-row insert into ${table}`);
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
}

/** The stored procedures setup and a deep pass call, as their migrations
 *  write them: the day's and the site's spend, the stage log, setup's
 *  choice (the mode on the site, and one destination waiting for DNS) and
 *  the report's store, which makes the claimed row the domain's current. */
export async function installPassRpcs(db: FakeDb, destinationId: string): Promise<void> {
  const { installSiteSpendRpc, installTransitionRpc } = await import("../publish/harness");
  installTransitionRpc(db);
  // One onboarding row per site, held by its primary key.
  db.uniqueIndexes.push({ table: "scans", columns: ["id"] });
  db.rpcs.set("fetches_spend_since", (args: Row) =>
    db
      .rows("fetches")
      .filter((row) => String(row.created_at) >= String(args.p_since))
      .reduce((total, row) => total + Number(row.cost_cents ?? 0), 0)
  );
  installSiteSpendRpc(db);
  db.rpcs.set("append_scan_stage_event", () => null);
  db.rpcs.set("apply_setup_choice", (args: Row) => {
    const site = db.rows("sites").find((row) => row.id === args.p_site_id);
    if (site === undefined) throw new Error("apply_setup_choice: no site");
    site.mode = args.p_mode;
    db.rows("destinations").push({
      id: destinationId,
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
    return destinationId;
  });
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
}

// ── The founder, the mail vendor and the vendors' transport ─────────────

/** The founder's own signed session in the journey's cookie jar. */
export async function signIn(cookieJar: Map<string, string>, user: { id: string; email: string }): Promise<void> {
  const { setIdentityAuth } = await import("../../src/lib/account/identity/auth");
  const { addAuthUser, fakeIdentityAuth, newFakeAuth, signedInCookie } = await import("../account/identity/fake-auth");
  cookieJar.clear();
  const auth = newFakeAuth();
  addAuthUser(auth, user);
  setIdentityAuth(fakeIdentityAuth(auth));
  const [name, value] = signedInCookie(auth, user.id).split("=") as [string, string];
  cookieJar.set(name, value);
}

export interface SentMail {
  to: string[];
  subject: string;
  html: string;
}

/** Resend's transport, writing every mail into `inbox`. */
export async function captureMail<T = SentMail>(inbox: T[]): Promise<void> {
  const { __setVendorTransportForTesting } = await import("../../src/lib/mail/vendor/resend");
  __setVendorTransportForTesting(async (payload: string) => {
    inbox.push(JSON.parse(payload) as T);
    return { status: 200, headers: {}, body: JSON.stringify({ id: `resend-${inbox.length}` }) };
  });
}

/** The global `fetch` DataForSEO's transport issues: each request recorded
 *  with its first task, and answered by the journey's market. */
export function stubVendorFetch(
  requests: { url: string; task: Record<string, unknown> }[],
  answer: (url: string, task: Record<string, unknown>) => unknown,
  onRequest: () => void = () => undefined
): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const body = typeof init?.body === "string" ? (JSON.parse(init.body) as unknown[]) : [];
      const task = (body[0] ?? {}) as Record<string, unknown>;
      requests.push({ url, task });
      onRequest();
      return { ok: true, status: 200, statusText: "OK", json: async () => answer(url, task) };
    })
  );
}

// ── The clock and the job platform ──────────────────────────────────────

const realSetTimeout = globalThis.setTimeout;

/** The standard queue's ten-second poll, collapsed for a deep pass: every
 *  timer fires at once. */
export function collapseTimers(): void {
  vi.stubGlobal("setTimeout", ((fn: () => void) => {
    fn();
    return 0;
  }) as unknown as typeof setTimeout);
}

/** Real timers again once the pass is over: a delivery races its own
 *  timeout, and a timeout that fires at once is a delivery that timed out. */
export function realTimers(): void {
  vi.stubGlobal("setTimeout", realSetTimeout);
}

export interface QueuedEvent {
  name: string;
  data: Record<string, unknown>;
  at: Date | null;
}

/** Delivers every queued event of a name whose moment has come, through
 *  `runJob()`, recording each outcome in `runs`. */
export function deliverer(a: {
  queued: QueuedEvent[];
  jobs: Readonly<Record<string, JobDefinition>>;
  runs: { job: string; outcome: Outcome }[];
}): (name: string, now: Date) => Promise<Outcome[]> {
  return async (name, now) => {
    const { runJob } = await import("../../src/jobs/run");
    const job = a.jobs[name]!;
    const out: Outcome[] = [];
    for (;;) {
      const next = a.queued.find((event) => event.name === name && (event.at === null || event.at <= now));
      if (next === undefined) return out;
      a.queued.splice(a.queued.indexOf(next), 1);
      const result = await runJob(job, { data: next.data, now });
      a.runs.push({ job: job.id, outcome: result });
      out.push(result);
    }
  };
}

/** The founder's one setup submit, through `POST /api/setup`. */
export async function submitSetup(body: Record<string, unknown>): Promise<{ status: number; body: Record<string, unknown> }> {
  const { POST } = await import("../../src/app/api/setup/route");
  const response = await POST(
    new Request("https://reachkit.example/api/setup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    undefined
  );
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}
