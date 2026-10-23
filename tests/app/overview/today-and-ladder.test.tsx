/** @vitest-environment jsdom */
// SPEC §4 (owner E4, 2026-10-19; board Main): Overview opens with today's
// page, then how far each live page got. Driven through the real `/app` page
// over stored rows whose readings the weekly pass's own writer assembled, for
// a SaaS site and a local one from the customer panel.
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

import { readFileSync } from "node:fs";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { fakeDb, type FakeDb, type Row } from "../../publish/harness";
import { LOCAL, SAAS, stored, weekWith } from "../../measure/reading-fixture";
import { assembleReading, readingOf, type PageReading } from "@/lib/measure/page-reading";
import { verdict } from "@/lib/opportunities/verdicts/verdict";
import { boardFile, compare, readAllow, segments } from "../../../scripts/design/parity.mjs";

const db: FakeDb = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));
vi.mock("@/lib/opportunities", () => ({
  supplyDepth: async () => ({ unused: 9, total: 12 }),
  supplyMeasured: async () => true,
  supplyState: async () => "measured",
  readWeek: async () => [],
}));

const { LIVE_ACCOUNT, resetAccount, signedInAs } = await import("../account-door");
const { default: OverviewPage } = await import("@/app/(account)/app/(tabs)/page");
const { copy } = await import("@/lib/presentation/copy");

const ZONE = "UTC";
const ACCOUNT = { ...LIVE_ACCOUNT, timeZone: ZONE };
const SITE_ID = ACCOUNT.siteId;
/** Friday 9 October 2026, 10:00 UTC. */
const NOW = new Date(Date.UTC(2026, 9, 9, 10, 0, 0));
const READ = new Date(Date.UTC(2026, 9, 5, 6, 0, 0));

const TODAY: Row = {
  id: "today",
  site_id: SITE_ID,
  state: "in_review",
  title: "Emergency plumber in Austin: what to do in the first hour",
  scheduled_for: "2026-10-09",
  created_at: "2026-10-08T16:00:00.000Z",
  veto_deadline: "2026-10-09T16:00:00.000Z",
};

type Site = typeof SAAS;

/** One live page's stored reading, as the Monday pass writes it. */
interface Shape {
  place: number | null;
  linked?: boolean;
  crawled: boolean;
  aiReads: number;
  aiVisits: number;
  clicks: number | null;
}

/** Twelve pages at different heights: two on the first page, three lower
 *  in results, the rest not showing; some read or linked by AI. */
const TWELVE: readonly Shape[] = Array.from({ length: 12 }, (_, i) => ({
  place: i < 2 ? 3 + i * 4 : i < 5 ? 40 + i : null,
  linked: i === 2 || i === 5,
  crawled: i < 10,
  aiReads: i % 3 === 0 ? 0 : i,
  aiVisits: i === 4 ? 1 : 0,
  clicks: i < 5 ? (i === 0 ? 7 : 0) : null,
}));

function pageUrl(site: Site, i: number): string {
  return `${site.page}-${i}`;
}

function readingFor(site: Site, shapes: readonly Shape[], i: number): PageReading {
  const shape = shapes[i]!;
  const report = weekWith({
    domain: site.domain,
    asked: shapes.map((s, n) => ({ publicationId: `p${n}`, liveUrl: pageUrl(site, n), search: `${site.search} ${n}`, place: s.place, linked: s.linked })),
  });
  return assembleReading({
    before: null,
    report,
    now: READ,
    page: {
      id: `p${i}`,
      liveUrl: pageUrl(site, i),
      search: `${site.search} ${i}`,
      crawled: shape.crawled,
      aiReads: shape.aiReads,
      aiVisits: shape.aiVisits,
      google:
        shape.clicks === null
          ? null
          : { indexed: true, lastCrawl: null, impressions: 20, clicks: shape.clicks, bestPlace: null, bestQuery: null },
      bing: null,
    },
  });
}

function seedPages(site: Site, shapes: readonly Shape[], opts: { destination?: string; read?: boolean } = {}): Row[] {
  const pubs = shapes.map((_, i) => ({
    id: `p${i}`,
    site_id: SITE_ID,
    draft_id: `d${i}`,
    destination: opts.destination ?? "hosted",
    live_url: pageUrl(site, i),
    published_at: new Date(Date.UTC(2026, 8, 20 + i)).toISOString(),
    unpublished_at: null,
    search_reading: opts.read === false ? null : stored(readingFor(site, shapes, i) as never),
  }));
  db.seed("publications", pubs);
  db.seed("drafts", [
    TODAY,
    ...shapes.map((_, i) => ({ id: `d${i}`, site_id: SITE_ID, state: "published", title: `Page ${i}`, created_at: "2026-09-01T00:00:00.000Z" })),
  ]);
  return pubs;
}

