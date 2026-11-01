/** @vitest-environment jsdom */
// SPEC §4 (owner, 2026-10-19, the simple model; board Main): Overview's weekly
// figures, each counted over the stored rows its link opens, and the figures
// that move over months. Driven through the real `/app` page over rows the
// weekly pass's own writer assembled, for a SaaS site and a local one.
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

import { readFileSync } from "node:fs";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { fakeDb, type FakeDb, type Row } from "../../publish/harness";
import { LOCAL, SAAS, stored, weekWith } from "../../measure/reading-fixture";
import { assembleReading, readingOf, type PageReading } from "@/lib/measure/page-reading";
import { boardFile, compare, readAllow, segments } from "../../../scripts/design/parity.mjs";

const db: FakeDb = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));
vi.mock("@/lib/opportunities", () => ({
  supplyDepth: async () => ({ unused: 9, total: 12 }),
  supplyMeasured: async () => true,
  supplyState: async () => "measured",
  readWeek: async () => [],
}));

const { LIVE_ACCOUNT, RESERVED_ACCOUNT, resetAccount, signedInAs } = await import("../account-door");
const { default: OverviewPage } = await import("@/app/(account)/app/(tabs)/page");
const { MonthsFigure, AI_PAGES_HREF, GOOGLE_PAGES_HREF } = await import("@/app/(account)/app/_overview/Figures");
const { copy } = await import("@/lib/presentation/copy");

const ZONE = "UTC";
const ACCOUNT = { ...LIVE_ACCOUNT, timeZone: ZONE };
const SITE_ID = ACCOUNT.siteId;
/** Friday 9 October 2026. */
const NOW = new Date(Date.UTC(2026, 9, 9, 10, 0, 0));
const PASSES = [new Date(Date.UTC(2026, 8, 28, 6)), new Date(Date.UTC(2026, 9, 5, 6))] as const;

type Site = typeof SAAS;

/** One page over the two Mondays: its place each week, and whether the second week's answer linked it. */
interface Page {
  places: readonly [number | null, number | null];
  linked?: boolean;
  read?: boolean;
}

const url = (site: Site, i: number): string => `${site.page}-${i}`;

function readingsOf(site: Site, pages: readonly Page[], i: number): PageReading {
  let before: PageReading | null = null;
  for (const [week, at] of PASSES.entries()) {
    const report = weekWith({
      domain: site.domain,
      asked: pages.map((p, n) => ({
        publicationId: `p${n}`,
        liveUrl: url(site, n),
        search: `${site.search} ${n}`,
        place: p.places[week] ?? null,
        linked: week === 1 && p.linked === true,
      })),
    });
    before = assembleReading({
      before,
      report,
      now: at,
      page: { id: `p${i}`, liveUrl: url(site, i), search: `${site.search} ${i}`, crawled: true, aiReads: 1, aiVisits: 0, google: null, bing: null },
    });
  }
  return before!;
}

function seed(site: Site, pages: readonly Page[], opts: { hosted?: boolean } = {}): Row[] {
  db.seed("sites", [{ id: SITE_ID, user_id: ACCOUNT.userId, domain: site.domain, timezone: ZONE, competitors: [], veto_hours: 24, publishing_enabled: true }]);
  const destination = opts.hosted === false ? "wordpress" : "hosted";
  db.seed(
    "destinations",
    opts.hosted === false ? [] : [{ id: "dest-hosted", site_id: SITE_ID, kind: "hosted", hostname: `guides.${site.domain}`, hostname_state: "live", deleted_at: null }]
  );
  const pubs = pages.map((page, i) => ({
    id: `p${i}`,
    site_id: SITE_ID,
    draft_id: `d${i}`,
    destination,
    live_url: url(site, i),
    published_at: new Date(Date.UTC(2026, 8, 20 + i)).toISOString(),
    unpublished_at: null,
    search_reading: page.read === false ? null : stored(readingsOf(site, pages, i) as never),
  }));
  db.seed("publications", pubs);
  db.seed("drafts", pages.map((_, i) => ({ id: `d${i}`, site_id: SITE_ID, state: "published", title: `Page ${i}`, created_at: "2026-09-01T00:00:00.000Z" })));
  return pubs;
}

