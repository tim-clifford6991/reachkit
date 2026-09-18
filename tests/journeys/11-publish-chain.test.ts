// tests/journeys/11-publish-chain.test.ts — SPEC §7, §9 (issue 888)
//
// Journey: one approved page walks the whole second half of the product.
// The veto window opens and runs out → the hourly publish tick approves it
// and the hosted adapter delivers it → **the hosted edge serves it at the
// customer's own address** → the +24 h check fetches that address and
// records what it saw → §9's page record and the `published` mail say the
// same address → the page is taken down and the address answers `410 Gone`.
//
// **Why this file exists.** Nothing has ever been published. Journeys 05
// and 08 walk a week and journey 09 walks setup → publish → sitemap, but
// the *live page itself* has never been part of the chain in any of them:
// 05 publishes to WordPress, 08's "live page" is an HTML string the suite
// writes by hand, and 09 stops at the sitemap. So the one step the customer
// pays for — a page rendered by the hosted edge, at their address, that the
// check then reads back — was proved nowhere. Here the bytes the check
// fetches are the bytes the real route renders.
//
// **What is real.** The veto window's two ends (`enterReview`, and the
// hourly `publish/retry` tick through `runJob()` — §7's "an untouched draft
// publishes at window end"), the state machine and its guards, the claim,
// the hosted adapter, the hosted edge (`resolveHost`, the page route, the
// index, `/sitemap.xml`, `/robots.txt`, `hostedAnswer` and the `410`
// route), the one Markdown renderer, `publish/verify` through `runJob()`
// with §9's four checks, the `draft-ready` and `published` mails through
// the real compose shell, and `unpublish()`.
//
// **What is doubled, each at the last line of our own code:**
//
//   · Postgres         → the storing PostgREST double the §9 suites share
//   · the job platform → `sendJobEvent`, delivered here through `runJob()`
//   · the clock        → `vi.useFakeTimers`
//   · the destination  → nothing leaves the process. The hosted destination
//                        *is* this deployment, so `safeFetch` answers from
//                        the hosted routes rendered in-process: the page's
//                        own document, its sitemap and its robots policy.
//                        No byte is sent, nothing is bought and nothing is
//                        published live.
//   · Resend           → `__setVendorTransportForTesting`
//
// Anthropic is absent: this journey starts from a page that is already
// written, which is where §7's publish chain starts.
//
// **The copy registry is a fixture**, as in journeys 02–09: the mails are
// asserted by their keys.
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, installTransitionRpc, type FakeDb, type Row } from "../publish/harness";

const db: FakeDb = fakeDb();

/** What a storing double cannot know: each table's column defaults, and
 *  that a nullable column an insert left out reads `null` and not absent. */
const COLUMN_DEFAULTS: Readonly<Record<string, () => Row>> = {
  publications: () => ({
    unpublished_at: null,
    unpublish_outcome: null,
    published_at: null,
    live_url: null,
    remote_id: null,
    failure_reason: null,
    seo_written: null,
    verify: null,
    acceptance: null,
    verify_due_at: null,
  }),
};

const client = {
  from(table: string) {
    const builder = (db.client as { from(t: string): Record<string, unknown> }).from(table) as {
      insert(values: Row | Row[]): unknown;
    };
    const insert = builder.insert.bind(builder);
    const defaults = COLUMN_DEFAULTS[table];
    builder.insert = (values: Row | Row[]) => {
      const one = Array.isArray(values) ? (values[0] ?? {}) : values;
      return insert(defaults === undefined ? one : { ...defaults(), ...one });
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

/** The hosted adapter clears the edge's cache tags on delivery; outside a
 *  request there is no cache, which that module already tolerates. */
vi.mock("next/cache", () => ({ revalidateTag: () => undefined, revalidatePath: () => undefined }));

/** The Host a request to the hosted edge carries. The page route reads it
 *  through `next/headers`, exactly as it does in the deployment. */
const serving = { host: "" };
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: serving.host }),
  cookies: async () => ({ getAll: () => [], get: () => undefined }),
}));

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

