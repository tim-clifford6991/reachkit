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
  /** The place a week before, so the reading is carried forward from it. */
  was?: number;
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
  const was = shapes[i]!.was;
  const before =
    was === undefined
      ? null
      : weekOf(site, shapes.map((s) => ({ ...s, place: s.was ?? s.place })), i, new Date(READ.getTime() - 7 * 86_400_000), null);
  return weekOf(site, shapes, i, READ, before);
}

function weekOf(site: Site, shapes: readonly Shape[], i: number, now: Date, before: PageReading | null): PageReading {
  const shape = shapes[i]!;
  const report = weekWith({
    domain: site.domain,
    asked: shapes.map((s, n) => ({ publicationId: `p${n}`, liveUrl: pageUrl(site, n), search: `${site.search} ${n}`, place: s.place, linked: s.linked })),
  });
  return assembleReading({
    before,
    report,
    now,
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

/** `unread`: the last pages went live after Monday's reading, so they have none. */
function seedPages(
  site: Site,
  shapes: readonly Shape[],
  opts: { destination?: string | ((i: number) => string); read?: boolean; unread?: number } = {}
): Row[] {
  const fresh = (i: number): boolean => i >= shapes.length - (opts.unread ?? 0);
  const pubs = shapes.map((_, i) => ({
    id: `p${i}`,
    site_id: SITE_ID,
    draft_id: `d${i}`,
    destination: typeof opts.destination === "function" ? opts.destination(i) : (opts.destination ?? "hosted"),
    live_url: pageUrl(site, i),
    published_at: (fresh(i) ? new Date(Date.UTC(2026, 9, 6 + (i % 3))) : new Date(Date.UTC(2026, 8, 20 + i))).toISOString(),
    unpublished_at: null,
    search_reading: opts.read === false || fresh(i) ? null : stored(readingFor(site, shapes, i) as never),
  }));
  db.seed("publications", pubs);
  db.seed("drafts", [
    TODAY,
    ...shapes.map((_, i) => ({ id: `d${i}`, site_id: SITE_ID, state: "published", title: `Page ${i}`, created_at: "2026-09-01T00:00:00.000Z" })),
  ]);
  return pubs;
}

/** Visits from Google are the hosted pages' own counts this week: 8, never Bing's or last week's. */
function seedVisits(site: Site): void {
  db.seed("destinations", [{ id: "dest-hosted", site_id: SITE_ID, kind: "hosted", hostname: `guides.${site.domain}`, hostname_state: "live", deleted_at: null }]);
  db.seed("publication_reads", [
    { site_id: SITE_ID, publication_id: "p0", day: "2026-10-08", engine: "google", kind: "referral", hits: 5 },
    { site_id: SITE_ID, publication_id: "p1", day: "2026-10-09", engine: "google", kind: "referral", hits: 3 },
    { site_id: SITE_ID, publication_id: "p1", day: "2026-10-09", engine: "bing", kind: "referral", hits: 4 },
    { site_id: SITE_ID, publication_id: "p1", day: "2026-10-01", engine: "google", kind: "referral", hits: 30 },
  ]);
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

/** The hint's own words, without its count. */
const NOT_READ = copy("overview.ladder.unread", { k: "" }).trim();

/** The board's icon for each ladder step and each label (Main, AppGoogle, Plan). */
const STEP_ICON = {
  "draft.ladder.live": "lucide-globe",
  "draft.ladder.found": "lucide-search",
  "draft.ladder.showing": "lucide-eye",
  "draft.ladder.first-page": "lucide-trophy",
  "draft.ladder.read": "lucide-sparkles",
  "draft.ladder.linked": "lucide-link",
  "draft.ladder.visit": "lucide-user",
} as const;
const LABEL_ICON = { working: "lucide-check", climbing: "lucide-trending-up", too_early: "lucide-clock", not_moving: "lucide-minus" } as const;

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
    import("@/lib/measure/published-store"),
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
    seedVisits(panel);
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
    expect(text(dom.querySelector('[data-testid="overview-ladder-visits"]'))).toBe(copy("overview.ladder.visits", { n: "8" }));
    // Pages already show in results, so the week-1 line is not said.
    expect(dom.querySelector('[data-testid="overview-ladder-week1"]')).toBeNull();
    // Every page is read, so no page is said to be waiting for one.
    expect(text(ladder)).not.toContain(NOT_READ);
  });

  it("every ladder step carries its board icon", async () => {
    seedPages(panel, TWELVE);
    const { dom } = await render();
    const steps = [...dom.querySelectorAll('[data-testid="overview-ladder"] [data-step]')];
    expect(steps.map((step) => step.getAttribute("data-step"))).toEqual(Object.keys(STEP_ICON));
    for (const step of steps) {
      const eyebrow = step.firstElementChild!;
      // The icon comes before the step's number and name.
      expect(eyebrow.firstElementChild?.matches(`svg.${STEP_ICON[step.getAttribute("data-step") as keyof typeof STEP_ICON]}`)).toBe(true);
      expect(eyebrow.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("a measured step has a bar at count of total; an unmeasured step has none", async () => {
    const pubs = seedPages(panel, TWELVE, { unread: 3 });
    const read = pubs.map((pub) => readingOf(pub.search_reading)).filter((r): r is PageReading => r !== null);
    const reached = (pick: (r: PageReading) => boolean): number => read.filter(pick).length;
    const expected: Record<keyof typeof STEP_ICON, { value: number; max: number }> = {
      "draft.ladder.live": { value: pubs.length, max: pubs.length },
      "draft.ladder.found": { value: reached((r) => r.reached.found !== undefined), max: read.length },
      "draft.ladder.showing": { value: reached((r) => r.reached.showing !== undefined), max: read.length },
      "draft.ladder.first-page": { value: reached((r) => r.reached.firstPage !== undefined), max: read.length },
      "draft.ladder.read": { value: reached((r) => r.reached.readByAi !== undefined), max: read.length },
      "draft.ladder.linked": { value: reached((r) => r.reached.linkedByAi !== undefined), max: read.length },
      "draft.ladder.visit": { value: reached((r) => r.reached.aiVisit !== undefined), max: read.length },
    };
    const { dom } = await render();
    for (const step of dom.querySelectorAll('[data-testid="overview-ladder"] [data-step]')) {
      const bar = step.querySelector("progress.progress");
      const want = expected[step.getAttribute("data-step") as keyof typeof STEP_ICON];
      expect([bar?.getAttribute("value"), bar?.getAttribute("max")]).toEqual([String(want.value), String(want.max)]);
      expect(bar?.getAttribute("aria-hidden")).toBe("true");
    }

    db.reset();
    site(panel.domain);
    seedPages(panel, TWELVE.slice(0, 3), { read: false });
    const unread = (await render()).dom;
    for (const step of unread.querySelectorAll('[data-testid="overview-ladder"] [data-step]')) {
      const live = step.getAttribute("data-step") === "draft.ladder.live";
      // Not measured is never an empty bar.
      expect(step.querySelector("progress")?.getAttribute("value") ?? null).toBe(live ? "3" : null);
      if (!live) expect(text(step)).toContain(copy("draft.ladder.unmeasured"));
    }
  });

  it("label badges carry their icons", async () => {
    const pubs = seedPages(panel, TWELVE);
    const { dom } = await render();
    const labels = pubs.map((pub) => verdict(readingOf(pub.search_reading)!, NOW));
    const rows = [...dom.querySelectorAll('[data-testid="overview-ladder-row"]')];
    for (const [i, label] of labels.entries()) {
      const badge = rows.find((r) => text(r.querySelector("a")) === `Page ${i}`)!.querySelector(".badge")!;
      expect(badge.querySelector(`svg.${LABEL_ICON[label]}`)).not.toBeNull();
    }
    expect(new Set(labels).size).toBeGreaterThan(1);
  });

  it("Showing's climbing badge carries the climbing icon", async () => {
    // Pages 3 and 4 were at 70 a week before, so their best is a gain of more than ten places.
    const pubs = seedPages(panel, TWELVE.map((s, i) => (i === 3 || i === 4 ? { ...s, was: 70 } : s)));
    const climbing = pubs.filter((pub) => verdict(readingOf(pub.search_reading)!, NOW) === "climbing").length;
    expect(climbing).toBe(2);
    const { dom } = await render();
    const badge = dom.querySelector('[data-testid="overview-ladder-google"] [data-step="draft.ladder.showing"] .badge');
    expect(text(badge)).toBe(copy("overview.ladder.climbing", { n: String(climbing) }));
    expect(badge?.firstElementChild?.matches(`svg.${LABEL_ICON.climbing}`)).toBe(true);
    expect(badge?.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
  });

  it("a page published since the reading is not read yet, never a page short of a step", async () => {
    seedPages(panel, TWELVE, { unread: 3 });
    const { dom } = await render();
    const ladder = dom.querySelector('[data-testid="overview-ladder"]')!;
    const line = (key: Parameters<typeof copy>[0]): string => text(ladder.querySelector(`[data-step="${key}"] a ~ span`));
    expect(text(ladder.querySelector('[data-step="draft.ladder.live"] a'))).toBe("12");
    expect(line("draft.ladder.live")).toBe(copy("overview.ladder.step.live", { n: "12" }));
    // The nine read pages were all fetched: 9 of 9, not 9 of 12.
    expect(text(ladder.querySelector('[data-step="draft.ladder.found"] a'))).toBe("9");
    expect(line("draft.ladder.found")).toBe(copy("overview.ladder.step.found", { n: "9" }));
    expect(line("draft.ladder.showing")).toBe(copy("overview.ladder.step.showing", { n: "9" }));
    expect(line("draft.ladder.linked")).toBe(copy("overview.ladder.step.linked", { n: "9" }));
    expect(text(ladder.querySelector("h2 + p"))).toBe(
      `${copy("overview.ladder.read", { on: "Monday, October 5" })} · ${copy("overview.ladder.unread", { k: "3" })}`
    );
    // An unread page's own row says it is not checked yet; no step says it for the pages short of it.
    expect([...ladder.querySelectorAll("[data-step]")].filter((step) => text(step).includes(NOT_READ))).toEqual([]);
  });

  it("a mixed hosted and WordPress site counts each step over its own read pages", async () => {
    seedPages(panel, TWELVE, { unread: 3, destination: (i) => (i < 4 ? "wordpress" : "hosted") });
    const { dom } = await render();
    const ladder = dom.querySelector('[data-testid="overview-ladder"]')!;
    // Found is read on the hosted pages only: p4 to p8 have a reading, all fetched.
    expect(text(ladder.querySelector('[data-step="draft.ladder.found"] a'))).toBe("5");
    expect(text(ladder.querySelector('[data-step="draft.ladder.found"] a ~ span'))).toBe(copy("overview.ladder.step.found", { n: "5" }));
    expect(text(ladder.querySelector('[data-step="draft.ladder.showing"] a ~ span'))).toBe(copy("overview.ladder.step.showing", { n: "9" }));
    expect(text(ladder)).toContain(copy("overview.ladder.unread", { k: "3" }));
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
    expect(text(ladder)).not.toContain("0 of");
    expect(text(ladder)).toContain(copy("overview.ladder.unread", { k: "3" }));
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

  it("week 1 with pages not read yet: found and read count over the read pages, and the line says how many wait", async () => {
    const five: Shape[] = [
      { place: null, crawled: true, aiReads: 2, aiVisits: 0, clicks: null },
      { place: null, crawled: true, aiReads: 0, aiVisits: 0, clicks: null },
      { place: null, crawled: false, aiReads: 0, aiVisits: 0, clicks: null },
      { place: null, crawled: false, aiReads: 0, aiVisits: 0, clicks: null },
      { place: null, crawled: false, aiReads: 0, aiVisits: 0, clicks: null },
    ];
    seedPages(panel, five, { unread: 2 });
    const { dom } = await render();
    expect(text(dom.querySelector('[data-testid="overview-ladder-week1"]'))).toBe(
      copy("overview.ladder.week1", { live: "5", found: "2", read: "1" })
    );
    expect(text(dom.querySelector('[data-step="draft.ladder.found"] a ~ span'))).toBe(copy("overview.ladder.step.found", { n: "3" }));
    expect(text(dom.querySelector('[data-testid="overview-ladder"]'))).toContain(copy("overview.ladder.unread", { k: "2" }));
  });

  it("week 1 with nothing read: the short line, never a count of 0", async () => {
    seedPages(panel, Array.from({ length: 5 }, () => TWELVE[11]!), { read: false });
    const { dom } = await render();
    expect(text(dom.querySelector('[data-testid="overview-ladder-week1"]'))).toBe(copy("overview.ladder.week1.short", { live: "5" }));
    expect(text(dom.querySelector('[data-testid="overview-ladder"]'))).not.toContain("0 of");
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
    seedVisits(LOCAL);
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
