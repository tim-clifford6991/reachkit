// tests/journeys/05-daily-loop.test.ts — BUILD §3, §9
//
// Journey: the evening tick picks the day's page and writes it → the
// customer is told and the veto window opens → the page goes out to their
// destination → twenty-four hours later ReachKit looks at it and says what
// it saw (JN-003).
//
// End to end, at the seams and no further in. Everything the product owns
// is real: the site clock, `generateDayPage` and its four model steps
// through the real cost seam, §8's grounding read and its hard rules,
// §7's supply, the telling, the veto token and its redemption, the state
// machine and all nine of its guards, the claim, the WordPress adapter,
// the publishing switch and ReachKit's own stop, the twenty-four-hour
// check, and the `published` mail through the real compose shell and send
// seam. Four things outside the process are doubled, each at the last line
// of our own code:
//
//   · Anthropic                → the SDK client `llm()` constructs
//   · the customer's WordPress → `safeFetch`, the one door its REST client
//                                has
//   · the live page and its
//     robots and sitemap       → the same `safeFetch` / `readRobots`
//   · Resend                   → `__setVendorTransportForTesting`
//   · Postgres                 → the storing PostgREST double the §9 suites
//                                share, plus §7's and §8's declared stores
//
// Five of those need a word.
//
// **Both engine seams on this chain are built now (#173).**
// `activeSites()` (BP-014) is the evening tick's own site list and
// `publishApproved()` (BP-015) is the approve-and-deliver edge; each used
// to throw `notBuilt`, and the first test used to assert that they did.
// It now asserts what they do: the tick walks a real list that this
// founder's site is on and a stopped site is not, and the day's page goes
// out through the same `transition()` and `publish()` calls the engine
// makes — which is what keeps this file a journey rather than a second
// copy of the engine. The two edges #45 owns — `generating → in_review`
// with the veto deadline it stamps, and `approved → publishing` — are
// still moved here directly, because what this journey is about is the
// customer's day and not the job runner's plumbing
// (`tests/jobs/engine-daily.test.ts` owns that).
//
// **The `draft-ready` mail is built (#174), and this journey sends it.**
// The decision behind it came with the veto leaf — `tellingFor` picks
// which of §12's three things the mail says, `issueVetoLink` mints the one
// stop link it carries, and `recordTold` is what the `customer_told` guard
// reads — and until #174 nothing composed or sent it, so the composition
// was the hole and a real customer was never told. Step 3 now goes through
// the real template, the real compose shell and the real send seam, and
// the stop link the veto tests redeem is read back out of the mail that
// actually left. A page still cannot publish untold: that is the guard,
// and it is asserted here.
//
// **The hosted destination cannot take a page yet** (#49 — its adapter
// returns `destination_unavailable` and says so in its own header), so
// this founder publishes to their own WordPress. That is also where the
// external vendor is, which is what makes the delivery assertion an
// assertion about the requests that actually left.
//
// **The calendar does not read `drafts` yet** (#45 — `store.ts` names the
// four facts it leaves honestly empty). So the calendar read below asserts
// what the screen actually says today — §7's supply put a page on the date
// — and names the held set and the draft state as the engine's, which the
// screen will read when #45 lands.
//
// **The copy registry is a fixture**, as in journeys 02–04: `copy()`
// refuses an owner-owed key and every sentence on this chain is owed.
// `COPY` itself is left real.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, installTransitionRpc, type FakeDb, type Row } from "../publish/harness";

const db: FakeDb = fakeDb();

/** `fetches` needs a builder the §9 harness's double does not carry: the
 *  cost seam's cache read chains `.gt().order().limit()`, and §8's
 *  grounding read chains `.eq().in()`. This is that one table, with the
 *  chain those two reads use and rows stored in the same `db.tables` the
 *  rest of the journey reads — so the ledger below is the ledger the
 *  product would have written, and every cache read is the miss it is
 *  (this journey spends fresh: nothing it asks for was asked before). */