// ── The egress seam: answered by the hosted edge itself ─────────────────
//
// The customer's pages are served by this deployment, so there is no third
// party between the check and the page. Every fetch below is routed to the
// route that would answer it in production, rendered in-process — which is
// what makes the +24 h check an assertion about what the edge *serves*
// rather than about a document this file wrote.

const fetched: string[] = [];

vi.mock("@/lib/egress", () => ({
  safeFetch: async (url: string) => {
    fetched.push(url);
    const answer = await answerFor(url);
    return {
      ok: true,
      status: answer.status,
      url,
      html: answer.body,
      bytes: answer.body.length,
      readAt: new Date(),
      headers: {},
    };
  },
  readRobots: async (origin: string) => {
    const host = new URL(origin).host;
    const response = await robotsRoute(new Request(`${origin}/robots.txt`, { headers: { host } }));
    const text = response.status === 200 ? await response.text() : "";
    return {
      ok: true,
      origin,
      readAt: new Date(),
      disallowsAll: false,
      disallowedAgents: {},
      sitemaps: [...text.matchAll(/^Sitemap:\s*(\S+)$/gim)].map((m) => m[1] ?? ""),
      absent: text === "",
    };
  },
  resolvesInDns: async () => true,
}));

// ── The modules, after the doubles above are in place ───────────────────

const { runJob } = await import("../../src/jobs/run");
const { publishRetry } = await import("../../src/jobs/publish-retry");
const { publishVerify } = await import("../../src/jobs/publish-verify");
const { enterReview } = await import("../../src/lib/publish/attempt/window");
const { unpublish } = await import("../../src/lib/publish/attempt/unpublish");
const { hostedAnswer } = await import("../../src/app/(hosted)/edge");
const { GET: sitemapRoute } = await import("../../src/app/(hosted)/sitemap.xml/route");
const { GET: robotsRoute } = await import("../../src/app/(hosted)/robots.txt/route");
const goneRoute = await import("../../src/app/(hosted)/hosted-gone/route");
const hostedPage = await import("../../src/app/(hosted)/hosted-page/[[...slug]]/page");
const { __setVendorTransportForTesting } = await import("../../src/lib/mail/vendor/resend");
const { HOSTED_GONE_STATUS } = await import("../../src/lib/config/constants");
const { listHash } = await import("../../src/lib/generate/claims/hash");

import type { Outcome } from "../../src/jobs/types";

// ── The site, its page and its clock ────────────────────────────────────

const USER_ID = "44444444-4444-4444-8444-444444444411";
const SITE_ID = "22222222-2222-4222-8222-222222222211";
const DRAFT_ID = "33333333-3333-4333-8333-333333333311";
const DEST_ID = "55555555-5555-4555-8555-555555555511";
const OPPORTUNITY_ID = "66666666-6666-4666-8666-666666666611";
const SCAN_ID = "77777777-7777-4777-8777-777777777711";

const DOMAIN = "meadowclinic.com";
const FIRST_HOST = `blog.${DOMAIN}`;
const MOVED_HOST = `news.${DOMAIN}`;
const SLUG = "how-often-should-a-clinic-re-test";
const TITLE = "How often should a clinic re-test?";
const TARGET_QUERY = "how often should a clinic re-test";
const EMAIL = "founder@meadowclinic.com";
const TIME_ZONE = "Europe/Dublin";

/** The page's body, in the declared Markdown subset. Its opening states
 *  the grounded passage word for word, which is what the check's coverage
 *  reading is taken over. */
const PASSAGE = "a clinic that re-tests every six months finds drift before a patient does";
const BODY_MD = [
  `## ${TITLE}`,
  "",
  `Every six months, and sooner after a change of equipment. ${PASSAGE}.`,
  "",
  "- Book the re-test when the calibration certificate is issued.",
  "- Keep the last three results where the whole team can read them.",
].join("\n");

/** Wednesday morning in the site's own zone: the page is written. */
const WRITTEN_AT = new Date("2026-09-23T08:00:00.000Z");
const HOUR = 3_600_000;
const VETO_HOURS = 24;

