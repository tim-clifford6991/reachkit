// tests/publish/verify/verify.test.ts — one fetch, three outcomes, and four
// `Measured<boolean>` in the one arm that has them.
//
// The two arm-separation rows are written against the two merges ADR-085
// exists to stop, and both of those merges read as tidier code:
//
//   - mapping any non-2xx to `page_not_found` (the blacklist);
//   - recording `could_not_confirm` as `reachable: false`, which turns
//     ReachKit's own network problem into an accusation against the
//     customer's page.
//
// The third discriminating row is criterion 6's: a sitemap that did not
// answer records no condition and suppresses nothing, where a site that
// *answered* that it publishes none does.
//
// The archived plan is WO-234.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, type Row } from "../harness";
import { AI_READER_AGENTS, VERIFY } from "@/lib/config/constants";
import type { FetchOutcome, RobotsPolicy } from "@/lib/egress/types";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

// ── The egress double ───────────────────────────────────────────────────
//
// Every answer this suite hands the module comes through here, so the
// module's own fetch count, its user-agent token and the order it asks in
// are all observable.

interface FetchCall {
  url: string;
  userAgent: string | undefined;
}

let fetchCalls: FetchCall[] = [];
let answers: Map<string, FetchOutcome> = new Map();
let robotsAnswer: RobotsPolicy | { ok: false; reason: string } = { ok: false, reason: "unset" };
let robotsCalls: string[] = [];

vi.mock("@/lib/egress", () => ({
  safeFetch: async (url: string, opts?: { userAgent?: string }): Promise<FetchOutcome> => {
    fetchCalls.push({ url, userAgent: opts?.userAgent });
    return (
      answers.get(url) ?? { ok: false, reason: "dns", url, readAt: new Date(0) }
    );
  },
  readRobots: async (origin: string) => {
    robotsCalls.push(origin);
    return robotsAnswer;
  },
}));

const { verifyLive } = await import("@/lib/publish/verify/verify");

const LIVE_URL = "https://example.com/how-long-does-a-roof-last";
const ORIGIN = "https://example.com";
const TITLE = "How long does a roof last?";
const BODY_MD = "A slate roof lasts 80 to 150 years; asphalt shingles last 15 to 30.";
const NOW = new Date(Date.UTC(2026, 8, 2, 10, 0, 0));
const DUE_AT = new Date(Date.UTC(2026, 8, 2, 9, 0, 0));

const OUR_PAGE = `<!doctype html><html><head><title>${TITLE}</title>
<link rel="canonical" href="${LIVE_URL}"></head>
<body><p>A slate roof lasts 80 to 150 years; asphalt shingles last 15 to 30.</p></body></html>`;

const PARKED = `<!doctype html><html><head><title>example.com is for sale</title></head>
<body><h1>This domain may be for sale</h1></body></html>`;

function ok(url: string, html: string, over: Partial<Extract<FetchOutcome, { ok: true }>> = {}): FetchOutcome {
  return {
    ok: true,
    status: 200,
    url,
    html,
    bytes: html.length,
    readAt: NOW,
    headers: {},
    ...over,
  };
}

function sitemapXml(...urls: string[]): string {
  return `<?xml version="1.0"?><urlset>${urls
    .map((u) => `<loc>${u}</loc>`)
    .join("")}</urlset>`;
}

function robotsPolicy(over: Partial<RobotsPolicy> = {}): RobotsPolicy {
  return {
    ok: true,
    origin: ORIGIN,
    readAt: NOW,
    disallowsAll: false,
    disallowedAgents: {},
    sitemaps: [],
    absent: false,
    ...over,
  };
}

function seed(over: Row = {}): void {
  db.reset();
  db.seed("drafts", [{ id: "d1", title: TITLE, body_md: BODY_MD }]);
  db.seed("publications", [
    {
      id: "p1",
      draft_id: "d1",
      site_id: "s1",
      destination: "hosted",
      live_url: LIVE_URL,
      published_at: new Date(Date.UTC(2026, 8, 1, 9, 0)).toISOString(),
      unpublished_at: null,
      verify_due_at: DUE_AT.toISOString(),
      verify: null,
      ...over,
    },
  ]);
}

/** The happy site: our page, a robots document that permits everyone and
 *  names a sitemap, and a sitemap that lists the page. */