function fetchesBuilder() {
  const filters: { op: string; column: string; value: unknown }[] = [];
  let verb: "select" | "insert" = "select";
  const self = {
    select: () => self,
    insert(values: Row) {
      verb = "insert";
      db.tables.get("fetches")?.push({ ...values });
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
    gt(column: string, value: unknown) {
      filters.push({ op: "gt", column, value });
      return self;
    },
    gte: (column: string, value: unknown) => self.gt(column, value),
    order: () => self,
    limit: () => self,
    single: () => Promise.resolve({ data: null, error: null }),
    then(resolve: (value: { data: unknown[]; error: null }) => unknown) {
      if (verb === "insert") return Promise.resolve({ data: [], error: null }).then(resolve);
      const rows = (db.tables.get("fetches") ?? []).filter((row) =>
        filters.every((f) => {
          const value = row[f.column];
          if (f.op === "eq") return value === f.value;
          if (f.op === "in") return (f.value as unknown[]).includes(value);
          // A cache read: nothing this journey asks for was ledgered
          // before it, so the freshness window matches nothing.
          return false;
        })
      );
      return Promise.resolve({ data: rows, error: null }).then(resolve);
    },
  };
  return self;
}

const client = {
  from: (table: string) =>
    table === "fetches" ? fetchesBuilder() : (db.client as { from(t: string): unknown }).from(table),
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

// ── The customer's own server, their WordPress, and the live page ───────

interface WpRequest {
  method: string;
  path: string;
  body: unknown;
}

const wordpress = {
  requests: [] as WpRequest[],
  posts: [] as Record<string, unknown>[],
  nextId: 500,
};

/** Everything the four checks read at the live address. */
const livePage = {
  html: "",
  status: 200,
  sitemapHasIt: true,
};

const SITE_DOMAIN = "acme.example";
const WP_BASE = "https://blog.acme.example";
const LIVE_PATH = "/best-project-management-software";

function jsonAnswer(status: number, value: unknown, url: string) {
  const body = JSON.stringify(value);
  return {
    ok: status >= 200 && status < 300,
    status,
    url,
    html: body,
    bytes: body.length,
    readAt: new Date("2026-09-03T12:00:00.000Z"),
    headers: { "content-type": "application/json" },
  };
}

vi.mock("@/lib/egress", () => ({
  resolvesInDns: async () => true,
  readRobots: async (origin: string) => ({
    ok: true,
    origin,
    readAt: new Date("2026-09-03T12:00:00.000Z"),
    disallowsAll: false,
    disallowedAgents: {},
    sitemaps: [`${WP_BASE}/sitemap.xml`],
    absent: false,
  }),
  safeFetch: async (url: string, opts: Record<string, unknown> = {}) => {
    const parsed = new URL(url);

    // The customer's WordPress, at the one door its REST client has.
    if (parsed.pathname.startsWith("/wp-json")) {
      const path = parsed.pathname.replace("/wp-json", "") + parsed.search;
      const method = (opts.method as string) ?? "GET";
      const body = opts.body === undefined ? null : JSON.parse(opts.body as string);
      wordpress.requests.push({ method, path, body });

      if (path.startsWith("/") && path === "/") {
        return jsonAnswer(200, { namespaces: ["wp/v2"] }, url);
      }
      if (path.startsWith("/wp/v2/users/me")) {
        return jsonAnswer(200, { id: 1, capabilities: { publish_posts: true, edit_posts: true } }, url);
      }
      if (path.startsWith("/wp/v2/tags")) {
        return jsonAnswer(200, method === "POST" ? { id: 9, slug: "reachkit" } : [], url);
      }
      if (path.startsWith("/wp/v2/posts") && method === "POST") {
        const post = {
          id: wordpress.nextId++,
          status: "publish",
          link: `${WP_BASE}${LIVE_PATH}`,
          meta: (body as Record<string, unknown> | null)?.meta ?? {},
        };
        wordpress.posts.push(post);
        return jsonAnswer(201, post, url);
      }
      if (path.startsWith("/wp/v2/posts")) {
        return jsonAnswer(200, [], url);
      }
      return jsonAnswer(404, {}, url);
    }

    // The sitemap the 24-hour check reads.
    if (parsed.pathname.endsWith("sitemap.xml")) {
      const entries = livePage.sitemapHasIt
        ? `<url><loc>${WP_BASE}${LIVE_PATH}</loc></url>`
        : "";
      const xml = `<?xml version="1.0"?><urlset>${entries}</urlset>`;
      return {
        ok: true,
        status: 200,
        url,
        html: xml,
        bytes: xml.length,
        readAt: new Date("2026-09-03T12:00:00.000Z"),
        headers: { "content-type": "application/xml" },
      };
    }

    // The page itself, twenty-four hours after it went out.
    return {
      ok: livePage.status >= 200 && livePage.status < 300,
      status: livePage.status,
      url,
      html: livePage.html,
      bytes: livePage.html.length,
      readAt: new Date("2026-09-03T12:00:00.000Z"),
      headers: { "content-type": "text/html" },
    };
  },
}));

// ── Anthropic ───────────────────────────────────────────────────────────

const modelCalls: { task: string; tokens: number }[] = [];

const BRIEF = {
  readerQuestion: "Which tool should a small team pick?",
  angle: "count the seats first",
  mustCover: ["seats", "what the plan includes"],
};
const OUTLINE = { sections: [{ heading: "Which tool should a small team pick?", covers: "seats" }] };

/** A page that passes every one of §8's deterministic rules: the brand is
 *  not named in the opening, the grounded passage is stated word for word
 *  and its source linked, and there is no quotation, rival figure, embedded
 *  markup or ranking numeral. */
const CLEAN_MARKDOWN = [
  "## Which tool should a small team pick?",
  "",
  "The answer depends on how many people need a seat and how much of the work",
  "already lives in one place. Start by counting the people who will open it",
  "every day, then check what the plan you are looking at actually includes.",
  "",
  "Teams on the starter plan get 25 seats and unlimited projects for a flat",
  `monthly fee, per [the published pricing page](https://${SITE_DOMAIN}/pricing).`,
  "",
  "That number is the one worth checking first, because a seat limit is the",
  "constraint teams notice last and feel most.",
].join("\n");

const PAGE_BODY = {
  title: "Which tool should a small team pick?",
  slug: "best-project-management-software",
  description: "How to choose by counting the seats you actually need.",
  bodyMarkdown: CLEAN_MARKDOWN,
};

vi.mock("@anthropic-ai/sdk", () => {
  class FakeAnthropic {
    messages = {
      create: async (request: { messages: { content: string }[] }) => {
        const input = request.messages[0]?.content ?? "";
        const asked = JSON.parse(input) as { task: string };
        modelCalls.push({ task: asked.task, tokens: input.length });
        const answer = asked.task.startsWith("Write the brief")
          ? BRIEF
          : asked.task.startsWith("Turn the brief")
            ? OUTLINE
            : PAGE_BODY;
        return {
          content: [{ type: "text", text: JSON.stringify(answer) }],
          usage: { input_tokens: 800, output_tokens: 400 },
        };
      },
    };
  }
  return { default: FakeAnthropic };
});

// ── The modules, after the fixtures above are in place ──────────────────

const { CAPS, VETO, PUBLISH_VERIFY_DELAY_H, DRAFT_DUE_HOUR_LOCAL } = await import(
  "../../src/lib/config/constants"
);
const { isDraftDue, nextPublishDate, localClock } = await import("../../src/jobs/site-clock");
const engine = await import("../../src/jobs/engine");
const { generateDayPage, setGenerateStore } = await import("../../src/lib/generate");
const { setOpportunityStore } = await import("../../src/lib/opportunities");
const { transition, toMachineDraft } = await import("../../src/lib/publish/machine");
const { publish } = await import("../../src/lib/publish/attempt");
const {
  becomesPublishable,
  hashToken,
  issueVetoLink,
  redeemVeto,
  tellingFor,
  toldCurrentPair,
  PUBLISHABLE_RULE,
} = await import("../../src/lib/publish/publishable");
const { WORDPRESS_ADAPTER } = await import(
  "../../src/lib/publish/destinations/wordpress/adapter"
);
const { seal } = await import("../../src/lib/publish/destinations/config");
const { heldPages, resumeOrder, setPublishing } = await import("../../src/lib/publish/switch");
const { setCalendarSiteReader } = await import(
  "../../src/app/(account)/app/calendar/provider"
);
const { readCalendarFacts } = await import("../../src/app/(account)/app/calendar/store");
const { monthOf, dayKeyOf } = await import("../../src/app/(account)/app/calendar/dates");
const { CHECK_IDS } = await import("../../src/lib/publish/verify");
const { __setVendorTransportForTesting } = await import("../../src/lib/mail/vendor/resend");
const { sendDraftReadyMail } = await import("../../src/lib/mail/draft-ready");

const generateFixtures = await import("../generate/fixtures");
const opportunityDoubles = await import("../opportunities/memory-store");

// ── The one site, and its day ───────────────────────────────────────────

const SITE_ID = generateFixtures.SITE_ID;
const SCAN_ID = generateFixtures.SCAN_ID;
const USER_ID = "44444444-4444-4444-8444-444444444444";
const DEST_ID = "dest-journey-05";
const TIME_ZONE = "America/New_York";
const EMAIL = "founder@acme.example";

/** The evening the tick runs — `DRAFT_DUE_HOUR_LOCAL` in the site's own
 *  zone, which in September in New York is 22:00 UTC the same day. */
const EVENING = new Date("2026-09-01T22:00:00.000Z");
/** The moment the page enters review, and the window opens. */
const TOLD_AT = new Date("2026-09-01T22:05:00.000Z");
/** The page the customer's own measurement already read. */
const SOURCE_HTML =
  "<html><body><h1>Pricing</h1><p>Teams on the starter plan get 25 seats and " +
  "unlimited projects for a flat monthly fee.</p><p>Larger teams talk to us.</p></body></html>";

let opportunities: ReturnType<typeof opportunityDoubles.newMemoryState>;
let generateStore: ReturnType<typeof generateFixtures.memoryStore>;

interface SentMail {
  to: string[];
  subject: string;
  html: string;
}
const inbox: SentMail[] = [];

/** `redeem_veto_token`, as the migration writes it: read, expiry check and
 *  use-marking in one statement. */
function installRedeemRpc(target: FakeDb): void {
  target.rpcs.set("redeem_veto_token", (args: Row) => {
    const now = String(args.p_now);
    const row = target.rows("drafts").find(
      (draft) =>
        draft.veto_token_hash === args.p_token_hash &&
        (draft.veto_token_used_at ?? null) === null &&
        (draft.veto_token_expires_at === null || String(draft.veto_token_expires_at) > now)
    );
    if (row === undefined) return [];
    row.veto_token_used_at = now;
    return [{ draft_id: row.id, state: row.state }];
  });
}

/** §8's store and §9's are two views of one `drafts` table. Here they are
 *  two doubles, so the generation store is wrapped and its writes are
 *  mirrored into the row the machine, the claim and the veto all read.
 *  It is the join Postgres would have made, and it is the only thing this
 *  file arranges that production would not. */
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
    db.seed("drafts", [
      ...db.rows("drafts"),
      {
        id,
        site_id: SITE_ID,
        opportunity_id: row.opportunity_id,
        state: row.state,
        title: row.title,
        body_md: row.body_md,
        meta: {},
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
      },
    ]);
    return id;
  };

  inner.patchDraft = async (draftId, patch) => {
    await patchDraft(draftId, patch);
    const row = db.rows("drafts").find((d) => d.id === draftId);
    if (row === undefined) return;
    // The columns §9 reads off the same row, copied as written — including
    // `hard_rules_passed`, which only the run that put the page through
    // the battery may set, and which the machine's own guard reads.
    for (const column of ["state", "title", "body_md", "hard_rules_passed", "scheduled_for"]) {
      if (column in patch) row[column] = (patch as Record<string, unknown>)[column];
    }
  };

  return inner;
}