interface SentMail {
  to: string[];
  subject: string;
  html: string;
}
const inbox: SentMail[] = [];
const runs: { job: string; outcome: Outcome }[] = [];

function seedTheDatabase(): void {
  db.reset();
  installTransitionRpc(db);
  db.seed("users", [
    {
      id: USER_ID,
      email: EMAIL,
      name: null,
      notify: null,
      paid_through: "2026-12-01T00:00:00.000Z",
      deleted_at: null,
    },
  ]);
  db.seed("sites", [
    {
      id: SITE_ID,
      user_id: USER_ID,
      domain: DOMAIN,
      category: "occupational health clinic",
      mode: "autopilot",
      veto_hours: VETO_HOURS,
      publish_time: "09:00",
      timezone: TIME_ZONE,
      publishing_enabled: true,
      hosted_serving_ends_at: null,
      hosting_end_notice_at: null,
      hosting_end_reminder_at: null,
      do_not_claim: [],
      voice_text: null,
    },
  ]);
  db.seed("destinations", [
    {
      id: DEST_ID,
      site_id: SITE_ID,
      kind: "hosted",
      config: null,
      health: "ok",
      health_reason: null,
      hostname: FIRST_HOST,
      hostname_state: "live",
      hostname_checked_at: WRITTEN_AT.toISOString(),
      deleted_at: null,
    },
  ]);
  db.seed("scans", [{ id: SCAN_ID, site_id: SITE_ID, created_at: "2026-09-21T00:00:00.000Z" }]);
  db.seed("opportunities", [
    {
      id: OPPORTUNITY_ID,
      site_id: SITE_ID,
      scan_id: SCAN_ID,
      target_query: TARGET_QUERY,
      target_ref: null,
      title: TITLE,
      proposed_slug: SLUG,
      family: "write",
      type: "new_post",
      status: "queued",
      ready: true,
      unready_reason: null,
      fit_band: "winnable",
      effort: 1,
      cluster_key: null,
      absorbed_queries: [],
      volume: 90,
      evidence: {
        family: "write",
        query: TARGET_QUERY,
        volume: { kind: "measured", value: 90, at: "2026-09-21T00:00:00.000Z" },
        rival: {
          domain: "rivalclinic.com",
          url: { kind: "measured", value: "https://rivalclinic.com/re-testing", at: "2026-09-21T00:00:00.000Z" },
          position: { kind: "measured", value: 4, at: "2026-09-21T00:00:00.000Z" },
        },
      },
      acceptance: { kind: "rank", query: TARGET_QUERY, within: 20 },
      created_at: "2026-09-21T00:00:00.000Z",
      status_changed_at: "2026-09-21T00:00:00.000Z",
    },
  ]);
  db.seed("drafts", [
    {
      id: DRAFT_ID,
      site_id: SITE_ID,
      opportunity_id: OPPORTUNITY_ID,
      state: "generating",
      title: TITLE,
      body_md: BODY_MD,
      meta: { description: "When an occupational health clinic should re-test, and why." },
      grounded_fact: {
        passage: PASSAGE,
        url: "https://standards.example.org/re-testing",
        readAt: "2026-09-21T00:00:00.000Z",
      },
      // §8 hard rule 4's recorded verdict: the page passed its claim check
      // against the list this site holds — the same fact the hand-off gate
      // re-reads before every attempt. A draft without one is held, which
      // is what `no_outstanding_claim_recheck` is for.
      claim_check: { state: "passed", listHash: listHash([]), at: "2026-09-23T07:59:00.000Z" },
      hard_rules_passed: true,
      publishable_since: null,
      veto_deadline: null,
      approved_at: null,
      approved_by: null,
      told: null,
      transitions: [],
      scheduled_for: "2026-09-24",
    },
  ]);
  db.seed("publications", []);
}

/** The document the hosted edge serves at one address, composed the way
 *  Next composes it: the route's own `generateMetadata` in the head and the
 *  route's own render in the body. Nothing here writes markup of its own
 *  beyond the shell those two land in. */