function happySite(pageHtml: string = OUR_PAGE, pageOver: Partial<Extract<FetchOutcome, { ok: true }>> = {}): void {
  answers = new Map([
    [LIVE_URL, ok(LIVE_URL, pageHtml, pageOver)],
    [`${ORIGIN}/sitemap.xml`, ok(`${ORIGIN}/sitemap.xml`, sitemapXml(LIVE_URL))],
    [
      `${ORIGIN}/sitemap_index.xml`,
      ok(`${ORIGIN}/sitemap_index.xml`, sitemapXml(LIVE_URL)),
    ],
  ]);
  robotsAnswer = robotsPolicy();
}

function storedVerify(): Record<string, unknown> {
  return db.rows("publications")[0]!.verify as Record<string, unknown>;
}

beforeEach(() => {
  fetchCalls = [];
  robotsCalls = [];
  answers = new Map();
  robotsAnswer = { ok: false, reason: "unset" };
  seed();
});

describe("verifyLive — the found arm (REQ-062 c1, c2)", () => {
  it("24 hours after it published, the live address is fetched and the four outcomes are recorded", async () => {
    happySite();
    const run = await verifyLive("p1", NOW);
    expect(run.recorded).toBe(true);
    if (!run.recorded) throw new Error("unreachable");
    expect(run.result.outcome).toBe("found");
    if (run.result.outcome !== "found") throw new Error("unreachable");

    expect(run.result.checks.reachable).toEqual({ kind: "measured", value: true, at: NOW });
    expect(run.result.checks.indexable).toEqual({ kind: "measured", value: true, at: NOW });
    expect(run.result.checks.sitemap).toEqual({ kind: "measured", value: true, at: NOW });
    expect(run.result.checks.aiReadable).toEqual({ kind: "measured", value: true, at: NOW });
    expect(run.result.checkedAt).toEqual(NOW);
  });

  it("the page is fetched exactly once, with VERIFY.userAgent and never one of the six named AI agents", async () => {
    happySite();
    await verifyLive("p1", NOW);
    const pageFetches = fetchCalls.filter((c) => c.url === LIVE_URL);
    expect(pageFetches).toHaveLength(1);
    expect(pageFetches[0]!.userAgent).toBe("reachkit-verify");
    for (const agent of AI_READER_AGENTS) {
      expect(VERIFY.userAgent).not.toContain(agent);
    }
  });

  it("each of the four outcomes is recorded with the moment it was checked", async () => {
    happySite();
    await verifyLive("p1", NOW);
    const stored = storedVerify();
    expect(stored.checkedAt).toBe(NOW.toISOString());
    expect(Object.keys(stored.checks as object).sort()).toEqual([
      "aiReadable",
      "indexable",
      "reachable",
      "sitemap",
    ]);
  });

  it("an X-Robots-Tag alone makes indexable false", async () => {
    happySite(OUR_PAGE, { headers: { "x-robots-tag": "noindex, nofollow" } });
    const run = await verifyLive("p1", NOW);
    if (!run.recorded || run.result.outcome !== "found") throw new Error("unreachable");
    expect(run.result.checks.indexable).toEqual({ kind: "measured", value: false, at: NOW });
  });

  it("a meta robots tag alone makes indexable false", async () => {
    const html = OUR_PAGE.replace("</head>", `<meta name="robots" content="noindex"></head>`);
    happySite(html);
    const run = await verifyLive("p1", NOW);
    if (!run.recorded || run.result.outcome !== "found") throw new Error("unreachable");
    expect(run.result.checks.indexable).toEqual({ kind: "measured", value: false, at: NOW });
  });

  it("a check the page itself did not pass is stated plainly, never omitted and never pending", async () => {
    // A page absent from a sitemap the site **does** publish is that page
    // failing, and criterion 3 governs it: a measured `false`, distinct
    // from an `unmeasured` one.
    happySite();
    answers.set(
      `${ORIGIN}/sitemap_index.xml`,
      ok(`${ORIGIN}/sitemap_index.xml`, sitemapXml(`${ORIGIN}/something-else`))
    );
    answers.set(
      `${ORIGIN}/sitemap.xml`,
      ok(`${ORIGIN}/sitemap.xml`, sitemapXml(`${ORIGIN}/something-else`))
    );
    const run = await verifyLive("p1", NOW);
    if (!run.recorded || run.result.outcome !== "found") throw new Error("unreachable");
    expect(run.result.checks.sitemap).toEqual({ kind: "measured", value: false, at: NOW });
  });

  it("a JavaScript-gated page reaches found and fails aiReadable — the failure the check exists to catch", async () => {
    const gated = `<!doctype html><html><head><title>${TITLE}</title>
<link rel="canonical" href="${LIVE_URL}"></head>
<body><div id="root"></div><script>{"body":"A slate roof lasts 80 to 150 years"}</script></body></html>`;
    happySite(gated);
    const run = await verifyLive("p1", NOW);
    if (!run.recorded || run.result.outcome !== "found") throw new Error("unreachable");
    expect(run.result.checks.aiReadable).toEqual({ kind: "measured", value: false, at: NOW });
  });

  it("nothing defaults a Measured<boolean> to false: an outcome that was not observed is unmeasured", async () => {
    happySite();
    robotsAnswer = { ok: false, reason: "robots.txt answered status 503" };
    answers.delete(`${ORIGIN}/sitemap.xml`);
    answers.delete(`${ORIGIN}/sitemap_index.xml`);
    const run = await verifyLive("p1", NOW);
    if (!run.recorded || run.result.outcome !== "found") throw new Error("unreachable");
    expect(run.result.checks.sitemap.kind).toBe("unmeasured");
    expect(run.result.checks.aiReadable.kind).toBe("unmeasured");
    expect(run.result.checks.sitemap).not.toHaveProperty("value");
  });
});