function theDraftRow(): Row {
  const row = db.rows("drafts")[0];
  if (row === undefined) throw new Error("no draft was written");
  return row;
}

function machineDraft(): ReturnType<typeof toMachineDraft> {
  const row = theDraftRow();
  return toMachineDraft({
    id: row.id as string,
    site_id: SITE_ID,
    state: row.state as string,
    veto_deadline: (row.veto_deadline as string | null) ?? null,
    approved_at: (row.approved_at as string | null) ?? null,
    approved_by: row.approved_by ?? null,
    told: row.told ?? null,
    transitions: row.transitions ?? [],
    hard_rules_passed: (row.hard_rules_passed as boolean | null) ?? null,
    publishable_since: (row.publishable_since as string | null) ?? null,
    sites: { mode: "autopilot", veto_hours: VETO.defaultHours, publish_time: null, timezone: TIME_ZONE },
  } as never);
}

/** The `fetches` rows this journey's own spend wrote — §8's ledger, keyed
 *  to the scan that grounds the page. */
function ledger(): { source: string; costCents: number }[] {
  return db
    .rows("fetches")
    .filter((row) => row.source !== "egress.safeFetch")
    .map((row) => ({ source: String(row.source), costCents: Number(row.cost_cents) }));
}

beforeEach(() => {
  db.reset();
  installTransitionRpc(db);
  installRedeemRpc(db);
  modelCalls.length = 0;
  inbox.length = 0;
  wordpress.requests.length = 0;
  wordpress.posts.length = 0;
  wordpress.nextId = 500;
  livePage.status = 200;
  livePage.sitemapHasIt = true;

  db.seed("users", [{ id: USER_ID, email: EMAIL, notify: null }]);
  db.seed("sites", [
    {
      id: SITE_ID,
      user_id: USER_ID,
      domain: SITE_DOMAIN,
      mode: "autopilot",
      veto_hours: VETO.defaultHours,
      publish_time: null,
      publishing_enabled: true,
      timezone: TIME_ZONE,
    },
  ]);
  db.seed("destinations", [
    {
      id: DEST_ID,
      site_id: SITE_ID,
      kind: "wordpress",
      health: "ok",
      config: seal({ baseUrl: WP_BASE, username: "reachkit", applicationPassword: "abcd efgh ijkl mnop" }),
    },
  ]);
  db.seed("drafts", []);
  db.seed("publications", []);
  // The scan that grounds the day's page, and the one own-document read
  // the measurement ledgered for it (§8 reads the bytes already in hand
  // rather than fetching the customer's server again).
  db.seed("scans", [{ id: SCAN_ID, site_id: SITE_ID }]);
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
        readAt: new Date("2026-09-01T09:00:00.000Z").toISOString(),
      },
    },
  ]);

  opportunities = opportunityDoubles.newMemoryState({
    now: EVENING,
    profile: generateFixtures.report().market.kind === "unmeasured"
      ? null
      : (generateFixtures.report().market as { value: { profile: unknown } }).value.profile as never,
  });
  setOpportunityStore(opportunityDoubles.memoryStore(opportunities));

  generateStore = joinedGenerateStore();
  setGenerateStore(generateStore);

  __setVendorTransportForTesting(async (payload: string) => {
    inbox.push(JSON.parse(payload) as SentMail);
    return { status: 200, headers: {}, body: JSON.stringify({ id: `resend-${inbox.length}` }) };
  });
});