/** Answer fetches over two weeks, plus a search indexer the reads never count. */
const READS: readonly Row[] = [
  { site_id: SITE_ID, publication_id: "p0", day: "2026-10-01", engine: "chatgpt", kind: "answer_fetch", hits: 5 },
  { site_id: SITE_ID, publication_id: "p0", day: "2026-10-06", engine: "chatgpt", kind: "answer_fetch", hits: 3 },
  { site_id: SITE_ID, publication_id: "p1", day: "2026-10-09", engine: "claude", kind: "answer_fetch", hits: 4 },
  { site_id: SITE_ID, publication_id: "p1", day: "2026-10-08", engine: "chatgpt", kind: "index_fetch", hits: 50 },
];

/** Five pages: one climbs sixteen places, one five, one is linked by AI, one slips, one was never read. */
const FIVE: readonly Page[] = [
  { places: [40, 24] },
  { places: [30, 25] },
  { places: [null, null], linked: true },
  { places: [12, 15] },
  { places: [null, null], read: false },
];

async function render(): Promise<Document> {
  const html = renderToStaticMarkup(await OverviewPage());
  return new DOMParser().parseFromString(html, "text/html");
}

const text = (el: Element | null | undefined): string => (el?.textContent ?? "").replace(/\s+/gu, " ").trim();
const linkOf = (el: Element | null): string | null | undefined => el?.querySelector("a[href]")?.getAttribute("href");

beforeEach(() => {
  db.reset();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  signedInAs(ACCOUNT);
  db.seed("scans", []);
  db.seed("publication_reads", []);
});

afterEach(() => {
  vi.useRealTimers();
  resetAccount();
});

beforeAll(async () => {
  await Promise.all([
    import("@/app/(account)/app/_overview/store"),
    import("@/lib/measure/published-store"),
    import("@/app/(account)/app/_shell/store"),
    import("@/lib/publish/reads/facts"),
    import("@/lib/publish/reads/store"),
  ]);
}, 60_000);