describe("verifyLive — the two arms that assert nothing (REQ-062 c4, ADR-085)", () => {
  it("a 404 or a 410, and no other answer, records that no page was found, with the date", async () => {
    for (const status of [404, 410] as const) {
      seed();
      answers = new Map([[LIVE_URL, ok(LIVE_URL, PARKED, { status })]]);
      const run = await verifyLive("p1", NOW);
      if (!run.recorded) throw new Error("unreachable");
      expect(run.result).toEqual({ outcome: "page_not_found", status, checkedAt: NOW });
    }
  });

  it("every other answer records that the check could not be confirmed, with the date", async () => {
    const cases: { answer: FetchOutcome; why: string }[] = [
      { answer: { ok: false, reason: "dns", url: LIVE_URL, readAt: NOW }, why: "unreachable" },
      { answer: { ok: false, reason: "timeout", url: LIVE_URL, readAt: NOW }, why: "unreachable" },
      { answer: { ok: false, reason: "refused", url: LIVE_URL, readAt: NOW }, why: "unreachable" },
      { answer: ok(LIVE_URL, "", { status: 500 }), why: "server_error" },
      { answer: ok(LIVE_URL, "", { status: 403 }), why: "server_error" },
      {
        answer: ok(`${ORIGIN}/somewhere-else`, OUR_PAGE),
        why: "redirected_away",
      },
      { answer: ok(LIVE_URL, PARKED), why: "not_our_page" },
    ];
    for (const { answer, why } of cases) {
      seed();
      answers = new Map([[LIVE_URL, answer]]);
      const run = await verifyLive("p1", NOW);
      if (!run.recorded) throw new Error("unreachable");
      expect(run.result, why).toEqual({ outcome: "could_not_confirm", why, checkedAt: NOW });
    }
  });

  it("neither arm produces the four checks, states a failure of the page, or names a cause", async () => {
    for (const answer of [ok(LIVE_URL, PARKED, { status: 404 }), ok(LIVE_URL, "", { status: 500 })]) {
      seed();
      answers = new Map([[LIVE_URL, answer]]);
      const run = await verifyLive("p1", NOW);
      if (!run.recorded) throw new Error("unreachable");
      expect(run.result).not.toHaveProperty("checks");
      expect(storedVerify()).not.toHaveProperty("checks");
      // In particular, `could_not_confirm` never becomes `reachable: false`
      // — ReachKit's own network problem is not an accusation against the
      // customer's page.
      expect(JSON.stringify(run.result)).not.toContain("reachable");
    }
  });

  it("page_not_found is never recorded for anything but a 404 or a 410", async () => {
    for (const status of [200, 301, 302, 400, 401, 403, 418, 429, 451, 500, 502, 503]) {
      seed();
      answers = new Map([[LIVE_URL, ok(LIVE_URL, PARKED, { status })]]);
      const run = await verifyLive("p1", NOW);
      if (!run.recorded) throw new Error("unreachable");
      expect(run.result.outcome, `status ${status}`).not.toBe("page_not_found");
    }
  });

  it("neither arm makes the sitemap or robots fetches — they decide checks those arms do not produce", async () => {
    seed();
    answers = new Map([[LIVE_URL, ok(LIVE_URL, PARKED, { status: 404 })]]);
    await verifyLive("p1", NOW);
    expect(fetchCalls.map((c) => c.url)).toEqual([LIVE_URL]);
    expect(robotsCalls).toEqual([]);
  });
});