function site(domain: string): void {
  db.seed("sites", [
    { id: SITE_ID, user_id: ACCOUNT.userId, domain, timezone: ZONE, competitors: [], veto_hours: 24, publishing_enabled: true },
  ]);
}

async function render(): Promise<{ html: string; dom: Document }> {
  const html = renderToStaticMarkup(await OverviewPage());
  return { html, dom: new DOMParser().parseFromString(html, "text/html") };
}

const text = (el: Element | null | undefined): string => (el?.textContent ?? "").replace(/\s+/gu, " ").trim();

/** The highest step a stored reading reached, by the reading alone. */
function expectedSteps(reading: PageReading | null, wordpress = false): string {
  if (reading === null) return `${copy("draft.ladder.live")} · ${copy("draft.ladder.unmeasured")}`;
  const r = reading.reached;
  const google =
    r.firstPage !== undefined ? "draft.ladder.first-page"
    : r.showing !== undefined ? "draft.ladder.showing"
    : r.found !== undefined && !wordpress ? "draft.ladder.found"
    : "draft.ladder.live";
  const ai =
    r.aiVisit !== undefined && !wordpress ? "draft.ladder.visit"
    : r.linkedByAi !== undefined ? "draft.ladder.linked"
    : r.readByAi !== undefined && !wordpress ? "draft.ladder.read"
    : null;
  return [copy(google), ai === null ? null : copy(ai)].filter(Boolean).join(" · ");
}

const LABEL_KEY = { working: "review.label.working", climbing: "review.label.climbing", too_early: "review.label.too_early", not_moving: "review.label.not_moving" } as const;

beforeEach(() => {
  db.reset();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  signedInAs(ACCOUNT);
  db.seed("scans", []);
});

afterEach(() => {
  vi.useRealTimers();
  resetAccount();
});

beforeAll(async () => {
  await Promise.all([
    import("@/app/(account)/app/_overview/store"),
    import("@/app/(account)/app/_overview/search-provider"),
    import("@/app/(account)/app/_overview/search-store"),
    import("@/app/(account)/app/_overview/content-store"),
    import("@/app/(account)/app/_shell/store"),
    import("@/lib/publish/reads/facts"),
  ]);
}, 60_000);