afterEach(() => {
  setGenerateStore(null);
  setOpportunityStore(null);
  setCalendarSiteReader(null);
  __setVendorTransportForTesting(null);
});

// ── The day, in the order it happens ────────────────────────────────────

/** The opportunity §7 left for this site — yesterday's supply, which is
 *  what the evening tick picks from. */
async function seedOneOpportunity(): Promise<string> {
  const seedRow = generateFixtures.opportunity();
  const inserted = await opportunityDoubles.memoryStore(opportunities).insert({
    site_id: SITE_ID,
    scan_id: SCAN_ID,
    type: seedRow.type,
    family: seedRow.family,
    target_query: seedRow.targetQuery,
    target_ref: seedRow.targetRef,
    proposed_slug: seedRow.targetRef,
    title: seedRow.title,
    volume: 1900,
    evidence: seedRow.evidence,
    acceptance: seedRow.acceptance,
    fit_band: seedRow.fitBand,
    effort: seedRow.effort,
  });
  if (inserted.outcome !== "created") throw new Error("the fixture opportunity was refused");
  // §9 reads the page's slug off `opportunities`, through the embedding its
  // own delivery select uses. It is the same row §7's store holds; here the
  // two views are two doubles, joined once, under the id §7 minted.
  db.seed("opportunities", [{ id: inserted.row.id, proposed_slug: seedRow.targetRef }]);
  return inserted.row.id;
}