describe("verifyLive — criterion 6's site condition", () => {
  it("a site that answered that it publishes no sitemap is recorded as a condition of that site, dated", async () => {
    happySite();
    answers.set(`${ORIGIN}/sitemap.xml`, ok(`${ORIGIN}/sitemap.xml`, "", { status: 404 }));
    answers.set(
      `${ORIGIN}/sitemap_index.xml`,
      ok(`${ORIGIN}/sitemap_index.xml`, "", { status: 404 })
    );
    const run = await verifyLive("p1", NOW);
    if (!run.recorded || run.result.outcome !== "found") throw new Error("unreachable");
    expect(run.siteCondition).toEqual({ kind: "publishes_no_sitemap", foundAt: NOW });
    // And no page on that site is marked as having failed a check for that
    // cause: the affected outcome is `unmeasured` with its reason, never
    // `false`.
    expect(run.result.checks.sitemap.kind).toBe("unmeasured");
  });

  it("a sitemap that did not answer, or came back unparseable, records no condition and suppresses nothing", async () => {
    // The discriminating row. An implementation keyed on "could not be
    // reached" passes the row above and fails this one, and its failure
    // mode is a check silently disabled for every later page on the site.
    const nonAnswers: FetchOutcome[] = [
      { ok: false, reason: "timeout", url: `${ORIGIN}/sitemap.xml`, readAt: NOW },
      ok(`${ORIGIN}/sitemap.xml`, "", { status: 503 }),
      ok(`${ORIGIN}/sitemap.xml`, "<html>not a sitemap at all</html>"),
    ];
    for (const nonAnswer of nonAnswers) {
      seed();
      happySite();
      answers.set(`${ORIGIN}/sitemap.xml`, nonAnswer);
      answers.set(`${ORIGIN}/sitemap_index.xml`, {
        ...nonAnswer,
        url: `${ORIGIN}/sitemap_index.xml`,
      } as FetchOutcome);
      const run = await verifyLive("p1", NOW);
      if (!run.recorded || run.result.outcome !== "found") throw new Error("unreachable");
      expect(run.siteCondition).toBeNull();
      expect(run.result.checks.sitemap.kind).toBe("unmeasured");
      expect(storedVerify().siteCondition).toBeNull();
    }
  });

  it("a robots document that blocks the permitted readers across the whole site is that site's condition", async () => {
    happySite();
    robotsAnswer = robotsPolicy({ disallowsAll: true });
    const run = await verifyLive("p1", NOW);
    if (!run.recorded || run.result.outcome !== "found") throw new Error("unreachable");
    expect(run.siteCondition).toEqual({ kind: "robots_blocks_site", foundAt: NOW });
    expect(run.result.checks.aiReadable.kind).toBe("unmeasured");
  });

  it("a robots document that names one permitted reader by name blocks the site for it", async () => {
    happySite();
    robotsAnswer = robotsPolicy({ disallowedAgents: { [AI_READER_AGENTS[0]]: true } });
    const run = await verifyLive("p1", NOW);
    if (!run.recorded) throw new Error("unreachable");
    expect(run.siteCondition).toEqual({ kind: "robots_blocks_site", foundAt: NOW });
  });

  it("a robots document that did not answer records no condition and costs this page's check alone", async () => {
    happySite();
    robotsAnswer = { ok: false, reason: "robots.txt answered status 500" };
    const run = await verifyLive("p1", NOW);
    if (!run.recorded || run.result.outcome !== "found") throw new Error("unreachable");
    expect(run.siteCondition).toBeNull();
    expect(run.result.checks.aiReadable.kind).toBe("unmeasured");
  });

  it("an absent robots.txt is an answer with nothing in it, and permits everyone", async () => {
    happySite();
    robotsAnswer = robotsPolicy({ absent: true, disallowsAll: true });
    const run = await verifyLive("p1", NOW);
    if (!run.recorded || run.result.outcome !== "found") throw new Error("unreachable");
    expect(run.siteCondition).toBeNull();
    expect(run.result.checks.aiReadable).toEqual({ kind: "measured", value: true, at: NOW });
  });
});