describe.each([
  ["a SaaS site", SAAS],
  ["a local business", LOCAL],
])("Overview's figures on %s", (_, site) => {
  it("Your pages in AI answers counts the stored readings whose own question was asked and linked, and opens them", async () => {
    const pubs = seed(site, FIVE);
    db.seed("publication_reads", [...READS]);
    const ai = (await render()).querySelector('[data-testid="overview-ai"]');

    const readings = pubs.map((pub) => readingOf(pub.search_reading)).filter((r): r is PageReading => r !== null);
    const asked = readings.filter((r) => r.linkedBy !== null);
    const linked = asked.filter((r) => (r.linkedBy ?? []).length > 0);
    expect([asked.length, linked.length]).toEqual([4, 1]);
    expect(text(ai?.querySelector("h2"))).toBe(copy("overview.ai.title"));
    expect(text(ai?.querySelector('[data-testid="overview-tile-ai-linked"]'))).toBe(String(linked.length));
    expect(text(ai)).toContain(copy("overview.ai.linked.of", { of: String(asked.length) }));
    expect(text(ai)).toContain(copy("overview.ai.linked.own", { n: String(linked.length) }));
    expect(text(ai)).toContain(copy("overview.ai.linked.not-yet", { n: String(asked.length - linked.length) }));
    expect(linkOf(ai)).toBe(AI_PAGES_HREF);
    expect(text(ai?.querySelector("a"))).toBe(copy("overview.ai.each"));

    // This week's answer fetches, not the indexer's, and the weeks before as bars.
    expect(text(ai?.querySelector('[data-testid="overview-tile-ai-reads"]'))).toBe(copy("overview.ai.reads", { n: "7" }));
    expect(text(ai)).toContain(copy("overview.ai.reads.who"));
    expect([...(ai?.querySelectorAll("figure li") ?? [])].map((li) => text(li))).toEqual(["Sep 26 · 5", "Oct 3 · 7"]);
  });

  it("Best mover this week is the page that rose most since the week before, counted from where it was first seen", async () => {
    seed(site, FIVE);
    const mover = (await render()).querySelector('[data-testid="overview-mover"]');
    expect(text(mover?.querySelector("h2"))).toBe(copy("overview.mover.title"));
    expect(text(mover)).toContain(`${site.search} 0`);
    expect(text(mover?.querySelector('[data-testid="overview-tile-mover"]'))).toBe("24");
    expect(text(mover)).toContain(copy("overview.mover.place"));
    expect(text(mover?.querySelector(".badge"))).toBe(copy("overview.mover.up", { n: "16", date: "Sep 28" }));
    expect(text(mover)).toContain(copy("draft.live.band"));
    // Sixteen places inside the window: climbing, so it is left alone.
    expect(text(mover)).toContain(copy("overview.mover.climbing"));
    expect(linkOf(mover)).toBe(GOOGLE_PAGES_HREF);
  });

  it("a week where nothing rose says so, and a site with no place read draws no mover at all", async () => {
    seed(site, [{ places: [20, 20] }, { places: [12, 15] }]);
    let dom = await render();
    expect(text(dom.querySelector('[data-testid="overview-mover-none"]'))).toBe(copy("overview.mover.none"));
    expect(dom.querySelector('[data-testid="overview-tile-mover"]')).toBeNull();

    db.reset();
    db.seed("scans", []);
    db.seed("publication_reads", []);
    seed(site, [{ places: [null, null] }]);
    dom = await render();
    expect(dom.querySelector('[data-testid="overview-mover"]')).toBeNull();
  });

  it("Google visits are the hosted pages' own counts: with no referral row there is no visits line, never a 0", async () => {
    seed(site, FIVE);
    db.seed("publication_reads", [...READS]);
    const dom = await render();
    expect(dom.querySelector('[data-testid="overview-ladder-visits"]')).toBeNull();
    expect(text(dom.body)).not.toContain(copy("overview.ladder.visits", { n: "0" }));
  });

  it("on WordPress the reads are not drawn, never 0, and the linked pages still are", async () => {
    seed(site, FIVE, { hosted: false });
    db.seed("publication_reads", [...READS]);
    const ai = (await render()).querySelector('[data-testid="overview-ai"]');
    expect(ai?.querySelector('[data-testid="overview-tile-ai-reads"]')).toBeNull();
    expect(ai?.querySelector("figure")).toBeNull();
    expect(text(ai?.querySelector('[data-testid="overview-tile-ai-linked"]'))).toBe("1");
  });
});

describe("the AI tab reads Overview's figures with the same reader", () => {
  it("its tiles count this week's fetches and the pages linked as Overview does", async () => {
    seed(SAAS, FIVE);
    db.seed("publication_reads", [...READS]);
    const overview = await render();
    const { default: AiTab } = await import("@/app/(account)/app/(tabs)/ai-answers/page");
    const tab = new DOMParser().parseFromString(renderToStaticMarkup(await AiTab()), "text/html");
    expect(text(tab.querySelector('[data-testid="ai-tile-reads-value"]'))).toBe("7");
    expect(text(tab.querySelector('[data-testid="ai-tile-linked-value"]'))).toBe(text(overview.querySelector('[data-testid="overview-tile-ai-linked"]')));
    expect(text(overview.querySelector('[data-testid="overview-tile-ai-reads"]'))).toBe(copy("overview.ai.reads", { n: "7" }));
  });
});