/** Steps 1–2 — the evening tick's own work for one site. */
async function generateTonightsPage(): Promise<string> {
  await seedOneOpportunity();
  const outcome = await generateDayPage({
    siteId: SITE_ID,
    publishDate: nextPublishDate(EVENING, TIME_ZONE),
  });
  if (!outcome.ok) throw new Error(`generation did not produce a page: ${JSON.stringify(outcome)}`);
  return outcome.draftId;
}

/** Step 3 — #45's edge into review, with the deadline a 24-hour window
 *  puts on it, and the telling the customer is owed.
 *
 *  The telling is now a **mail**, sent through the real template, the real
 *  compose shell and the real send seam (#174): the decision was built
 *  with the veto leaf and nothing composed it, so a real customer was
 *  never told a page was in review. The token this returns is read back
 *  out of the link that actually went to the inbox, so the veto tests
 *  below stop the page with the link the customer was actually sent. */
async function enterReviewAndTell(draftId: string): Promise<{ token: string }> {
  const deadline = new Date(TOLD_AT.getTime() + VETO.defaultHours * 3_600_000);
  const row = theDraftRow();
  row.veto_deadline = deadline.toISOString();
  const moved = await transition(draftId, "in_review", { kind: "system", job: "draft/generate" }, {
    at: TOLD_AT,
  });
  expect(moved.ok).toBe(true);

  const told = await sendDraftReadyMail({ draftId, destination: "wordpress", at: TOLD_AT });
  expect(told.sent).toBe(true);
  return { token: tokenFromInbox() };
}

/** The stop link as it left, read out of the last `draft-ready` mail. */
function tokenFromInbox(): string {
  const mails = inbox.filter((mail) => mail.subject.startsWith("mail.draftReady"));
  const last = mails[mails.length - 1];
  if (last === undefined) throw new Error("no draft-ready mail was sent");
  const href = /href="([^"]*\/veto\/[^"]*)"/.exec(last.html)?.[1];
  if (href === undefined) throw new Error(`the draft-ready mail carried no stop link: ${last.html}`);
  return decodeURIComponent(href.slice(href.lastIndexOf("/") + 1));
}

/** The first publish time at or after the window runs out — the moment
 *  §9's `publishable_and_due` guard opens, read from the predicate rather
 *  than guessed at, so this journey and the engine agree on one clock. */
function whenItIsDue(): Date {
  const answer = becomesPublishable(machineDraft());
  if (!answer.publishable) throw new Error("the page never became publishable");
  return new Date(answer.at.getTime() + 60_000);
}

const JOURNEY_TIMEOUT_MS = 30_000;