describe("verifyLive — what it will not do", () => {
  it("runs no check where one is not due, and writes nothing", async () => {
    seed();
    happySite();
    const run = await verifyLive("p1", new Date(Date.UTC(2026, 8, 2, 8, 0)));
    expect(run).toEqual({ recorded: false, because: "not_yet" });
    expect(fetchCalls).toEqual([]);
    expect(storedVerify()).toBeNull();
  });

  it("runs no check for a page taken down before its check was due", async () => {
    seed({ unpublished_at: new Date(Date.UTC(2026, 8, 1, 18, 0)).toISOString() });
    happySite();
    expect(await verifyLive("p1", NOW)).toEqual({ recorded: false, because: "never" });
    expect(fetchCalls).toEqual([]);
  });

  it("runs no check where one is already recorded, whichever outcome it recorded", async () => {
    seed({
      verify: {
        outcome: "could_not_confirm",
        why: "server_error",
        checkedAt: NOW.toISOString(),
        siteCondition: null,
      },
    });
    happySite();
    expect(await verifyLive("p1", NOW)).toEqual({ recorded: false, because: "done" });
    expect(fetchCalls).toEqual([]);
  });

  it("never retries a failing check inside one run", async () => {
    seed();
    answers = new Map();
    await verifyLive("p1", NOW);
    expect(fetchCalls.filter((c) => c.url === LIVE_URL)).toHaveLength(1);
  });

  it("writes only publications.verify", async () => {
    happySite();
    await verifyLive("p1", NOW);
    const updates = db.queries.filter((q) => q.verb === "update");
    expect(updates).toHaveLength(1);
    expect(updates[0]!.table).toBe("publications");
    expect(Object.keys(updates[0]!.values ?? {})).toEqual(["verify"]);
  });

  it("the cold-start law: the first page ever published on a site is checked exactly like any later one", async () => {
    // BUILD §6.6 — "every derivation in the product must work for a domain
    // that ranks for nothing". This check reads the page ReachKit
    // published and the site it sits in, and nothing about the customer's
    // own presence: the one publication row here has no predecessor on its
    // site, no earlier recorded condition to read back, and all four
    // outcomes are still produced.
    seed();
    happySite();
    expect(db.rows("publications")).toHaveLength(1);
    const run = await verifyLive("p1", NOW);
    if (!run.recorded || run.result.outcome !== "found") throw new Error("unreachable");
    expect(Object.values(run.result.checks).every((c) => c.kind === "measured")).toBe(true);
    expect(run.siteCondition).toBeNull();
  });

  it("reads no more sitemap documents than the pin allows", async () => {
    happySite();
    // A sitemap index that names a chain longer than the cap.
    const children = Array.from({ length: 20 }, (_, i) => `${ORIGIN}/sitemap-${i}.xml`);
    answers.set(
      `${ORIGIN}/sitemap_index.xml`,
      ok(
        `${ORIGIN}/sitemap_index.xml`,
        `<?xml version="1.0"?><sitemapindex>${children
          .map((u) => `<loc>${u}</loc>`)
          .join("")}</sitemapindex>`
      )
    );
    robotsAnswer = robotsPolicy({ sitemaps: [`${ORIGIN}/sitemap_index.xml`] });
    for (const child of children) answers.set(child, ok(child, sitemapXml(LIVE_URL)));
    await verifyLive("p1", NOW);
    const sitemapFetches = fetchCalls.filter((c) => c.url !== LIVE_URL);
    expect(sitemapFetches.length).toBeLessThanOrEqual(VERIFY.sitemapMaxDocuments);
  });
});