describe("Measures that move over months", () => {
  const months = {
    reading: { week: "2026-10-05", score: 31, market: { top10: 1, of: 12 } },
    scan: { score: 27 as number | null, market: 0 as number | null },
    next: "2026-11-02",
  };
  const draw = (m: typeof months | { reading: null; scan: typeof months.scan; next: string }): Document =>
    new DOMParser().parseFromString(renderToStaticMarkup(MonthsFigure({ months: m, timeZone: ZONE })), "text/html");

  it("labels each figure months-scale, against the scan, with the next first Monday", () => {
    const dom = draw(months);
    expect(text(dom.querySelector("h2"))).toBe(copy("overview.months.title"));
    expect(text(dom.querySelector('[data-testid="overview-months-next"]'))).toBe(copy("overview.months.checked", { date: "Monday, November 2" }));
    const score = text(dom.querySelector('[data-testid="overview-tile-score"]'));
    expect(text(dom.querySelector('[data-testid="overview-tile-score"] .num'))).toMatch(new RegExp(`^31 ?${copy("overview.months.of", { of: "100" })}$`));
    expect(score).toContain(copy("overview.months.score.up", { n: "27" }));
    const market = text(dom.querySelector('[data-testid="overview-tile-market"]'));
    expect(market).toContain(`1 ${copy("overview.months.of", { of: "12" })}`);
    expect(market).toContain(copy("overview.months.market.up", { n: "0" }));
    expect(text(dom.querySelector('[data-testid="overview-months-note"]'))).toContain(copy("overview.months.note"));
  });

  it("holds two figures, score and market; AI mentions are the AI tab's alone (O6, say it once)", () => {
    const tiles = [...draw(months).querySelectorAll('[data-testid^="overview-tile-"]')].map((tile) => tile.getAttribute("data-testid"));
    expect(tiles).toEqual(["overview-tile-score", "overview-tile-market"]);
  });

  it("before the first month's reading it names the day, and draws no figure", () => {
    const dom = draw({ reading: null, scan: months.scan, next: "2026-11-02" });
    expect(text(dom.querySelector('[data-testid="overview-months-next"]'))).toBe(copy("overview.months.first", { date: "Monday, November 2" }));
    expect(dom.querySelector('[data-testid^="overview-tile-"]')).toBeNull();
  });

  /** The decorative two-point line a tile ends in, or none. */
  const lineIn = (dom: Document, tile: string): Element | null => dom.querySelector(`[data-testid="overview-tile-${tile}"] figure[aria-hidden="true"]`);

  it("score tile draws a two-point line from the scan to today", () => {
    expect(lineIn(draw(months), "score")?.getAttribute("data-points")).toBe("2");
    expect(lineIn(draw({ ...months, scan: { ...months.scan, score: null } }), "score")).toBeNull();
  });

  it("market tile draws its two-point line, from a scan that measured 0 but never from one that measured nothing", () => {
    expect(lineIn(draw(months), "market")?.getAttribute("data-points")).toBe("2");
    expect(lineIn(draw({ ...months, scan: { ...months.scan, market: null } }), "market")).toBeNull();
  });

  it("a figure at its scan's own value says so, and one below says down", () => {
    const same = text(draw({ ...months, scan: { score: 31, market: 2 } }).querySelector('[data-testid="overview-months"]'));
    expect(same).toContain(copy("overview.months.score.same"));
    expect(same).toContain(copy("overview.months.market.down", { n: "2" }));
  });
});

describe("board Main: the figure sections", () => {
  it("every board string of those sections is on the screen, but for sample data", async () => {
    signedInAs(RESERVED_ACCOUNT);
    const html = renderToStaticMarkup(await OverviewPage());
    const board = readFileSync(boardFile("Main"), "utf8");
    const { missing } = compare(board, segments(html), readAllow("Main"));
    const all = compare(board, [], []).missing;
    const from = all.indexOf("Your pages in AI answers");
    const to = all.findIndex((s: string) => s.startsWith("These grow with links"));
    expect([from, to].every((i) => i > -1)).toBe(true);
    const sections = new Set(all.slice(from, to + 1));
    expect(missing.filter((s: string) => sections.has(s))).toEqual([]);
  });
});