describe("the daily loop: pick → generate → tell → publish → +24h check (JN-003)", () => {
  it("the tick is due in the site's own evening, and the page it prepares is tomorrow's", async () => {
    // The gate is the site's own hour and never UTC (ADR-060).
    expect(localClock(EVENING, TIME_ZONE).hour).toBe(DRAFT_DUE_HOUR_LOCAL);
    expect(isDraftDue(EVENING, TIME_ZONE)).toBe(true);
    expect(isDraftDue(new Date(EVENING.getTime() + 3_600_000), TIME_ZONE)).toBe(false);
    // The evening before the publish date, in the site's own zone.
    expect(nextPublishDate(EVENING, TIME_ZONE)).toBe("2026-09-02");

    // The two holes in this chain are filled (#173), so this asserts what
    // they now do rather than that they throw. The tick walks a real list:
    // this founder's site is on it, with the zone the gate above is decided
    // in, and the composition of the two is the tick's own selection.
    const sites = await engine.activeSites();
    expect(sites).toEqual([{ siteId: SITE_ID, timeZone: TIME_ZONE }]);
    expect(sites.filter((site) => isDraftDue(EVENING, site.timeZone))).toHaveLength(1);

    // And a site the customer has stopped is not prepared a page at all —
    // the discriminating half, because a list that returned every row would
    // pass the assertion above.
    await setPublishing(SITE_ID, false, { kind: "customer", userId: USER_ID });
    expect(await engine.activeSites()).toEqual([]);
    await setPublishing(SITE_ID, true, { kind: "customer", userId: USER_ID });
    expect(await engine.activeSites()).toHaveLength(1);
  });

  it(
    "pick → generate: one page, grounded in the customer's own measured text, inside CAP_DRAFT",
    async () => {
      const draftId = await generateTonightsPage();

      const row = theDraftRow();
      expect(row.id).toBe(draftId);
      expect(row.state).toBe("generating");
      expect(String(row.body_md)).toContain("Teams on the starter plan get 25 seats");
      // §8 hard rule 1: the fact is the customer's own, carried with the
      // page it was read from — never re-fetched at draft time.
      const stored = generateStore.rows.get(draftId);
      expect((stored?.grounded_fact as { url: string } | null)?.url).toBe(
        `https://${SITE_DOMAIN}/pricing`
      );
      expect(stored?.rule_failures).toBeNull();
      expect(row.hard_rules_passed).toBe(true);

      // Four model steps, each at its own call site, all ledgered against
      // the scan that grounds the page — and the whole day inside §8's cap.
      expect(modelCalls).toHaveLength(4);
      const rows = ledger();
      expect(rows.map((r) => r.source)).toEqual([
        "generate.brief",
        "generate.outline",
        "generate.draft",
        "generate.answerability",
      ]);
      const spent = rows.reduce((total, r) => total + r.costCents, 0);
      expect(spent).toBeGreaterThan(0);
      expect(spent).toBeLessThanOrEqual(CAPS.DRAFT_C);
      // The draft's own spend stays the draft's: the context is opened with
      // the roll-up off, so nothing wrote to the scan at all.
      expect(db.queries.filter((q) => q.table === "scans" && q.verb === "update")).toEqual([]);
      // It is on the draft instead, where §10 reads it.
      expect(Number(generateStore.rows.get(draftId)?.cost_cents)).toBe(Math.round(spent));
    },
    JOURNEY_TIMEOUT_MS
  );

  it(
    "the veto window: the page enters review, the customer is told, and nothing publishes untold",
    async () => {
      const draftId = await generateTonightsPage();

      // Untold, the page is held by the guard that says so — before any
      // window has even opened.
      const before = await transition(draftId, "in_review", { kind: "system", job: "draft/generate" }, {
        at: TOLD_AT,
      });
      expect(before.ok).toBe(true);
      expect(toldCurrentPair(machineDraft()).told).toBe(false);

      const stopAction = await issueVetoLink(draftId, TOLD_AT);
      expect(stopAction.token).toBe(""); // no deadline stamped yet: no interval to offer

      // #45's stamp, and the telling it makes possible.
      const deadline = new Date(TOLD_AT.getTime() + VETO.defaultHours * 3_600_000);
      theDraftRow().veto_deadline = deadline.toISOString();
      const link = await issueVetoLink(draftId, TOLD_AT);
      expect(link.token).not.toBe("");
      expect(link.expiresAt?.toISOString()).toBe(deadline.toISOString());

      const draft = machineDraft();
      const telling = await tellingFor({ draft, destination: "wordpress", stopAction: link });
      if (telling.kind !== "interval") throw new Error("an autopilot site with a window is told an interval");
      expect(telling.copy).toBe("mail.draftReady.autopilotWindow");
      expect(telling.stopAction.token).toBe(link.token);
      // The telling is a **mail**, and the record follows the send (#174).
      // Until it left, the page is still untold and still held.
      const inboxBefore = inbox.length;
      const told = await sendDraftReadyMail({ draftId, destination: "wordpress", at: TOLD_AT });
      expect(told.sent).toBe(true);
      expect(toldCurrentPair(machineDraft()).told).toBe(true);

      const mails = inbox.filter((mail) => mail.subject.startsWith("mail.draftReady"));
      expect(inbox.length).toBe(inboxBefore + 1);
      expect(mails).toHaveLength(1);
      expect(mails[0]!.to).toEqual([EMAIL]);
      // The right telling of the three, and no trace of the other two.
      expect(mails[0]!.html).toContain("mail.draftReady.autopilotWindow");
      expect(mails[0]!.html).not.toContain("mail.draftReady.copilot");
      expect(mails[0]!.html).not.toContain("mail.draftReady.autopilotZero");

      // §12's "title, why-data" (#183). The page the mail is about is
      // named, and it is named **through the GeneratedText label** — the
      // one carrier model text reaches a customer by. The title never
      // appears in the subject, which is a registry key.
      const written = theDraftRow().title as string;
      expect(mails[0]!.html).toContain("generated.page.written");
      expect(mails[0]!.html).toContain(written);
      expect(mails[0]!.subject.startsWith("mail.draftReady")).toBe(true);
      expect(mails[0]!.subject).not.toContain(written);

      // And why §7 chose it: the search it targets and how often it is
      // searched, read from the evidence stored at creation. This journey
      // measured that volume once, in the deep pass — the mail states that
      // number and does not go and ask again.
      expect(mails[0]!.html).toContain("mail.draftReady.why.search");
      expect(mails[0]!.html).toContain("mail.draftReady.why.volume");
      // The one veto link, and it is a link the database will accept: the
      // sender mints the token it sends, so the hash on the row is the
      // hash of what reached the inbox. (The link minted by hand above is
      // superseded — one page has one live stop link, which is why the
      // sender owns the minting rather than taking one from its caller.)
      expect(hashToken(tokenFromInbox())).toBe(theDraftRow().veto_token_hash);

      // The window is the site's own — `VETO.defaultHours` from the moment
      // the page entered review — and the moment named in the telling is
      // the first publish time at or after it, never earlier.
      expect(link.expiresAt!.getTime() - TOLD_AT.getTime()).toBe(VETO.defaultHours * 3_600_000);
      const inside = becomesPublishable(machineDraft());
      expect(inside.publishable).toBe(true);
      if (!inside.publishable) throw new Error("unreachable");
      expect(inside.at.getTime()).toBeGreaterThanOrEqual(deadline.getTime());
      expect(telling.publishesAt.getTime()).toBe(inside.at.getTime());

    },
    JOURNEY_TIMEOUT_MS
  );

  it(
    "the stop link in that telling stops the page, and nothing is published",
    async () => {
      const draftId = await generateTonightsPage();
      const { token } = await enterReviewAndTell(draftId);

      const redeemed = await redeemVeto(token, { kind: "customer", userId: USER_ID }, new Date(TOLD_AT.getTime() + 3_600_000));
      expect(redeemed).toEqual({ ok: true, draftId });
      expect(theDraftRow().state).toBe("skipped");

      // Single use, and a skipped page has no edge to publishing at all.
      const again = await redeemVeto(token, { kind: "customer", userId: USER_ID }, new Date(TOLD_AT.getTime() + 7_200_000));
      expect(again.ok).toBe(false);
      const moved = await transition(draftId, "publishing", { kind: "system", job: "publish/execute" });
      expect(moved).toMatchObject({ ok: false, refused: "not_a_transition" });
      expect(db.rows("publications")).toEqual([]);
      expect(wordpress.posts).toEqual([]);
    },
    JOURNEY_TIMEOUT_MS
  );

  it(
    "the window runs out and the page goes out once, to the customer's own WordPress",
    async () => {
      const draftId = await generateTonightsPage();
      await enterReviewAndTell(draftId);

      const at = whenItIsDue();
      const approved = await transition(draftId, "approved", { kind: "system", job: "publish/execute" }, { at });
      expect(approved.ok).toBe(true);

      const result = await publish({
        draftId,
        destination: "wordpress",
        by: { kind: "system", job: "publish/execute" },
        at,
        adapterFor: (kind) => (kind === "wordpress" ? WORDPRESS_ADAPTER : null),
      });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("unreachable");
      expect(theDraftRow().state).toBe("published");

      // Exactly one write to the post: a create-then-publish two-step would
      // read as a harmless follow-up and is not one (ADR-084).
      const writes = wordpress.requests.filter(
        (r) => r.method === "POST" && r.path.startsWith("/wp/v2/posts")
      );
      expect(writes).toHaveLength(1);
      expect((writes[0]?.body as { status?: string })?.status).toBe("publish");

      // The outcome is recorded as it happened, and the 24-hour check is
      // due because the delivery came back with an address — never because
      // of the destination's kind.
      const publication = db.rows("publications")[0];
      expect(publication?.delivery_state).toBe("delivered");
      // What this call did to this page, as the adapter that did it
      // declared — never inferred from the destination's kind or from the
      // address coming back (ADR-084 decision 4). The create came back
      // `status: publish`, so ReachKit made it live.
      expect(publication?.made_live_by_us).toBe(true);
      expect(String(publication?.live_url)).toBe(`${WP_BASE}${LIVE_PATH}`);
      const due = new Date(String(publication?.verify_due_at)).getTime() - at.getTime();
      expect(due).toBe(PUBLISH_VERIFY_DELAY_H * 3_600_000);
    },
    JOURNEY_TIMEOUT_MS
  );

  it(
    "the stop hold: a page prepared before a stop is still there, in the state it was in",
    async () => {
      const draftId = await generateTonightsPage();
      await enterReviewAndTell(draftId);
      const at = whenItIsDue();
      await transition(draftId, "approved", { kind: "system", job: "publish/execute" }, { at });

      // The customer switches publishing off. It is read where the decision
      // is made, so no attempt begins.
      await setPublishing(SITE_ID, false, { kind: "customer", userId: USER_ID });
      const held = await publish({
        draftId,
        destination: "wordpress",
        by: { kind: "system", job: "publish/execute" },
        at,
        adapterFor: () => WORDPRESS_ADAPTER,
      });
      expect(held.ok).toBe(false);
      if (held.ok) throw new Error("unreachable");
      expect(held.reason).toBe("held");
      // Held is the absence of an edge, not an eleventh state.
      expect(theDraftRow().state).toBe("approved");
      expect(db.rows("publications")).toEqual([]);
      expect(wordpress.posts).toEqual([]);

      const pages = await heldPages(SITE_ID);
      expect(pages.count).toBe(1);
      expect(await resumeOrder(SITE_ID)).toEqual([draftId]);

      // ReachKit's own stop is the second reason no attempt begins, not a
      // second mechanism: the same page, in the same set, in the same
      // order. `reachKitStopped()` reads `KILL_SWITCH`, a deployment
      // binding parsed once at module load, so the journey drives it
      // through the dependency the machine declares for exactly this.
      await setPublishing(SITE_ID, true, { kind: "customer", userId: USER_ID });
      const stopped = await publish({
        draftId,
        destination: "wordpress",
        by: { kind: "system", job: "publish/execute" },
        at,
        deps: {
          // The claim re-check is opened here so the stop is the reason
          // this attempt does not begin — which is what the assertion
          // below is about. The guard's own occasions are
          // `tests/publish/machine/claim-recheck.test.ts`'s.
          claimRecheckOutstanding: async () => false,
          outstandingMatch: async () => null,
          reachKitStopped: async () => true,
          isPublishingOn: async () => true,
          hasCeilingRoom: async () => true,
          destinationWorking: async () => true,
          rule: PUBLISHABLE_RULE,
        },
        adapterFor: () => WORDPRESS_ADAPTER,
      });
      expect(stopped).toMatchObject({ ok: false, reason: "held" });
      expect(theDraftRow().state).toBe("approved");
      expect((await heldPages(SITE_ID)).count).toBe(1);
      expect(await resumeOrder(SITE_ID)).toEqual([draftId]);

      // And when both stops lift, the same page resumes, in the state it
      // was held in.
      const out = await publish({
        draftId,
        destination: "wordpress",
        by: { kind: "system", job: "publish/execute" },
        at,
        adapterFor: () => WORDPRESS_ADAPTER,
      });
      expect(out.ok).toBe(true);
      expect(theDraftRow().state).toBe("published");
    },
    JOURNEY_TIMEOUT_MS
  );

  it(
    "+24h: ReachKit looks at the page, records what it saw, and tells the customer either way",
    async () => {
      const draftId = await generateTonightsPage();
      await enterReviewAndTell(draftId);
      const at = whenItIsDue();
      await transition(draftId, "approved", { kind: "system", job: "publish/execute" }, { at });
      const published = await publish({
        draftId,
        destination: "wordpress",
        by: { kind: "system", job: "publish/execute" },
        at,
        adapterFor: () => WORDPRESS_ADAPTER,
      });
      if (!published.ok) throw new Error("the page did not go out");

      // The live page, as the check finds it a day later.
      livePage.html = `<html><head><title>${PAGE_BODY.title}</title></head><body>${CLEAN_MARKDOWN}</body></html>`;

      const run = await engine.verifyLive({ publicationId: published.publicationId });
      expect(run).toEqual({ done: true });

      // One recorded check, against the publication, in the one column the
      // partial index reads: `verify is null` is what makes the row due,
      // so writing it is what makes it never due again.
      const row = db.rows("publications")[0];
      const stored = row?.verify as
        | { outcome?: string; checks?: Record<string, unknown> }
        | undefined;
      expect(stored?.outcome).toBe("found");
      // The four checks §9 promises, produced in the `found` arm and in no
      // other.
      expect(Object.keys(stored?.checks ?? {}).sort()).toEqual([...CHECK_IDS].sort());

      // And it runs once, ever: a second call finds the outcome recorded
      // and reaches neither the page nor the mail again.
      const second = await engine.verifyLive({ publicationId: published.publicationId });
      expect(second).toEqual({ done: true });
      expect(inbox.filter((mail) => mail.subject.startsWith("mail.published"))).toHaveLength(1);

      // The telling that goes with it — one mail, through the one send
      // seam, to the account that owns the site. It is sent on the same
      // occasion in every arm: a failed check, an absent page and an
      // unconfirmed one are none of them a reason to send nothing.
      const mails = inbox.filter((mail) => mail.subject.startsWith("mail.published"));
      expect(mails[0]?.to).toEqual([EMAIL]);
    },
    JOURNEY_TIMEOUT_MS
  );

  it(
    "and the calendar still accounts for the date the page was written for",
    async () => {
      await generateTonightsPage();

      setCalendarSiteReader(async () => ({ siteId: SITE_ID, timeZone: TIME_ZONE }));
      const now = new Date("2026-09-02T15:00:00.000Z");
      const month = monthOf(dayKeyOf(now, TIME_ZONE));
      const facts = await readCalendarFacts({
        site: { siteId: SITE_ID, timeZone: TIME_ZONE },
        month,
        now,
      });

      // §7's supply put a page on the date, and the calendar reads it.
      expect(facts.drafts.length).toBeGreaterThan(0);
      expect(facts.drafts[0]?.why.search).toBe("best project management software");
      expect(facts.unusedSupply).toBe(1);

      // What the screen does not yet carry, and whose it is: the draft's
      // own state and the held set are §9's rows, and `store.ts` names them
      // as #45's. The engine has both today — the screen reads neither.
      expect(facts.drafts[0]?.state).toBe("planned");
      expect(facts.drafts[0]?.draftId).toBeNull();
      expect(facts.heldDays).toEqual([]);
      expect((await heldPages(SITE_ID)).count).toBe(0);
    },
    JOURNEY_TIMEOUT_MS
  );
});