async function servedDocument(host: string, slug: string | null): Promise<{ status: number; body: string }> {
  const answer = await hostedAnswer(host, slug === null ? "/" : `/${slug}`);
  if (answer === "gone") {
    const response = await goneRoute.GET();
    return { status: response.status, body: await response.text() };
  }

  const previous = serving.host;
  serving.host = host;
  try {
    const params = Promise.resolve(slug === null ? {} : { slug: [slug] });
    const metadata = await hostedPage.generateMetadata({ params });
    const tree = await hostedPage.default({ params, searchParams: Promise.resolve({}) });
    const canonical = metadata.alternates?.canonical;
    return {
      status: 200,
      body:
        `<!doctype html><html lang="en"><head>` +
        `<title>${String(metadata.title ?? "")}</title>` +
        (typeof canonical === "string" ? `<link rel="canonical" href="${canonical}">` : "") +
        `</head><body>${renderToStaticMarkup(tree)}</body></html>`,
    };
  } catch {
    // `notFound()` throws: an address this site never published at.
    return { status: 404, body: "" };
  } finally {
    serving.host = previous;
  }
}

/** Every address the verification reaches, answered by the route that owns
 *  it — the sitemap, the robots document and the page itself. */
async function answerFor(url: string): Promise<{ status: number; body: string }> {
  const parsed = new URL(url);
  const request = new Request(url, { headers: { host: parsed.host } });
  if (parsed.pathname === "/sitemap.xml") {
    const response = await sitemapRoute(request);
    return { status: response.status, body: response.status === 200 ? await response.text() : "" };
  }
  if (parsed.pathname === "/sitemap_index.xml") return { status: 404, body: "" };
  if (parsed.pathname === "/robots.txt") {
    const response = await robotsRoute(request);
    return { status: response.status, body: response.status === 200 ? await response.text() : "" };
  }
  const segments = parsed.pathname.split("/").filter((segment) => segment !== "");
  if (segments.length > 1) return { status: 404, body: "" };
  return servedDocument(parsed.host, segments[0] ?? null);
}

/** Delivers every queued event of one name whose moment has come, through
 *  `runJob()` — the one path every invocation takes. */
async function deliver(name: string, now: Date): Promise<Outcome[]> {
  const job = name === "publish/verify" ? publishVerify : publishRetry;
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

/** The hourly publish tick: a clock job, so it carries no event. */
async function publishTick(now: Date): Promise<Outcome> {
  const result = await runJob(publishRetry, { data: {}, now });
  runs.push({ job: publishRetry.id, outcome: result });
  return result;
}

function publication(): Row {
  const row = db.rows("publications")[0];
  if (row === undefined) throw new Error("journey 11: no publication row");
  return row;
}

function draft(): Row {
  const row = db.rows("drafts")[0];
  if (row === undefined) throw new Error("journey 11: no draft row");
  return row;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(WRITTEN_AT);
  seedTheDatabase();
  queued.length = 0;
  runs.length = 0;
  inbox.length = 0;
  fetched.length = 0;
  serving.host = "";
  __setVendorTransportForTesting(async (payload: string) => {
    inbox.push(JSON.parse(payload) as SentMail);
    return { status: 200, headers: {}, body: JSON.stringify({ id: `resend-${inbox.length}` }) };
  });
});

afterEach(() => {
  vi.useRealTimers();
  __setVendorTransportForTesting(null);
});

const JOURNEY_TIMEOUT_MS = 60_000;