describe.each([
  ["a SaaS site", SAAS],
  ["a local business", LOCAL],
])("Overview on %s", (_, panel) => {
  beforeEach(() => site(panel.domain));

  it("opens with today's page, then one ladder row per live page, each step as its stored reading says", async () => {
    const pubs = seedPages(panel, TWELVE);
    const { html, dom } = await render();

    const at = (id: string): number => html.indexOf(`data-testid="${id}"`);
    expect(at("overview-waiting")).toBeGreaterThan(-1);
    expect(at("overview-waiting")).toBeLessThan(at("overview-ladder"));

    const card = dom.querySelector('[data-testid="overview-waiting"]');
    expect(text(card)).toContain(copy("overview.today.eyebrow", { time: "4:00 PM" }));
    expect(text(card)).toContain(TODAY.title as string);
    expect(text(card)).toContain(copy("overview.today.ready"));
    expect(text(card)).toContain(copy("overview.alert.pending-veto.action"));
    expect(text(card)).toContain(copy("draft.action.veto"));
    expect(text(card)).toContain(copy("overview.today.stop-note"));

    const readings = pubs.map((pub) => readingOf(pub.search_reading));
    const rows = [...dom.querySelectorAll('[data-testid="overview-ladder-row"]')];
    expect(rows).toHaveLength(12);
    for (const [i, pub] of pubs.entries()) {
      const row = rows.find((r) => text(r.querySelector("a")) === `Page ${i}`)!;
      expect(text(row.querySelector('[data-testid="overview-ladder-row-steps"]'))).toBe(expectedSteps(readings[i]!));
      expect(text(row.querySelector(".badge"))).toBe(copy(LABEL_KEY[verdict(readings[i]!, NOW)]));
      // Each row opens its page's own screen.
      expect(row.querySelector("a")?.getAttribute("href")).toBe(`/app/draft/${pub.draft_id}`);
    }

    const figure = (testId: string, key: Parameters<typeof copy>[0]): string =>
      text(dom.querySelector(`[data-testid="${testId}"] [data-step="${key}"] a`));
    const count = (pick: (r: PageReading) => boolean): string => String(readings.filter((r) => pick(r!)).length);
    expect(figure("overview-ladder-google", "draft.ladder.live")).toBe("12");
    expect(figure("overview-ladder-google", "draft.ladder.found")).toBe(count((r) => r.reached.found !== undefined));
    expect(figure("overview-ladder-google", "draft.ladder.showing")).toBe(count((r) => r.reached.showing !== undefined));
    expect(figure("overview-ladder-google", "draft.ladder.first-page")).toBe(count((r) => r.reached.firstPage !== undefined));
    expect(figure("overview-ladder-ai", "draft.ladder.read")).toBe(count((r) => r.reached.readByAi !== undefined));
    expect(figure("overview-ladder-ai", "draft.ladder.linked")).toBe(count((r) => r.reached.linkedByAi !== undefined));
    expect(figure("overview-ladder-ai", "draft.ladder.visit")).toBe(count((r) => r.reached.aiVisit !== undefined));

    const ladder = dom.querySelector('[data-testid="overview-ladder"]');
    expect(text(ladder?.querySelector("h2"))).toBe(copy("overview.ladder.title", { n: "12" }));
    expect(text(ladder)).toContain(copy("overview.ladder.read", { on: "Monday, October 5" }));
    expect(text(ladder)).toContain(copy("overview.ladder.google.sub"));
    expect(text(ladder)).toContain(copy("overview.ladder.ai.sub"));
    expect(text(ladder)).toContain(copy("overview.ladder.step.showing", { n: "12" }));
    expect(text(ladder)).toContain(copy("overview.ladder.how.title"));
    expect(text(ladder)).toContain(copy("overview.ladder.how.google"));
    expect(text(ladder)).toContain(copy("overview.ladder.how.ai"));
    expect(text(dom.querySelector('[data-testid="overview-ladder-visits"]'))).toBe(copy("overview.ladder.visits", { n: "7", weeks: "4" }));
    // Pages already show in results, so the week-1 line is not said.
    expect(dom.querySelector('[data-testid="overview-ladder-week1"]')).toBeNull();
  });

  it("a page nothing has read yet is not measured, never an empty step or a 0", async () => {
    seedPages(panel, TWELVE.slice(0, 3), { read: false });
    const { dom } = await render();
    const ladder = dom.querySelector('[data-testid="overview-ladder"]')!;
    for (const step of ladder.querySelectorAll('[data-step]')) {
      if (step.getAttribute("data-step") === "draft.ladder.live") continue;
      expect(text(step)).toContain(copy("draft.ladder.unmeasured"));
      expect(step.querySelector("a")).toBeNull();
    }
    for (const row of ladder.querySelectorAll('[data-testid="overview-ladder-row-steps"]')) {
      expect(text(row)).toBe(expectedSteps(null));
    }
    expect(ladder.querySelectorAll('[data-testid="overview-ladder-row"] .badge')).toHaveLength(0);
    expect(ladder.querySelector('[data-testid="overview-ladder-visits"]')).toBeNull();
    expect(text(ladder.querySelector('[data-testid="overview-ladder-week1"]'))).toBe(copy("overview.ladder.week1.short", { live: "3" }));
  });

  it("week 1: the same ladder, and the line of what has lit up so far", async () => {
    const first: Shape[] = [
      { place: null, crawled: true, aiReads: 2, aiVisits: 0, clicks: null },
      { place: null, crawled: false, aiReads: 0, aiVisits: 0, clicks: null },
      { place: null, crawled: false, aiReads: 0, aiVisits: 0, clicks: null },
    ];
    seedPages(panel, first);
    const { dom } = await render();
    expect(text(dom.querySelector('[data-testid="overview-ladder-week1"]'))).toBe(
      copy("overview.ladder.week1", { live: "3", found: "1", read: "1" })
    );
    expect(dom.querySelector('[data-testid="overview-ladder-visits"]')).toBeNull();
    expect(text(dom.querySelector('[data-step="draft.ladder.showing"] a'))).toBe("0");
  });

  it("on WordPress, Found by Google, Read by AI and the visits are not drawn, never 0", async () => {
    seedPages(panel, TWELVE, { destination: "wordpress" });
    const { dom } = await render();
    const steps = [...dom.querySelectorAll('[data-testid="overview-ladder"] [data-step]')].map((s) => s.getAttribute("data-step"));
    expect(steps).toEqual(["draft.ladder.live", "draft.ladder.showing", "draft.ladder.first-page", "draft.ladder.linked"]);
    const ladder = text(dom.querySelector('[data-testid="overview-ladder"]'));
    expect(ladder).not.toContain(copy("draft.ladder.found"));
    expect(ladder).not.toContain(copy("draft.ladder.read"));
    expect(ladder).not.toContain(copy("draft.ladder.visit"));
  });
});

describe("board Main: the today card and the ladder", () => {
  it("every board string of those sections is on the screen, but for sample data", async () => {
    site(LOCAL.domain);
    seedPages(LOCAL, TWELVE);
    const { html } = await render();
    const board = readFileSync(boardFile("Main"), "utf8");
    const { missing } = compare(board, segments(html), readAllow("Main"));
    const all = compare(board, [], []).missing;
    // The two sections run from the today card's eyebrow to the line before *This week's 7 pages*.
    const from = all.findIndex((s: string) => s.startsWith("Goes live today"));
    const to = all.findIndex((s: string) => s.startsWith("This week"));
    const sections = new Set(all.slice(from, to));
    expect(from).toBeGreaterThan(-1);
    expect(missing.filter((s: string) => sections.has(s))).toEqual([]);
  });
});