describe("the publish chain, end to end (issue 888)", () => {
  it(
    "veto window → publish → the page live at the destination → +24 h check → the record → taken down, 410",
    async () => {
      // ── 1. The window opens, and the founder is told.
      expect(await enterReview({ draftId: DRAFT_ID, at: WRITTEN_AT })).toEqual({ kind: "told" });
      expect(draft().state).toBe("in_review");
      const deadline = new Date(String(draft().veto_deadline));
      expect(deadline.getTime()).toBe(WRITTEN_AT.getTime() + VETO_HOURS * HOUR);
      expect(inbox.map((mail) => mail.to)).toEqual([[EMAIL]]);

      // Nothing goes out while the window is open.
      expect(await publishTick(new Date(deadline.getTime() - HOUR))).toMatchObject({
        outcome: "skipped",
      });
      expect(db.rows("publications")).toEqual([]);
      expect(draft().state).toBe("in_review");

      // ── 2. The window runs out; the hourly tick approves and delivers.
      const publishedAt = new Date(deadline.getTime() + HOUR);
      vi.setSystemTime(publishedAt);
      expect(await publishTick(publishedAt)).toMatchObject({ outcome: "ran" });
      expect(draft().state).toBe("published");

      const pub = publication();
      expect(pub).toMatchObject({
        site_id: SITE_ID,
        draft_id: DRAFT_ID,
        destination: "hosted",
        delivery_state: "delivered",
        made_live_by_us: true,
        live_url: `https://${FIRST_HOST}/${SLUG}`,
      });

      // ── 3. The page is live at the customer's own address.
      const live = await servedDocument(FIRST_HOST, SLUG);
      expect(live.status).toBe(200);
      // Their page: the title they published, the body the one renderer
      // produced, their own domain as the publisher, and the canonical on
      // their host — not ours.
      expect(live.body).toContain(`<title>${TITLE}</title>`);
      expect(live.body).toContain(`<link rel="canonical" href="https://${FIRST_HOST}/${SLUG}">`);
      expect(live.body).toContain(PASSAGE);
      expect(live.body).toContain("<mark");
      expect(live.body).toContain(DOMAIN);
      expect(live.body).not.toContain("reachkit.app");
      // An address this site never published at is not a page, and is not
      // `gone` either — nothing was ever there.
      expect(await hostedAnswer(FIRST_HOST, "/never-published")).toBe("page");
      expect((await servedDocument(FIRST_HOST, "never-published")).status).toBe(404);

      // The index at the root lists it, and the sitemap carries exactly it.
      expect((await servedDocument(FIRST_HOST, null)).body).toContain(TITLE);
      const listed = await answerFor(`https://${FIRST_HOST}/sitemap.xml`);
      expect([...listed.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])).toEqual([
        `https://${FIRST_HOST}/${SLUG}`,
      ]);

      // ── 4. Twenty-four hours later, the check reads that same address.
      const verifyEvent = queued.find((event) => event.name === "publish/verify");
      expect(verifyEvent?.data).toEqual({ publicationId: pub.id });
      const checkedAt = new Date(publishedAt.getTime() + 24 * HOUR);
      vi.setSystemTime(checkedAt);
      expect(await deliver("publish/verify", checkedAt)).toEqual([
        { outcome: "ran", subjectId: pub.id },
      ]);
      expect(fetched).toContain(`https://${FIRST_HOST}/${SLUG}`);

      // Four checks, all four measured true: the page answered at its own
      // address, is not marked against indexing, is in the sitemap the site
      // publishes, and returns its whole content to a reader running no
      // scripts.
      const recorded = publication().verify as {
        outcome: string;
        checks: Record<string, { kind: string; value: boolean }>;
      };
      expect(recorded.outcome).toBe("found");
      for (const check of ["reachable", "indexable", "sitemap", "aiReadable"] as const) {
        expect(recorded.checks[check], check).toMatchObject({ kind: "measured", value: true });
      }

      // ── 5. The record, and what the founder is told about it.
      const told = inbox.at(-1)!;
      expect(told.to).toEqual([EMAIL]);
      expect(told.html).toContain(`https://${FIRST_HOST}/${SLUG}`);
      // §9's five members, off the edge's own read — the same address again.
      const page = await servedDocument(FIRST_HOST, SLUG);
      expect(page.status).toBe(200);

      // ── 6. Taken down: the address answers 410, and nothing lists it.
      const takenDownAt = new Date(checkedAt.getTime() + HOUR);
      vi.setSystemTime(takenDownAt);
      expect(await unpublish({ draftId: DRAFT_ID, by: { kind: "customer", userId: USER_ID } })).toEqual({
        ok: true,
        outcome: "removed",
      });
      expect(draft().state).toBe("unpublished");
      expect(publication().unpublished_at).toBe(takenDownAt.toISOString());

      expect(await hostedAnswer(FIRST_HOST, `/${SLUG}`)).toBe("gone");
      const gone = await servedDocument(FIRST_HOST, SLUG);
      expect(gone.status).toBe(HOSTED_GONE_STATUS);
      expect(gone.body.toLowerCase()).not.toContain("reachkit");

      // Gone from the sitemap the moment the row changed, and gone from the
      // index — one predicate, every reader.
      const after = await answerFor(`https://${FIRST_HOST}/sitemap.xml`);
      expect(after.body).not.toContain("<loc>");
      expect((await servedDocument(FIRST_HOST, null)).body).toContain("hosted.index.empty");

      // Nothing on the way degraded.
      expect(runs.filter((run) => run.outcome.outcome === "degraded")).toEqual([]);
    },
    JOURNEY_TIMEOUT_MS
  );

  it(
    "the host moves under a live page: it is re-served and re-checked at the new address, and the old one is 404 — never 410, never broken",
    async () => {
      // A page, live at the host the site had when it published.
      await enterReview({ draftId: DRAFT_ID, at: WRITTEN_AT });
      const publishedAt = new Date(WRITTEN_AT.getTime() + (VETO_HOURS + 1) * HOUR);
      vi.setSystemTime(publishedAt);
      await publishTick(publishedAt);
      expect(publication().live_url).toBe(`https://${FIRST_HOST}/${SLUG}`);

      // The host moves under it — the owner's test destination on a deploy,
      // a customer repointing their record. The stored address does not
      // move: it is what the page was published at.
      db.rows("destinations")[0]!.hostname = MOVED_HOST;
      expect(publication().live_url).toBe(`https://${FIRST_HOST}/${SLUG}`);

      // The page is the site's, so it is served at the site's host now —
      // and it says so: the canonical it declares and the entry its sitemap
      // carries are both the new address, never the stored one.
      const moved = await servedDocument(MOVED_HOST, SLUG);
      expect(moved.status).toBe(200);
      expect(moved.body).toContain(`<link rel="canonical" href="https://${MOVED_HOST}/${SLUG}">`);
      expect(moved.body).toContain(TITLE);
      const listed = await answerFor(`https://${MOVED_HOST}/sitemap.xml`);
      expect([...listed.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])).toEqual([
        `https://${MOVED_HOST}/${SLUG}`,
      ]);

      // The old host is no longer a host ReachKit serves: 404, and never
      // 410 — nothing was taken down, the page is live — and never another
      // site's page.
      expect(await hostedAnswer(FIRST_HOST, `/${SLUG}`)).toBe("page");
      expect((await servedDocument(FIRST_HOST, SLUG)).status).toBe(404);

      // And the 24-hour check reads the address the page answers at now, so
      // a moved host is never recorded as the customer's page having gone
      // missing.
      const checkedAt = new Date(publishedAt.getTime() + 24 * HOUR);
      vi.setSystemTime(checkedAt);
      await deliver("publish/verify", checkedAt);

      expect(fetched).toContain(`https://${MOVED_HOST}/${SLUG}`);
      expect(fetched).not.toContain(`https://${FIRST_HOST}/${SLUG}`);
      const recorded = publication().verify as { outcome: string };
      expect(recorded.outcome).toBe("found");
      expect(recorded.outcome).not.toBe("page_not_found");

      // The mail that says the page is live links where it is live.
      const told = inbox.at(-1)!;
      expect(told.html).toContain(`https://${MOVED_HOST}/${SLUG}`);
      expect(told.html).not.toContain(`https://${FIRST_HOST}/${SLUG}`);
    },
    JOURNEY_TIMEOUT_MS
  );
});
